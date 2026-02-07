import { Component, OnInit } from '@angular/core';
import { User } from '@models/users';
import { AdminUserService } from '@admin/services/admin-user.service';
import { LoginService } from '@core/services/login-service';
import { LoggerService } from '@core/services/logger.service';

@Component({
    selector: 'app-user-management',
    templateUrl: './user-management.component.html',
    styleUrls: ['./user-management.component.css'],
    standalone: false
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  selectedUser: User | null = null;
  loading: boolean = false;
  errorMessage: string = '';
  reviewedQuiz: any = null;
  private modalInstance: any = null;
  // private confirmModalInstance: any = null;
    showConfirmModal: boolean = false;
  confirmAction: 'promote' | 'delete' | null = null;
  confirmUser: User | null = null;
  confirmMessage: string = '';
  confirmTitle: string = '';

  // Dashboard statistics
  get totalUsers(): number {
    return this.users.length;
  }

  get totalAdmins(): number {
    return this.users.filter(u => u.type === 'admin').length;
  }

  get totalStudents(): number {
    return this.users.filter(u => u.type === 'student' || !u.type).length;
  }

  get totalQuizzesTaken(): number {
    return this.users.reduce((sum, user) => sum + (user.assessments?.length || 0), 0);
  }

  constructor(
    private adminUserService: AdminUserService,
    private loginService: LoginService,
    private logger: LoggerService
  ) { }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.adminUserService.getAllUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: (error) => {
        this.logger.error('Error loading users', error);
        this.errorMessage = 'Failed to load users. Please try again.';
        this.loading = false;
      }
    });
  }

  onUserSelect(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const userId = target.value;
    
    if (userId) {
      this.selectedUser = this.users.find(u => u.id === userId) || null;
    } else {
      this.selectedUser = null;
    }
  }

  getUserDisplayName(user: User): string {
    const name = `${user.fname || ''} ${user.lname || ''}`.trim();
    return name ? `${user.uname} (${name})` : user.uname;
  }

  changeUserType(user: User): void {
    if (!user || !user.id) {
      return;
    }

    const currentType = user.type || 'student';
    const newType = currentType === 'admin' ? 'student' : 'admin';
    const action = newType === 'admin' ? 'promote to administrator' : 'demote to student';
    
    // Prevent admin from demoting themselves
    const currentUser = this.loginService.user;
    if (currentUser && currentUser.id === user.id && currentType === 'admin' && newType === 'student') {
      this.confirmUser = user;
      this.confirmAction = null; // Informational only
      this.confirmTitle = 'Cannot Demote Yourself';
      this.confirmMessage = 'You cannot demote your own account from administrator while logged in.';
      this.showConfirmModal = true;
      return;
    }
    
    this.confirmUser = user;
    this.confirmAction = 'promote';
    this.confirmTitle = 'Change User Type';
    this.confirmMessage = `Are you sure you want to ${action} user "${user.uname}"?`;
    this.showConfirmModal = true;
  }

  private executePromote(): void {
    if (!this.confirmUser || !this.confirmUser.id) {
      return;
    }

    const currentType = this.confirmUser.type || 'student';
    const newType = currentType === 'admin' ? 'student' : 'admin';
    
    this.adminUserService.updateUserType(this.confirmUser.id, newType).subscribe({
      next: (_updatedUser) => {
        // Update the selected user
        if (this.selectedUser && this.selectedUser.id === this.confirmUser!.id) {
          this.selectedUser.type = newType;
        }
        
        // Update the user in the users array
        const userIndex = this.users.findIndex(u => u.id === this.confirmUser!.id);
        if (userIndex !== -1) {
          this.users[userIndex].type = newType;
        }
        
        this.logger.info('User type updated successfully');
      },
      error: (error) => {
        this.logger.error('Error updating user type', error);
        alert('Failed to update user type: ' + error);
      }
    });
  }

  deleteUser(user: User): void {
    if (!user || !user.id) {
      return;
    }

    // Prevent user from deleting themselves
    const currentUser = this.loginService.user;
    if (currentUser && currentUser.id === user.id) {
      this.confirmUser = user;
      this.confirmAction = null; // No action, just informational
      this.confirmTitle = 'Cannot Delete Account';
      this.confirmMessage = 'You cannot delete your own account while logged in.';
      this.showConfirmModal = true;
      return;
    }

    this.confirmUser = user;
    this.confirmAction = 'delete';
    this.confirmTitle = 'Delete User';
    this.confirmMessage = `Are you sure you want to delete user "${user.uname}"?`;
    this.showConfirmModal = true;
  }

  private executeDelete(): void {
    if (!this.confirmUser || !this.confirmUser.id) {
      return;
    }

    this.adminUserService.deleteUser(this.confirmUser.id).subscribe({
      next: () => {
        // Remove user from the list
        this.users = this.users.filter(u => u.id !== this.confirmUser!.id);
        
        // Clear selected user if it was the deleted one
        if (this.selectedUser && this.selectedUser.id === this.confirmUser!.id) {
          this.selectedUser = null;
        }
        
        alert('User deleted successfully');
      },
      error: (error) => {
        this.logger.error('Error deleting user', error);
        alert('Failed to delete user: ' + error);
      }
    });
  }

  formatDate(date: any): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getScoreBadgeClass(score: number, total: number): string {
    if (!total) return 'bg-secondary';
    const percentage = (score / total) * 100;
    if (percentage >= 80) return 'bg-success';
    if (percentage >= 60) return 'bg-warning';
    return 'bg-danger';
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

  reviewQuiz(quiz: any): void {
    this.reviewedQuiz = quiz;
    
    // Use Bootstrap's modal API to show the modal
    const modalElement = document.getElementById('quizReviewModal');
    if (modalElement) {
      // Dispose of existing instance if any
      if (this.modalInstance) {
        this.modalInstance.dispose();
      }
      this.modalInstance = new (window as any).bootstrap.Modal(modalElement);
      this.modalInstance.show();
    }
  }

  closeModal(): void {
    if (this.modalInstance) {
      this.modalInstance.hide();
    }
  }

  getAnswerText(question: any, answerNum: number): string {
    if (!question.answers || answerNum < 1 || answerNum > question.answers.length) {
      return 'N/A';
    }
    return question.answers[answerNum - 1];
  }

  // showConfirmModal is now a boolean property controlling modal visibility

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    // Reset confirmation state
    this.confirmAction = null;
    this.confirmUser = null;
    this.confirmMessage = '';
    this.confirmTitle = '';
  }

  confirmActionExecute(): void {
    if (this.confirmAction === 'promote') {
      this.executePromote();
    } else if (this.confirmAction === 'delete') {
      this.executeDelete();
    }
    this.closeConfirmModal();
  }

  getConfirmButtonClass(): string {
    return this.confirmAction === 'delete' ? 'btn-danger' : 'btn-primary';
  }

  getConfirmButtonText(): string {
    return this.confirmAction === 'delete' ? 'Delete' : 'Confirm';
  }

}
