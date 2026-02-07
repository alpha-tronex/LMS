import { Component, OnInit, ViewChildren, QueryList, ElementRef, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminQuizService } from '@admin/services/admin-quiz.service';
import { QuestionsService } from '@core/services/questions-service';
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
    selector: 'app-edit-assessment',
  templateUrl: './edit-assessment.component.html',
  styleUrls: ['./edit-assessment.component.css'],
    standalone: false
})
export class EditAssessmentComponent implements OnInit, AfterViewInit {
  assessmentId: number = 0;
  assessmentTitle: string = '';
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
  editingIndex: number | null = null;

  successMessage: string = '';
  errorMessage: string = '';
  isSubmitting: boolean = false;
  isLoading: boolean = true;
  showCancelModal = false;
  showDeleteModal = false;
  pendingDeleteIndex: number | null = null;

  @ViewChildren('answerInput') answerInputs!: QueryList<ElementRef>;
  @ViewChild('assessmentTitleInput') assessmentTitleInput!: ElementRef;

  private focusAnswerInputOnNextChange = false;

  constructor(
    private adminQuizService: AdminQuizService,
    private questionsService: QuestionsService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  private scrollToTop() {
    if (typeof window === 'undefined') {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    // Fallbacks for older browser behaviors
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.assessmentId = +params['id']; // Convert string to number
      this.scrollToTop();
      this.loadQuiz();
    });
  }

  ngAfterViewInit() {
    this.scrollToTop();
    // Focus quiz title input on load
    if (this.assessmentTitleInput) {
      setTimeout(() => {
        this.assessmentTitleInput.nativeElement.focus();
      });
    }

    // Only focus the last answer input when an action (like Add Answer)
    // intentionally triggers it; don't do it on initial render/load.
    this.answerInputs.changes.subscribe(() => {
      if (!this.focusAnswerInputOnNextChange) {
        return;
      }
      this.focusAnswerInputOnNextChange = false;
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

  loadQuiz() {
    this.isLoading = true;
    this.questionsService.getQuiz(this.assessmentId).subscribe({
      next: (quiz) => {
        this.assessmentTitle = quiz.title;
        this.questions = quiz.questions.map((q: any) => ({
          questionText: q.question,
          answers: q.answers.map((answer: string, index: number) => ({
            text: answer,
            isCorrect: q.correct.includes(index + 1)
          })),
          questionType: q.questionType,
          instructions: q.instructions
        }));
        this.isLoading = false;
        this.cdr.detectChanges();

        this.scrollToTop();

        setTimeout(() => {
          if (this.assessmentTitleInput) {
            this.assessmentTitleInput.nativeElement.focus();
          }
        });
      },
      error: (_error) => {
        this.errorMessage = 'Error loading assessment';
        this.isLoading = false;
      }
    });
  }

  getInstructions(questionType: QuestionType): string {
    if (!questionType || !this.questionTypes.includes(questionType as QuestionType)) {
      return '';
    }
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
    if (this.currentQuestion.questionType && this.questionTypes.includes(this.currentQuestion.questionType as QuestionType)) {
      this.currentQuestion.instructions = this.getInstructions(this.currentQuestion.questionType as QuestionType);
    } else {
      this.currentQuestion.instructions = '';
    }
  }

  addAnswer() {
    this.focusAnswerInputOnNextChange = true;
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

    if (this.editingIndex !== null) {
      // Update the question in place
      this.questions[this.editingIndex] = { ...this.currentQuestion };
      this.successMessage = `Question ${this.editingIndex + 1} updated!`;
      this.editingIndex = null;
    } else {
      // Add question to list
      this.questions.push({ ...this.currentQuestion });
      this.successMessage = `Question ${this.questions.length} saved! Form cleared for next question.`;
    }

    this.errorMessage = '';
    setTimeout(() => this.successMessage = '', 3000);

    // Clear the form immediately for the next question
    this.currentQuestion = {
      questionText: '',
      answers: [{ text: '', isCorrect: false }],
      questionType: '',
      instructions: ''
    };
  }

  openDeleteQuestionModal(index: number) {
    this.pendingDeleteIndex = index;
    this.showDeleteModal = true;
    this.cdr.detectChanges();
  }

  onDeleteModalConfirm() {
    if (this.pendingDeleteIndex === null) {
      this.showDeleteModal = false;
      return;
    }

    this.removeQuestion(this.pendingDeleteIndex);
    this.pendingDeleteIndex = null;
    this.showDeleteModal = false;
  }

  onDeleteModalDismiss() {
    this.pendingDeleteIndex = null;
    this.showDeleteModal = false;
  }

  get deleteModalContent(): string {
    if (this.pendingDeleteIndex === null) {
      return '';
    }
    const question = this.questions[this.pendingDeleteIndex];
    const questionText = question?.questionText ? `"${question.questionText}"` : 'this question';
    return `Are you sure you want to delete ${questionText}? This cannot be undone.`;
  }

  removeQuestion(index: number) {
    // Keep edit-in-place state consistent when questions shift
    if (this.editingIndex !== null) {
      if (this.editingIndex === index) {
        this.editingIndex = null;
        this.currentQuestion = {
          questionText: '',
          answers: [{ text: '', isCorrect: false }],
          questionType: '',
          instructions: ''
        };
      } else if (this.editingIndex > index) {
        this.editingIndex = this.editingIndex - 1;
      }
    }
    this.questions.splice(index, 1);
  }

  editQuestion(index: number) {
    this.currentQuestion = { ...this.questions[index] };
    this.editingIndex = index;
    // If questionType is missing or invalid, set to ''
    if (!this.currentQuestion.questionType || !this.questionTypes.includes(this.currentQuestion.questionType as QuestionType)) {
      this.currentQuestion.questionType = '';
    }
  }

  saveQuiz() {
    // Validate quiz
    if (!this.assessmentTitle.trim()) {
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
      id: this.assessmentId,
      title: this.assessmentTitle,
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

    // Update quiz
    this.adminQuizService.uploadQuiz(quizData).subscribe({
      next: (_response) => {
        this.successMessage = 'Assessment updated successfully!';
        setTimeout(() => {
          this.router.navigate(['/admin/assessment-management']);
        }, 2000);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Error updating assessment';
        this.isSubmitting = false;
      }
    });
  }

  cancelQuiz() {
    this.showCancelModal = true;
    this.cdr.detectChanges();
  }
  onCancelModalConfirm() {
    this.showCancelModal = false;
    this.router.navigate(['/admin/assessment-management']);
  }
  onCancelModalDismiss() {
    this.showCancelModal = false;
  }
}
