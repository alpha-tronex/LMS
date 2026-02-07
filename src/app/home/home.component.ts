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
  availableAssessments: any[] = [];
  selectedAssessmentId: number | null = null;
  selectedAssessmentTitle: string = '';
  inputWidth: string = '300px';
  
  // Dashboard stats
  totalAssessments: number = 0;
  completedAssessments: number = 0;
  averageScore: number = 0;
  recentAssessments: any[] = [];
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
        this.availableAssessments = data;
        this.totalAssessments = data.length;
        
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
        const assessments = data.assessments || [];
        this.completedAssessments = assessments.length;
        
        // Calculate average score
        if (assessments.length > 0) {
          const totalScore = assessments.reduce((sum: number, assessment: any) => {
            const percentage = (assessment.score / assessment.totalQuestions) * 100;
            return sum + percentage;
          }, 0);
          this.averageScore = Math.round(totalScore / assessments.length);
        }
        
        // Get recent assessments (last 3)
        this.recentAssessments = assessments
          .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
          .slice(0, 3)
          .map((assessment: any) => ({
            title: assessment.title,
            score: assessment.score,
            totalQuestions: assessment.totalQuestions,
            percentage: Math.round((assessment.score / assessment.totalQuestions) * 100),
            completedAt: new Date(assessment.completedAt)
          }));
        
        this.loadingStats = false;
      },
      error: (error) => {
        this.logger.error('Error loading user stats', error);
        this.loadingStats = false;
      }
    });
  }

  startAssessment(assessmentId: number) {
    try {
      this.router.navigate(['/questions'], { queryParams: { id: assessmentId } });
    } catch (error) {
      this.logger.error('Error starting assessment', error);
    }
  }

  onAssessmentSelect() {
    // Optional: Could add logic here when selection changes
  }

  onAssessmentInput() {
    // Find assessment by title as user types
    const assessment = this.availableAssessments.find((a) => a.title === this.selectedAssessmentTitle);
    if (assessment) {
      this.selectedAssessmentId = assessment.id;
    } else {
      this.selectedAssessmentId = null;
    }
    // Calculate width based on text length
    this.calculateInputWidth();
  }

  calculateInputWidth() {
    if (!this.selectedAssessmentTitle) {
      this.inputWidth = '300px';
      return;
    }
    // Estimate width: roughly 8-10px per character for typical fonts
    // Add padding and some extra space
    const charWidth = 9;
    const padding = 40; // Account for padding and borders
    const minWidth = 300;
    const maxWidth = 800;
    
    const calculatedWidth = Math.max(minWidth, Math.min(maxWidth, this.selectedAssessmentTitle.length * charWidth + padding));
    this.inputWidth = calculatedWidth + 'px';
  }

  isValidAssessmentSelected(): boolean {
    return this.selectedAssessmentId !== null;
  }

  startSelectedAssessment() {
    if (this.selectedAssessmentId !== null) {
      this.startAssessment(this.selectedAssessmentId);
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
