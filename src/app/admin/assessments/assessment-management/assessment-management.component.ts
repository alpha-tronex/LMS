import { Component, OnInit } from '@angular/core';
import { AdminUserService } from '@admin/services/admin-user.service';
import { AdminQuizService } from '@admin/services/admin-quiz.service';
import { LoggerService } from '@core/services/logger.service';

@Component({
    selector: 'app-quiz-management',
  templateUrl: './assessment-management.component.html',
  styleUrls: ['./assessment-management.component.css'],
    standalone: false
})
export class QuizManagementComponent implements OnInit {
  users: any[] = [];
  selectedUserId: string = '';
  quizzes: any[] = [];
  selectedQuizId: string = '';
  selectedEditQuizId: string = '';
  loading: boolean = false;
  message: string = '';
  messageType: 'success' | 'error' | '' = '';

  // Properties for specific quiz deletion from user
  selectedUserIdForSpecificQuiz: string = '';
  selectedUserQuizId: string = '';
  userQuizzes: any[] = [];

  // Confirmation modal properties
  private confirmModalInstance: any = null;
  confirmAction: 'deleteUserQuiz' | 'deleteAllUserQuizzes' | 'deleteSpecificUserQuiz' | 'deleteQuizFile' | 'deleteAllQuizFiles' | null = null;
  confirmTitle: string = '';
  confirmMessage: string = '';

  public showConfirmModal: boolean = false;

  constructor(
    private adminUserService: AdminUserService,
    private adminQuizService: AdminQuizService,
    private logger: LoggerService
  ) { }

  ngOnInit() {
    this.loadUsers();
    this.loadQuizFiles();
  }

  loadUsers(): void {
    this.adminUserService.getAllUsers().subscribe({
      next: (data) => {
        this.users = data;
      },
      error: (error) => {
        this.logger.error('Error loading users', error);
        this.showMessage('Failed to load users', 'error');
      }
    });
  }

  loadQuizFiles(): void {
    // This will load available assessment files from the server
    // We'll need to add an endpoint to list assessment files
    this.adminQuizService.getAvailableQuizzes().subscribe({
      next: (data) => {
        this.quizzes = data;
      },
      error: (error) => {
        this.logger.error('Error loading assessment files', error);
        this.showMessage('Failed to load assessment files', 'error');
      }
    });
  }

  // Section 1: Delete all assessment data from a specific user
  deleteUserQuizData(): void {
    if (!this.selectedUserId) {
      this.showMessage('Please select a user', 'error');
      return;
    }

    const user = this.users.find(u => u.id === this.selectedUserId);
    this.confirmAction = 'deleteUserQuiz';
    this.confirmTitle = 'Delete User Assessment Data';
    this.confirmMessage = `Are you sure you want to delete all assessment data for user "${user?.uname}"? This action cannot be undone.`;
    this.showConfirmModal = true;
  }

  private executeDeleteUserQuizData(): void {
    this.loading = true;
    this.adminUserService.deleteUserQuizData(this.selectedUserId).subscribe({
      next: () => {
        this.showMessage('User assessment data deleted successfully', 'success');
        this.loadUsers();
        this.selectedUserId = '';
        this.loading = false;
      },
      error: (error) => {
        this.logger.error('Error deleting user assessment data', error);
        this.showMessage('Failed to delete user assessment data: ' + error.message, 'error');
        this.loading = false;
      }
    });
  }

  // Section 2: Delete all assessment data from all users
  deleteAllUsersQuizData(): void {
    this.confirmAction = 'deleteAllUserQuizzes';
    this.confirmTitle = 'Delete All Assessment Data';
    this.confirmMessage = 'Are you sure you want to delete ALL assessment data from ALL users? This action cannot be undone.';
    this.showConfirmModal = true;
  }

  // Handle user selection for specific quiz deletion
  onUserSelectForSpecificQuiz(): void {
    this.selectedUserQuizId = '';
    this.userQuizzes = [];
    
    if (this.selectedUserIdForSpecificQuiz) {
      const user = this.users.find(u => u.id === this.selectedUserIdForSpecificQuiz);
      if (user && user.quizzes) {
        this.userQuizzes = user.quizzes;
      }
    }
  }

  // Section 3: Delete specific assessment from specific user
  deleteSpecificUserQuiz(): void {
    if (!this.selectedUserIdForSpecificQuiz || !this.selectedUserQuizId) {
      this.showMessage('Please select both user and assessment', 'error');
      return;
    }

    const user = this.users.find(u => u.id === this.selectedUserIdForSpecificQuiz);
    const quiz = this.userQuizzes.find(q => q._id === this.selectedUserQuizId);
    
    this.confirmAction = 'deleteSpecificUserQuiz';
    this.confirmTitle = 'Delete Specific Assessment Entry';
    this.confirmMessage = `Are you sure you want to delete the assessment "${quiz?.title}" from user "${user?.uname}"? This action cannot be undone.`;
    this.showConfirmModal = true;
  }

  private executeDeleteSpecificUserQuiz(): void {
    this.loading = true;
    this.adminUserService.deleteSpecificUserQuiz(this.selectedUserIdForSpecificQuiz, this.selectedUserQuizId).subscribe({
      next: () => {
        this.showMessage('Assessment entry deleted successfully', 'success');
        this.loadUsers();
        this.selectedUserIdForSpecificQuiz = '';
        this.selectedUserQuizId = '';
        this.userQuizzes = [];
        this.loading = false;
      },
      error: (error) => {
        this.logger.error('Error deleting specific assessment', error);
        this.showMessage('Failed to delete assessment entry: ' + error.message, 'error');
        this.loading = false;
      }
    });
  }

  private executeDeleteAllUsersQuizData(): void {
    this.loading = true;
    this.adminQuizService.deleteAllUsersQuizData().subscribe({
      next: () => {
        this.showMessage('All user assessment data deleted successfully', 'success');
        this.loadUsers();
        this.loading = false;
      },
      error: (error) => {
        this.logger.error('Error deleting all user assessment data', error);
        this.showMessage('Failed to delete all user assessment data: ' + error.message, 'error');
        this.loading = false;
      }
    });
  }

  // Section 3: Delete a specific assessment file
  deleteQuizFile(): void {
    if (!this.selectedQuizId) {
      this.showMessage('Please select an assessment', 'error');
      return;
    }

    const quiz = this.quizzes.find(q => q.id === parseInt(this.selectedQuizId));
    this.confirmAction = 'deleteQuizFile';
    this.confirmTitle = 'Delete Assessment File';
    this.confirmMessage = `Are you sure you want to delete the assessment file "${quiz?.title}"? This action cannot be undone and users will no longer be able to take this assessment.`;
    this.showConfirmModal = true;
  }

  // Delete assessment file from list (with ID directly)
  deleteQuizFileFromList(quizId: number): void {
    const quiz = this.quizzes.find(q => q.id === quizId);
    this.selectedQuizId = quizId.toString();
    this.confirmAction = 'deleteQuizFile';
    this.confirmTitle = 'Delete Assessment File';
    this.confirmMessage = `Are you sure you want to delete the assessment file "${quiz?.title}"? This action cannot be undone and users will no longer be able to take this assessment.`;
    this.showConfirmModal = true;
  }

  private executeDeleteQuizFile(): void {
    this.loading = true;
    this.adminQuizService.deleteQuizFile(this.selectedQuizId).subscribe({
      next: () => {
        this.showMessage('Assessment file deleted successfully', 'success');
        this.loadQuizFiles();
        this.selectedQuizId = '';
        this.loading = false;
      },
      error: (error) => {
        this.logger.error('Error deleting assessment file', error);
        this.showMessage('Failed to delete assessment file: ' + error.message, 'error');
        this.loading = false;
      }
    });
  }

  // Section 4: Delete all assessment files
  deleteAllQuizFiles(): void {
    this.confirmAction = 'deleteAllQuizFiles';
    this.confirmTitle = 'Delete All Assessment Files';
    this.confirmMessage = 'Are you sure you want to delete ALL assessment files? This action cannot be undone and users will no longer be able to take any assessments.';
    this.showConfirmModal = true;
  }

  private executeDeleteAllQuizFiles(): void {
    this.loading = true;
    this.adminQuizService.deleteAllQuizFiles().subscribe({
      next: () => {
        this.showMessage('All assessment files deleted successfully', 'success');
        this.loadQuizFiles();
        this.loading = false;
      },
      error: (error) => {
        this.logger.error('Error deleting all assessment files', error);
        this.showMessage('Failed to delete all assessment files: ' + error.message, 'error');
        this.loading = false;
      }
    });
  }

  // Helper methods
  private showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
    setTimeout(() => {
      this.message = '';
      this.messageType = '';
    }, 5000);
  }

  getUserDisplayName(user: any): string {
    const name = `${user.fname || ''} ${user.lname || ''}`.trim();
    return name ? `${user.uname} (${name})` : user.uname;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmAction = null;
    this.confirmTitle = '';
    this.confirmMessage = '';
  }

  confirmActionExecute(): void {
    switch (this.confirmAction) {
      case 'deleteUserQuiz':
        this.executeDeleteUserQuizData();
        break;
      case 'deleteAllUserQuizzes':
        this.executeDeleteAllUsersQuizData();
        break;
      case 'deleteSpecificUserQuiz':
        this.executeDeleteSpecificUserQuiz();
        break;
      case 'deleteQuizFile':
        this.executeDeleteQuizFile();
        break;
      case 'deleteAllQuizFiles':
        this.executeDeleteAllQuizFiles();
        break;
    }
    this.closeConfirmModal();
  }

  formatQuizDate(date: any): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
