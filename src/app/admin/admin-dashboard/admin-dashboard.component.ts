import { Component, OnInit } from '@angular/core';
import { AdminUserService } from '@admin/services/admin-user.service';
import { AdminQuizService } from '@admin/services/admin-quiz.service';
import { LoggerService } from '@core/services/logger.service';

@Component({
    selector: 'app-admin-dashboard',
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.css'],
    standalone: false
})
export class AdminDashboardComponent implements OnInit {
  loading: boolean = true;
  totalUsers: number = 0;
  totalAdmins: number = 0;
  totalStudents: number = 0;
  totalQuizzes: number = 0;
  totalQuizAttempts: number = 0;

  constructor(
    private adminUserService: AdminUserService,
    private adminQuizService: AdminQuizService,
    private logger: LoggerService
  ) { }

  ngOnInit() {
    this.loadDashboardStats();
  }

  loadDashboardStats(): void {
    this.loading = true;
    
    // Load users
    this.adminUserService.getAllUsers().subscribe({
      next: (users) => {
        this.totalUsers = users.length;
        this.totalAdmins = users.filter(u => u.type === 'admin').length;
        this.totalStudents = users.filter(u => u.type !== 'admin').length;
        this.totalQuizAttempts = users.reduce((sum, user) => sum + (user.quizzes?.length || 0), 0);
        this.loading = false;
      },
      error: (error) => {
        this.logger.error('Error loading dashboard stats', error);
        this.loading = false;
      }
    });

    // Load quizzes
    this.adminQuizService.getAvailableQuizzes().subscribe({
      next: (quizzes) => {
        this.totalQuizzes = quizzes.length;
      },
      error: (error) => {
        this.logger.error('Error loading quizzes', error);
      }
    });
  }
}
