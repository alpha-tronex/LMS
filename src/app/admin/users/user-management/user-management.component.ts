import { Component, OnInit } from '@angular/core';
import { User } from '@models/users';
import { AdminUserService } from '@admin/services/admin-user.service';
import { LoginService } from '@core/services/login-service';
import { LoggerService } from '@core/services/logger.service';
import { UserRole } from '@models/user-role';

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
  confirmAction: 'promote' | 'delete' | 'changeRole' | null = null;
  confirmUser: User | null = null;
  pendingRole: UserRole | null = null;
  confirmMessage: string = '';
  confirmTitle: string = '';

  private roleSelectEl: HTMLSelectElement | null = null;
  private roleSelectPrevValue: string | null = null;

  // Dashboard statistics
  get totalUsers(): number {
    return this.users.length;
  }

  get totalAdmins(): number {
    return this.users.filter(u => u.role === 'admin').length;
  }

  get totalInstructors(): number {
    return this.users.filter(u => u.role === 'instructor').length;
  }

  get totalStudents(): number {
    return this.users.filter(u => u.role === 'student' || !u.role).length;
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
    const currentUserRaw = localStorage.getItem('currentUser');
    if (!currentUserRaw) {
      this.errorMessage = 'Please login as an admin to manage users.';
      this.loading = false;
      return;
    }

    try {
      const parsed = JSON.parse(currentUserRaw);
      if (!parsed || parsed.role !== 'admin') {
        this.errorMessage = 'Access denied. Admin privileges required.';
        this.loading = false;
        return;
      }
    } catch {
      this.errorMessage = 'Unable to read current user. Please login again.';
      this.loading = false;
      return;
    }

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

    const currentRole: UserRole = user.role || UserRole.Student;
    const newRole: UserRole = currentRole === UserRole.Admin ? UserRole.Student : UserRole.Admin;
    const action = newRole === UserRole.Admin ? 'promote to administrator' : 'demote to student';
    
    // Prevent admin from demoting themselves
    const currentUser = this.loginService.user;
    if (currentUser && currentUser.id === user.id && currentRole === UserRole.Admin && newRole === UserRole.Student) {
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

  onRoleSelectChange(user: User, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const newRoleRaw = target.value;

    const currentRole: UserRole = user.role || UserRole.Student;
    if (!newRoleRaw || newRoleRaw === currentRole) {
      target.value = currentRole;
      return;
    }

    // Preserve the previous selection so we can revert if the admin cancels.
    this.roleSelectEl = target;
    this.roleSelectPrevValue = currentRole;

    const newRole = newRoleRaw as UserRole;
    this.requestRoleChange(user, newRole);
  }

  private requestRoleChange(user: User, newRole: UserRole): void {
    if (!user || !user.id) {
      return;
    }

    const currentRole: UserRole = user.role || UserRole.Student;

    const currentUser = this.loginService.user;
    if (currentUser && currentUser.id === user.id && currentRole === UserRole.Admin && newRole !== UserRole.Admin) {
      this.confirmUser = user;
      this.confirmAction = null; // Informational only
      this.confirmTitle = 'Cannot Demote Yourself';
      this.confirmMessage = 'You cannot remove your own administrator privileges while logged in.';
      this.showConfirmModal = true;
      return;
    }

    this.pendingRole = newRole;
    this.confirmUser = user;
    this.confirmAction = 'changeRole';
    this.confirmTitle = 'Change User Role';
    this.confirmMessage = `Are you sure you want to change user "${user.uname}" to role "${newRole}"?`;
    this.showConfirmModal = true;
  }

  private executePromote(): void {
    if (!this.confirmUser || !this.confirmUser.id) {
      return;
    }

    const currentRole: UserRole = this.confirmUser.role || UserRole.Student;
    const newRole: UserRole = currentRole === UserRole.Admin ? UserRole.Student : UserRole.Admin;
    
    this.adminUserService.updateUserRole(this.confirmUser.id, newRole).subscribe({
      next: (_updatedUser) => {
        // Update the selected user
        if (this.selectedUser && this.selectedUser.id === this.confirmUser!.id) {
          this.selectedUser.role = newRole;
        }
        
        // Update the user in the users array
        const userIndex = this.users.findIndex(u => u.id === this.confirmUser!.id);
        if (userIndex !== -1) {
          this.users[userIndex].role = newRole;
        }
        
        this.logger.info('User type updated successfully');
      },
      error: (error) => {
        this.logger.error('Error updating user type', error);
        alert('Failed to update user role: ' + error);
      }
    });
  }

  private executeRoleChange(): void {
    if (!this.confirmUser || !this.confirmUser.id || !this.pendingRole) {
      return;
    }

    const newRole = this.pendingRole;

    this.adminUserService.updateUserRole(this.confirmUser.id, newRole).subscribe({
      next: (_updatedUser) => {
        if (this.selectedUser && this.selectedUser.id === this.confirmUser!.id) {
          this.selectedUser.role = newRole;
        }

        const userIndex = this.users.findIndex(u => u.id === this.confirmUser!.id);
        if (userIndex !== -1) {
          this.users[userIndex].role = newRole;
        }

        // If the updated user is the currently logged-in user, keep localStorage/LoginService in sync.
        const currentUser = this.loginService.user;
        if (currentUser && currentUser.id === this.confirmUser!.id) {
          this.loginService.user = { ...currentUser, role: newRole };
          try {
            const raw = localStorage.getItem('currentUser');
            if (raw) {
              const parsed = JSON.parse(raw);
              localStorage.setItem('currentUser', JSON.stringify({ ...parsed, role: newRole }));
            }
          } catch {
            // ignore localStorage parse errors
          }
        }

        this.logger.info('User role updated successfully');
      },
      error: (error) => {
        this.logger.error('Error updating user role', error);
        alert('Failed to update user role: ' + error);
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

  closeConfirmModal(revertRoleSelect: boolean = true): void {
    if (revertRoleSelect && this.roleSelectEl && this.roleSelectPrevValue !== null) {
      this.roleSelectEl.value = this.roleSelectPrevValue;
    }

    this.showConfirmModal = false;
    // Reset confirmation state
    this.confirmAction = null;
    this.confirmUser = null;
    this.pendingRole = null;
    this.confirmMessage = '';
    this.confirmTitle = '';

    this.roleSelectEl = null;
    this.roleSelectPrevValue = null;
  }

  confirmActionExecute(): void {
    if (this.confirmAction === 'promote') {
      this.executePromote();
    } else if (this.confirmAction === 'delete') {
      this.executeDelete();
    } else if (this.confirmAction === 'changeRole') {
      this.executeRoleChange();
    }
    // Don't revert the role dropdown on successful confirmation.
    this.closeConfirmModal(false);
  }

  getConfirmButtonClass(): string {
    return this.confirmAction === 'delete' ? 'btn-danger' : 'btn-primary';
  }

  getConfirmButtonText(): string {
    if (this.confirmAction === 'delete') return 'Delete';
    if (this.confirmAction === 'changeRole') return 'Update Role';
    return 'Confirm';
  }

}
