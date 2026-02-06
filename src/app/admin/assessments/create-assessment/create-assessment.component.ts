import { Component, OnInit, ViewChildren, QueryList, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AdminQuizService } from '@admin/services/admin-quiz.service';
import { QuestionType, QuestionTypeLabels } from '@models/quiz';

interface Answer {
  text: string;
  isCorrect: boolean;
}

interface Question {
  questionText: string;
  answers: Answer[];
  questionType: QuestionType | '';
  instructions: string;
}

@Component({
    selector: 'app-create-quiz',
    templateUrl: './create-assessment.component.html',
    styleUrls: ['./create-assessment.component.css'],
    standalone: false
})
export class CreateQuizComponent implements OnInit, AfterViewInit {
  quizTitle: string = '';
  questions: Question[] = [];
  
  // Expose QuestionType enum and labels to template
  QuestionType = QuestionType;
  QuestionTypeLabels = QuestionTypeLabels;
  questionTypes = Object.values(QuestionType);
  
  // Current question being edited
  currentQuestion: Question = {
    questionText: '',
    answers: [{ text: '', isCorrect: false }],
    questionType: '',
    instructions: ''
  };

  successMessage: string = '';
  errorMessage: string = '';
  isSubmitting: boolean = false;
  showCancelModal = false;

  constructor(
    private adminQuizService: AdminQuizService,
    private router: Router
  ) { }

  ngOnInit() {
  }
getInstructions(questionType: QuestionType): string {
    switch (questionType) {
      case QuestionType.TrueFalse:
        return 'Select the correct answer (True or False)';
      case QuestionType.MultipleChoice:
        return 'Select all correct answers';
      case QuestionType.SingleAnswer:
        return 'Select the correct answer';
      default:
        return 'Select the correct answer';
    }
  }

  onQuestionTypeChange() {
    if (this.currentQuestion.questionType) {
      this.currentQuestion.instructions = this.getInstructions(this.currentQuestion.questionType as QuestionType);
    } else {
      this.currentQuestion.instructions = '';
    }
  }

  
  @ViewChildren('answerInput') answerInputs!: QueryList<ElementRef>;
  @ViewChild('quizTitleInput') quizTitleInput!: ElementRef;

  ngAfterViewInit() {
    // Focus quiz title input on load
    if (this.quizTitleInput) {
      setTimeout(() => {
        this.quizTitleInput.nativeElement.focus();
      });
    }
    this.answerInputs.changes.subscribe(() => {
      this.focusLastAnswerInput();
    });
  }

  focusLastAnswerInput() {
    if (this.answerInputs && this.answerInputs.length > 0) {
      setTimeout(() => {
        const lastInput = this.answerInputs.last;
        if (lastInput) {
          lastInput.nativeElement.focus();
        }
      });
    }
  }

  addAnswer() {
    this.currentQuestion.answers.push({ text: '', isCorrect: false });
    // focus will be handled by ViewChildren changes
  }

  removeAnswer(index: number) {
    if (this.currentQuestion.answers.length > 1) {
      this.currentQuestion.answers.splice(index, 1);
    }
  }

  addQuestion() {
    // Validate current question
    if (!this.currentQuestion.questionText.trim()) {
      this.errorMessage = 'Please enter a question text';
      return;
    }

    // Check if all answers have text
    const hasEmptyAnswers = this.currentQuestion.answers.some(a => !a.text.trim());
    if (hasEmptyAnswers) {
      this.errorMessage = 'Please fill in all answer options';
      return;
    }

    // Ensure at least 2 answers
    const validAnswers = this.currentQuestion.answers.filter(a => a.text.trim() !== '');
    if (validAnswers.length < 2) {
      this.errorMessage = 'Each question must have at least 2 answers';
      return;
    }

    // Check if at least one answer is marked as correct
    const hasCorrectAnswer = this.currentQuestion.answers.some(a => a.isCorrect);
    if (!hasCorrectAnswer) {
      this.errorMessage = 'Please select at least one correct answer';
      return;
    }

    // Add question to list
    this.questions.push({ ...this.currentQuestion });
    
    this.errorMessage = '';
    this.successMessage = `Question ${this.questions.length} saved! Form cleared for next question.`;
    setTimeout(() => this.successMessage = '', 3000);
    
    // Clear the form immediately for the next question
    this.currentQuestion = {
      questionText: '',
      answers: [{ text: '', isCorrect: false }],
      questionType: '',
      instructions: ''
    };
  }

  removeQuestion(index: number) {
    this.questions.splice(index, 1);
  }

  editQuestion(index: number) {
    this.currentQuestion = { ...this.questions[index] };
    this.questions.splice(index, 1);
  }

  saveQuiz() {
    // Validate quiz
    if (!this.quizTitle.trim()) {
      this.errorMessage = 'Please enter an assessment title';
      return;
    }

    if (this.questions.length === 0) {
      this.errorMessage = 'Please add at least one question';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    // Format quiz data for backend
    const quizData = {
      title: this.quizTitle,
      questions: this.questions.map((q, index) => ({
        questionNum: index,
        questionType: q.questionType,
        instructions: q.instructions,
        question: q.questionText,
        answers: q.answers.map(a => a.text),
        correct: q.answers
          .map((a, i) => a.isCorrect ? i + 1 : -1)
          .filter(i => i !== -1)
      }))
    };

    // Save quiz
    this.adminQuizService.uploadQuiz(quizData).subscribe({
      next: (_response) => {
        this.successMessage = 'Assessment created successfully!';
        setTimeout(() => {
          this.router.navigate(['/admin/quizzes']);
        }, 2000);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Error creating assessment';
        this.isSubmitting = false;
      }
    });
  }

  cancelQuiz() {
    this.showCancelModal = true;
  }
  onCancelModalConfirm() {
    this.showCancelModal = false;
    this.router.navigate(['/admin']);
  }
  onCancelModalDismiss() {
    this.showCancelModal = false;
  }
}
