import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Question, QuestionType, Quiz } from '@models/quiz';
import { QuestionsService } from '@core/services/questions-service';
import { LoginService } from '@core/services/login-service';
import { LoggerService } from '@core/services/logger.service';

@Component({
    selector: 'app-questions',
    templateUrl: './questions.component.html',
    styleUrls: ['./questions.component.css'],
    standalone: false
})
export class QuestionsComponent implements OnInit {
  multichoice: boolean;
  onechoice: boolean;
  truefalse: boolean;
  questionType: string;
  assessment: Quiz;
  curQuestion: Question;
  allAnswered: boolean = false;
  submitted: boolean = false;
  resultsAccepted: boolean = false;
  startTime: number;
  elapsedTime: number = 0;

  private returnTo: 'chapter' | 'course' | null = null;
  private returnCourseId: string | null = null;
  private returnChapterId: string | null = null;
  private returnPage: number | null = null;
  constructor(
    private questionsService: QuestionsService,
    private router: Router,
    private route: ActivatedRoute,
    private loginService: LoginService,
    private logger: LoggerService
  ) { }

  ngOnInit() {
    // Get assessment ID from route params
    const assessmentIdParam = this.route.snapshot.queryParams['id'];
    const id = assessmentIdParam ? parseInt(assessmentIdParam, 10) : undefined;

    // Optional return target (used for chapter checkpoint / course final entry points)
    const returnToParam = this.route.snapshot.queryParams['returnTo'];
    if (returnToParam === 'chapter' || returnToParam === 'course') {
      this.returnTo = returnToParam;
    }
    const returnCourseId = this.route.snapshot.queryParams['returnCourseId'];
    const returnChapterId = this.route.snapshot.queryParams['returnChapterId'];
    const returnPageParam = this.route.snapshot.queryParams['returnPage'];
    this.returnCourseId = typeof returnCourseId === 'string' ? returnCourseId : null;
    this.returnChapterId = typeof returnChapterId === 'string' ? returnChapterId : null;
    const parsedPage = returnPageParam !== undefined ? Number(returnPageParam) : NaN;
    this.returnPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : null;
    
    // Start timer when assessment loads
    this.startTime = Date.now();
    
    this.questionsService.getAssessment(id).subscribe({
      next: (data: Quiz) => {
        this.assessment = data as Quiz;
        if (this.assessment && this.assessment.questions.length > 0) {
          this.curQuestion = this.assessment.questions[0];
          this.setQuestionType();
        }
      },
      error: (error) => this.logger.error('Error fetching questions', error)
    });
    this.logger.debug('QuestionsComponent initialized');
  }

  goPrevious() {
    if (this.curQuestion.questionNum > 0) {
      this.curQuestion = this.assessment.questions[this.curQuestion.questionNum - 1];
      this.setQuestionType();
    }
  }

  goNext() {
    if (this.assessment.questions.length > this.curQuestion.questionNum) {
      this.curQuestion = this.assessment.questions[this.curQuestion.questionNum + 1];
      this.setQuestionType();
    }
  }

  recordMultiChoiceAnswer(answerNum: number) {
    if (!this.curQuestion.selection) {
      this.curQuestion.selection = [];
    }
    
    const index = this.curQuestion.selection.indexOf(answerNum);
    if (index > -1) {
      // Answer already selected, remove it (uncheck)
      this.curQuestion.selection.splice(index, 1);
    } else {
      // Answer not selected, add it (check)
      this.curQuestion.selection.push(answerNum);
    }
    this.checkAllAnswered();
  }

  recordSingleAnswer(answerNum: number) {
    if (!this.curQuestion.selection) {
      this.curQuestion.selection = [];
    }
    // For single choice (onechoice/truefalse), replace the selection with only the selected answer
    this.curQuestion.selection = [answerNum];
    this.checkAllAnswered();
  }

  isAnswerSelected(answerNum: number): boolean {
    if (!this.curQuestion || !this.curQuestion.selection) {
      return false;
    }
    return this.curQuestion.selection.includes(answerNum);
  }

  checkAllAnswered() {
    if (!this.assessment || !this.assessment.questions || this.assessment.questions.length === 0) {
      this.allAnswered = false;
      return;
    }
    
    this.allAnswered = this.assessment.questions.every(question => 
      question.selection && question.selection.length > 0
    );
  }

  submit() {
    if (this.allAnswered) {
      // Calculate elapsed time in seconds
      this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
      this.submitted = true;
      this.logger.debug('Assessment submitted', this.assessment);
      this.logger.debug('Time taken (seconds)', this.elapsedTime);
    }
  }

  retakeAssessment() {
    // Reset all selections
    if (this.assessment && this.assessment.questions) {
      this.assessment.questions.forEach(question => {
        question.selection = [];
      });
    }
    // Reset state
    this.submitted = false;
    this.allAnswered = false;
    this.resultsAccepted = false;
    // Reset timer
    this.startTime = Date.now();
    this.elapsedTime = 0;
    // Go back to first question
    if (this.assessment && this.assessment.questions.length > 0) {
      this.curQuestion = this.assessment.questions[0];
      this.setQuestionType();
    }
  }

  acceptResults() {
    // Prevent multiple submissions
    if (this.resultsAccepted) {
      this.logger.warn('Results already accepted; ignoring duplicate submission');
      return;
    }
    
    // Mark results as accepted
    this.resultsAccepted = true;
    
    // Could navigate to home or show confirmation
    this.logger.info('Results accepted');
    // Calculate score
    let score = 0;
    this.assessment.questions.forEach(question => {
      if (this.isQuestionCorrect(question)) {
        score++;
      }
    });

    // Prepare assessment data for saving
    const assessmentData = {
      id: this.assessment.id,
      title: this.assessment.title,
      completedAt: new Date(),
      questions: this.assessment.questions.map(q => ({
        questionNum: q.questionNum,
        question: q.question,
        answers: q.answers,
        selection: q.selection,
        correct: q.correct,
        isCorrect: this.isQuestionCorrect(q)
      })),
      score: score,
      totalQuestions: this.assessment.questions.length,
      duration: this.elapsedTime
    };

    // Save to database
    this.questionsService.saveAssessment(this.getUsername(), assessmentData).subscribe({
      next: (response) => {
        this.logger.info('Assessment saved successfully', response);
        this.navigateAfterAssessment();
      },
      error: (error) => {
        this.logger.error('Error saving assessment', error);
        // Still redirect even if save fails
        this.navigateAfterAssessment();
      }
    });
  }

  private navigateAfterAssessment(): void {
    if (this.returnTo === 'chapter' && this.returnCourseId && this.returnChapterId) {
      const page = this.returnPage || 1;
      this.router.navigate(['/courses', this.returnCourseId, 'chapters', this.returnChapterId], {
        queryParams: { page },
      });
      return;
    }

    if (this.returnTo === 'course' && this.returnCourseId) {
      this.router.navigate(['/courses', this.returnCourseId]);
      return;
    }

    // Default legacy behavior
    this.router.navigate(['/history']);
  }

  getAnswerText(question: Question, answerNum: number): string {
    if (!question.answers || answerNum < 1 || answerNum > question.answers.length) {
      return '';
    }
    return question.answers[answerNum - 1];
  }

  isQuestionCorrect(question: Question): boolean {
    if (!question.selection || !question.correct) {
      return false;
    }
    
    // Check if both arrays have the same length and contain the same elements
    if (question.selection.length !== question.correct.length) {
      return false;
    }
    
    // Sort both arrays and compare
    const sortedSelection = [...question.selection].sort();
    const sortedCorrect = [...question.correct].sort();
    
    return sortedSelection.every((val, index) => val === sortedCorrect[index]);
  }

  getUsername(): string {
    // Check if user is logged in using localStorage
    if (localStorage.getItem('currentUser')) {
      return this.loginService.userName;
    }
    return '';
  }

  setQuestionType() {
    if (!this.curQuestion) {
      return;
    } 
    this.multichoice = this.curQuestion.questionType === QuestionType.MultipleChoice;
    this.onechoice = this.curQuestion.questionType === QuestionType.SingleAnswer;
    this.truefalse = this.curQuestion.questionType === QuestionType.TrueFalse;
  }
}
