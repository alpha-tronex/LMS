import { Component, OnInit } from '@angular/core';
import { AdminUserService } from '@admin/services/admin-user.service';
import { AdminAssessmentService } from '@admin/services/admin-assessment.service';
import { LoggerService } from '@core/services/logger.service';

@Component({
    selector: 'app-assessment-management',
  templateUrl: './assessment-management.component.html',
  styleUrls: ['./assessment-management.component.css'],
    standalone: false
})
export class AssessmentManagementComponent implements OnInit {
  isStrictAdmin = false;

  users: any[] = [];
  selectedUserId: string = '';
  assessmentFiles: any[] = [];
  selectedAssessmentFileId: string = '';
  selectedEditAssessmentFileId: string = '';
  loading: boolean = false;
  message: string = '';
  messageType: 'success' | 'error' | '' = '';

  // Properties for specific assessment deletion from user
  selectedUserIdForSpecificAssessment: string = '';
  selectedUserAssessmentId: string = '';
  userAssessments: any[] = [];

  // Confirmation modal properties
  private confirmModalInstance: any = null;
  confirmAction:
    | 'deleteUserAssessment'
    | 'deleteAllUserAssessments'
    | 'deleteSpecificUserAssessment'
    | 'deleteAssessmentFile'
    | 'deleteAllAssessmentFiles'
    | null = null;
  confirmTitle: string = '';
  confirmMessage: string = '';

  public showConfirmModal: boolean = false;

  constructor(
    private adminUserService: AdminUserService,
    private adminAssessmentService: AdminAssessmentService,
    private logger: LoggerService
  ) { }

  ngOnInit() {
    const currentUserRaw = localStorage.getItem('currentUser');
    if (currentUserRaw) {
      try {
        const parsed = JSON.parse(currentUserRaw);
        this.isStrictAdmin = !!parsed && parsed.role === 'admin';
      } catch {
        this.isStrictAdmin = false;
      }
    }

    if (this.isStrictAdmin) {
      this.loadUsers();
    }
    this.loadAssessmentFiles();
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

  loadAssessmentFiles(): void {
    // This will load available assessment files from the server
    // We'll need to add an endpoint to list assessment files
    this.adminAssessmentService.getAvailableAssessments().subscribe({
      next: (data) => {
        this.assessmentFiles = data;
      },
      error: (error) => {
        this.logger.error('Error loading assessment files', error);
        this.showMessage('Failed to load assessment files', 'error');
      }
    });
  }

  // Section 1: Delete all assessment data from a specific user
  deleteUserAssessmentData(): void {
    if (!this.selectedUserId) {
      this.showMessage('Please select a user', 'error');
      return;
    }

    const user = this.users.find(u => u.id === this.selectedUserId);
    this.confirmAction = 'deleteUserAssessment';
    this.confirmTitle = 'Delete User Assessment Data';
    this.confirmMessage = `Are you sure you want to delete all assessment data for user "${user?.uname}"? This action cannot be undone.`;
    this.showConfirmModal = true;
  }

  private executeDeleteUserAssessmentData(): void {
    this.loading = true;
    this.adminUserService.deleteUserAssessmentData(this.selectedUserId).subscribe({
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
  deleteAllUsersAssessmentData(): void {
    this.confirmAction = 'deleteAllUserAssessments';
    this.confirmTitle = 'Delete All Assessment Data';
    this.confirmMessage = 'Are you sure you want to delete ALL assessment data from ALL users? This action cannot be undone.';
    this.showConfirmModal = true;
  }

  // Handle user selection for specific assessment deletion
  onUserSelectForSpecificAssessment(): void {
    this.selectedUserAssessmentId = '';
    this.userAssessments = [];
    
    if (this.selectedUserIdForSpecificAssessment) {
      const user = this.users.find(u => u.id === this.selectedUserIdForSpecificAssessment);
      if (user && user.assessments) {
        this.userAssessments = user.assessments;
      }
    }
  }

  // Section 3: Delete specific assessment from specific user
  deleteSpecificUserAssessment(): void {
    if (!this.selectedUserIdForSpecificAssessment || !this.selectedUserAssessmentId) {
      this.showMessage('Please select both user and assessment', 'error');
      return;
    }

    const user = this.users.find(u => u.id === this.selectedUserIdForSpecificAssessment);
    const quiz = this.userAssessments.find(q => q._id === this.selectedUserAssessmentId);
    
    this.confirmAction = 'deleteSpecificUserAssessment';
    this.confirmTitle = 'Delete Specific Assessment Entry';
    this.confirmMessage = `Are you sure you want to delete the assessment "${quiz?.title}" from user "${user?.uname}"? This action cannot be undone.`;
    this.showConfirmModal = true;
  }

  private executeDeleteSpecificUserAssessment(): void {
    this.loading = true;
    this.adminUserService.deleteSpecificUserAssessment(this.selectedUserIdForSpecificAssessment, this.selectedUserAssessmentId).subscribe({
      next: () => {
        this.showMessage('Assessment entry deleted successfully', 'success');
        this.loadUsers();
        this.selectedUserIdForSpecificAssessment = '';
        this.selectedUserAssessmentId = '';
        this.userAssessments = [];
        this.loading = false;
      },
      error: (error) => {
        this.logger.error('Error deleting specific assessment', error);
        this.showMessage('Failed to delete assessment entry: ' + error.message, 'error');
        this.loading = false;
      }
    });
  }

  private executeDeleteAllUsersAssessmentData(): void {
    this.loading = true;
    this.adminAssessmentService.deleteAllUsersAssessmentData().subscribe({
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
  deleteAssessmentFile(): void {
    if (!this.selectedAssessmentFileId) {
      this.showMessage('Please select an assessment', 'error');
      return;
    }

    const quiz = this.assessmentFiles.find(q => q.id === parseInt(this.selectedAssessmentFileId));
    this.confirmAction = 'deleteAssessmentFile';
    this.confirmTitle = 'Delete Assessment File';
    this.confirmMessage = `Are you sure you want to delete the assessment file "${quiz?.title}"? This action cannot be undone and users will no longer be able to take this assessment.`;
    this.showConfirmModal = true;
  }

  // Delete assessment file from list (with ID directly)
  deleteAssessmentFileFromList(assessmentId: number): void {
    const quiz = this.assessmentFiles.find(q => q.id === assessmentId);
    this.selectedAssessmentFileId = assessmentId.toString();
    this.confirmAction = 'deleteAssessmentFile';
    this.confirmTitle = 'Delete Assessment File';
    this.confirmMessage = `Are you sure you want to delete the assessment file "${quiz?.title}"? This action cannot be undone and users will no longer be able to take this assessment.`;
    this.showConfirmModal = true;
  }

  private executeDeleteAssessmentFile(): void {
    this.loading = true;
    this.adminAssessmentService.deleteAssessmentFile(this.selectedAssessmentFileId).subscribe({
      next: () => {
        this.showMessage('Assessment file deleted successfully', 'success');
        this.loadAssessmentFiles();
        this.selectedAssessmentFileId = '';
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
  deleteAllAssessmentFiles(): void {
    this.confirmAction = 'deleteAllAssessmentFiles';
    this.confirmTitle = 'Delete All Assessment Files';
    this.confirmMessage = 'Are you sure you want to delete ALL assessment files? This action cannot be undone and users will no longer be able to take any assessments.';
    this.showConfirmModal = true;
  }

  private executeDeleteAllAssessmentFiles(): void {
    this.loading = true;
    this.adminAssessmentService.deleteAllAssessmentFiles().subscribe({
      next: () => {
        this.showMessage('All assessment files deleted successfully', 'success');
        this.loadAssessmentFiles();
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
      case 'deleteUserAssessment':
        this.executeDeleteUserAssessmentData();
        break;
      case 'deleteAllUserAssessments':
        this.executeDeleteAllUsersAssessmentData();
        break;
      case 'deleteSpecificUserAssessment':
        this.executeDeleteSpecificUserAssessment();
        break;
      case 'deleteAssessmentFile':
        this.executeDeleteAssessmentFile();
        break;
      case 'deleteAllAssessmentFiles':
        this.executeDeleteAllAssessmentFiles();
        break;
    }
    this.closeConfirmModal();
  }

  formatAssessmentDate(date: any): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
