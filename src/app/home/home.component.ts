import { Component, OnDestroy, OnInit } from '@angular/core';
// import { BehaviorSubject, Observable } from 'rxjs';
import { LoginService } from '@core/services/login-service';
import { QuestionsService } from '@core/services/questions-service';
import { Router } from '@angular/router';
import { LoggerService } from '@core/services/logger.service';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    standalone: false
})
export class HomeComponent implements OnInit, OnDestroy {
  subscription: any;
  studentLoggedIn: any;
  quizzes: any[] = [];
  selectedQuizId: number | null = null;
  selectedQuizTitle: string = '';
  inputWidth: string = '300px';
  
  // Dashboard stats
  totalQuizzes: number = 0;
  completedQuizzes: number = 0;
  averageScore: number = 0;
  recentQuizzes: any[] = [];
  loadingStats: boolean = false;

  constructor(
    private loginService: LoginService,
    private questionsService: QuestionsService,
    private router: Router,
    private logger: LoggerService
  ) { }

  ngOnInit() {
    if (!this.loginService.userName) {
      //this.loginService.loggedInStudentChange.next(null);
    }

    // Load available assessments
    this.questionsService.getAvailableQuizzes().subscribe({
      next: (data) => {
        this.quizzes = data;
        this.totalQuizzes = data.length;
        
        // Load user stats if logged in
        if (this.getUsername()) {
          this.loadUserStats();
        }
      },
      error: (error) => {
        this.logger.error('Error loading assessments', error);
      }
    });
  }

  loadUserStats() {
    this.loadingStats = true;
    const username = this.getUsername();
    
    this.questionsService.getQuizHistory(username).subscribe({
      next: (data) => {
        const quizzes = data.quizzes || [];
        this.completedQuizzes = quizzes.length;
        
        // Calculate average score
        if (quizzes.length > 0) {
          const totalScore = quizzes.reduce((sum: number, quiz: any) => {
            const percentage = (quiz.score / quiz.totalQuestions) * 100;
            return sum + percentage;
          }, 0);
          this.averageScore = Math.round(totalScore / quizzes.length);
        }
        
        // Get recent assessments (last 3)
        this.recentQuizzes = quizzes
          .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
          .slice(0, 3)
          .map((quiz: any) => ({
            title: quiz.title,
            score: quiz.score,
            totalQuestions: quiz.totalQuestions,
            percentage: Math.round((quiz.score / quiz.totalQuestions) * 100),
            completedAt: new Date(quiz.completedAt)
          }));
        
        this.loadingStats = false;
      },
      error: (error) => {
        this.logger.error('Error loading user stats', error);
        this.loadingStats = false;
      }
    });
  }

  startQuiz(quizId: number) {
    try {
      this.router.navigate(['/questions'], { queryParams: { id: quizId } });
    } catch (error) {
      this.logger.error('Error starting assessment', error);
    }
  }

  onQuizSelect() {
    // Optional: Could add logic here when selection changes
  }

  onQuizInput() {
    // Find quiz by title as user types
    const quiz = this.quizzes.find(q => q.title === this.selectedQuizTitle);
    if (quiz) {
      this.selectedQuizId = quiz.id;
    } else {
      this.selectedQuizId = null;
    }
    // Calculate width based on text length
    this.calculateInputWidth();
  }

  calculateInputWidth() {
    if (!this.selectedQuizTitle) {
      this.inputWidth = '300px';
      return;
    }
    // Estimate width: roughly 8-10px per character for typical fonts
    // Add padding and some extra space
    const charWidth = 9;
    const padding = 40; // Account for padding and borders
    const minWidth = 300;
    const maxWidth = 800;
    
    const calculatedWidth = Math.max(minWidth, Math.min(maxWidth, this.selectedQuizTitle.length * charWidth + padding));
    this.inputWidth = calculatedWidth + 'px';
  }

  isValidQuizSelected(): boolean {
    return this.selectedQuizId !== null;
  }

  startSelectedQuiz() {
    if (this.selectedQuizId !== null) {
      this.startQuiz(this.selectedQuizId);
    }
  }

  getUsername(): string {
    // Check if user is logged in using localStorage
    if (localStorage.getItem('currentUser')) {
      return this.loginService.userName;
    }
    return '';
  }

  ngOnDestroy(): void {
    // if (this.subscription) {
    //   this.subscription.unsubscribe();
    // }
  }
}
