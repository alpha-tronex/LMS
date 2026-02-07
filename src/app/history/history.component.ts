import { Component, OnInit } from '@angular/core';
import { QuestionsService } from '@core/services/questions-service';
import { LoginService } from '@core/services/login-service';
import { LoggerService } from '@core/services/logger.service';

@Component({
    selector: 'app-history',
    templateUrl: './history.component.html',
    styleUrls: ['./history.component.css'],
    standalone: false
})
export class HistoryComponent implements OnInit {
  assessments: any[] = [];
  username: string = '';
  loading: boolean = true;
  error: string = '';

  constructor(
    private questionsService: QuestionsService,
    private loginService: LoginService,
    private logger: LoggerService
  ) {}

  ngOnInit() {
    // Check if user is logged in using localStorage
    if (localStorage.getItem('currentUser')) {
      this.username = this.loginService.userName;
      if (this.username) {
        this.loadAssessmentHistory();
      } else {
        this.error = 'Unable to retrieve user information';
        this.loading = false;
      }
    } else {
      this.error = 'Please login to view your assessment history';
      this.loading = false;
    }
  }

  loadAssessmentHistory() {
    this.questionsService.getQuizHistory(this.username).subscribe({
      next: (data) => {
        this.assessments = data.assessments || [];
        this.loading = false;
      },
      error: (error) => {
        this.logger.error('Error loading assessment history', error);
        this.error = 'Failed to load assessment history';
        this.loading = false;
      }
    });
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds < 0) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}
