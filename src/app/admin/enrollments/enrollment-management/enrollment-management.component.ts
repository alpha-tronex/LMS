import { Component, OnInit } from '@angular/core';
import { AdminCourse, AdminCourseService } from '@admin/services/admin-course.service';
import { AdminEnrollmentService, CourseEnrollmentRow } from '@admin/services/admin-enrollment.service';
import { LoggerService } from '@core/services/logger.service';

@Component({
  selector: 'app-enrollment-management',
  templateUrl: './enrollment-management.component.html',
  styleUrls: ['./enrollment-management.component.css'],
  standalone: false,
})
export class EnrollmentManagementComponent implements OnInit {
  courses: AdminCourse[] = [];
  selectedCourseId = '';

  enrollments: CourseEnrollmentRow[] = [];
  loadingCourses = true;
  loadingEnrollments = false;

  studentUsername = '';
  saving = false;

  error = '';
  message = '';
  messageType: 'success' | 'danger' = 'success';

  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmAction: 'withdraw' | null = null;
  confirmUserId: string | null = null;

  constructor(
    private adminCourseService: AdminCourseService,
    private adminEnrollmentService: AdminEnrollmentService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    const currentUserRaw = localStorage.getItem('currentUser');
    if (!currentUserRaw) {
      this.error = 'Please login as an admin or instructor to manage enrollments.';
      this.loadingCourses = false;
      return;
    }

    try {
      const parsed = JSON.parse(currentUserRaw);
      if (!parsed || (parsed.role !== 'admin' && parsed.role !== 'instructor')) {
        this.error = 'Access denied. Admin or instructor privileges required.';
        this.loadingCourses = false;
        return;
      }
    } catch {
      this.error = 'Unable to read current user. Please login again.';
      this.loadingCourses = false;
      return;
    }

    this.loadCourses();
  }

  loadCourses(): void {
    this.loadingCourses = true;
    this.error = '';

    this.adminCourseService.listCourses().subscribe({
      next: (courses) => {
        this.courses = courses || [];
        this.loadingCourses = false;
      },
      error: (err) => {
        this.logger.error('Failed to load courses for enrollment management', err);
        this.error = 'Failed to load courses.';
        this.loadingCourses = false;
      },
    });
  }

  onCourseChange(): void {
    this.message = '';
    this.error = '';
    this.enrollments = [];

    if (!this.selectedCourseId) {
      return;
    }

    this.loadEnrollments();
  }

  loadEnrollments(): void {
    if (!this.selectedCourseId) return;

    this.loadingEnrollments = true;
    this.error = '';

    this.adminEnrollmentService.listCourseEnrollments(this.selectedCourseId).subscribe({
      next: (rows) => {
        this.enrollments = rows || [];
        this.loadingEnrollments = false;
      },
      error: (err) => {
        this.logger.error('Failed to load enrollments', err);
        this.error = String(err || 'Failed to load enrollments.');
        this.loadingEnrollments = false;
      },
    });
  }

  enrollStudent(): void {
    if (!this.selectedCourseId) {
      this.error = 'Please select a course.';
      return;
    }

    const username = (this.studentUsername || '').trim();
    if (!username) {
      this.error = 'Please enter a student username.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';

    this.adminEnrollmentService.enrollByUsername(this.selectedCourseId, username).subscribe({
      next: () => {
        this.messageType = 'success';
        this.message = 'Student enrolled.';
        this.studentUsername = '';
        this.saving = false;
        this.loadEnrollments();
      },
      error: (err) => {
        this.logger.error('Failed to enroll student', err);
        this.error = String(err || 'Failed to enroll student.');
        this.saving = false;
      },
    });
  }

  requestWithdraw(userId: string, username: string): void {
    if (!this.selectedCourseId) return;

    this.confirmAction = 'withdraw';
    this.confirmUserId = userId;
    this.confirmTitle = 'Withdraw Student';
    this.confirmMessage = `Withdraw "${username}" from this course?`;
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmAction = null;
    this.confirmUserId = null;
    this.confirmTitle = '';
    this.confirmMessage = '';
  }

  confirmActionExecute(): void {
    if (this.confirmAction === 'withdraw' && this.confirmUserId && this.selectedCourseId) {
      this.saving = true;
      this.adminEnrollmentService.withdrawUser(this.selectedCourseId, this.confirmUserId).subscribe({
        next: () => {
          this.messageType = 'success';
          this.message = 'Student withdrawn.';
          this.saving = false;
          this.loadEnrollments();
        },
        error: (err) => {
          this.logger.error('Failed to withdraw student', err);
          this.error = String(err || 'Failed to withdraw student.');
          this.saving = false;
        },
      });
    }

    this.closeConfirmModal();
  }

  formatDate(value: string | null): string {
    if (!value) return 'N/A';
    const d = new Date(value);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
