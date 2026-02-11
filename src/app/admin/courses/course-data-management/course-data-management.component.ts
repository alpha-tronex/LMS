import { Component, OnInit } from '@angular/core';
import { AdminUserService } from '@admin/services/admin-user.service';
import { AdminCourseService, AdminCourse } from '@admin/services/admin-course.service';
import { LoggerService } from '@core/services/logger.service';

@Component({
  selector: 'app-course-data-management',
  templateUrl: './course-data-management.component.html',
  styleUrls: ['./course-data-management.component.css'],
  standalone: false,
})
export class CourseDataManagementComponent implements OnInit {
  isStrictAdmin = false;

  users: any[] = [];
  courses: AdminCourse[] = [];

  selectedCourseId = '';
  selectedUserId = '';

  selectedUserIdForSpecificCourse = '';
  selectedCourseIdForSpecificUser = '';

  selectedUserIdForAllCourses = '';

  loading = false;
  message = '';
  messageType: 'success' | 'error' | '' = '';

  confirmAction:
    | 'purgeCourse'
    | 'purgeAllCourses'
    | 'deleteCourseFromUser'
    | 'deleteAllCoursesFromUser'
    | 'deleteAllCoursesFromAllUsers'
    | null = null;
  confirmTitle = '';
  confirmMessage = '';
  showConfirmModal = false;

  constructor(
    private adminUserService: AdminUserService,
    private adminCourseService: AdminCourseService,
    private logger: LoggerService
  ) {}

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
      this.loadCourses();
    } else {
      this.showMessage('Admin access required.', 'error');
    }
  }

  loadUsers(): void {
    this.adminUserService.getAllUsers().subscribe({
      next: (data) => {
        this.users = data || [];
      },
      error: (error) => {
        this.logger.error('Error loading users', error);
        this.showMessage('Failed to load users', 'error');
      },
    });
  }

  loadCourses(): void {
    this.adminCourseService.listCourses().subscribe({
      next: (data) => {
        this.courses = data || [];
      },
      error: (error) => {
        this.logger.error('Error loading courses', error);
        this.showMessage('Failed to load courses', 'error');
      },
    });
  }

  purgeSpecificCourse(): void {
    if (!this.selectedCourseId) {
      this.showMessage('Please select a course', 'error');
      return;
    }

    const course = this.courses.find((c) => c.id === this.selectedCourseId);
    this.confirmAction = 'purgeCourse';
    this.confirmTitle = 'Delete Course';
    this.confirmMessage = `Are you sure you want to delete the course "${course?.title || ''}" and ALL related data (enrollments, lessons, chapters, progress, attached assessment mappings, surveys)?`;
    this.showConfirmModal = true;
  }

  purgeAllCourses(): void {
    this.confirmAction = 'purgeAllCourses';
    this.confirmTitle = 'Delete All Courses';
    this.confirmMessage = 'Are you sure you want to delete ALL courses and ALL related data (enrollments, lessons, chapters, progress, attached assessment mappings, surveys)?';
    this.showConfirmModal = true;
  }

  deleteSpecificCourseFromUser(): void {
    if (!this.selectedUserIdForSpecificCourse || !this.selectedCourseIdForSpecificUser) {
      this.showMessage('Please select both user and course', 'error');
      return;
    }

    const user = this.users.find((u) => u.id === this.selectedUserIdForSpecificCourse);
    const course = this.courses.find((c) => c.id === this.selectedCourseIdForSpecificUser);

    this.confirmAction = 'deleteCourseFromUser';
    this.confirmTitle = 'Delete Course From User';
    this.confirmMessage = `Are you sure you want to remove course "${course?.title || ''}" from user "${this.getUserDisplayName(user)}"? This removes enrollments/progress/surveys and the user's course-scoped assessment attempts for that course.`;
    this.showConfirmModal = true;
  }

  deleteAllCoursesFromUser(): void {
    if (!this.selectedUserIdForAllCourses) {
      this.showMessage('Please select a user', 'error');
      return;
    }

    const user = this.users.find((u) => u.id === this.selectedUserIdForAllCourses);
    this.confirmAction = 'deleteAllCoursesFromUser';
    this.confirmTitle = 'Delete All Courses From User';
    this.confirmMessage = `Are you sure you want to remove ALL courses from user "${this.getUserDisplayName(user)}"? This removes enrollments/progress/surveys and all course-scoped assessment attempts.`;
    this.showConfirmModal = true;
  }

  deleteAllCoursesFromAllUsers(): void {
    this.confirmAction = 'deleteAllCoursesFromAllUsers';
    this.confirmTitle = 'Delete All Courses From All Users';
    this.confirmMessage = 'Are you sure you want to remove ALL courses from ALL users? This deletes ALL enrollments/progress/surveys and removes all course-scoped assessment attempts from every user.';
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmAction = null;
  }

  confirmActionExecute(): void {
    if (!this.confirmAction || this.loading) return;

    switch (this.confirmAction) {
      case 'purgeCourse':
        this.executePurgeCourse();
        break;
      case 'purgeAllCourses':
        this.executePurgeAllCourses();
        break;
      case 'deleteCourseFromUser':
        this.executeDeleteCourseFromUser();
        break;
      case 'deleteAllCoursesFromUser':
        this.executeDeleteAllCoursesFromUser();
        break;
      case 'deleteAllCoursesFromAllUsers':
        this.executeDeleteAllCoursesFromAllUsers();
        break;
      default:
        break;
    }
  }

  private executePurgeCourse(): void {
    this.loading = true;
    this.adminCourseService.purgeCourse(this.selectedCourseId).subscribe({
      next: () => {
        this.showMessage('Course deleted successfully', 'success');
        this.selectedCourseId = '';
        this.loadCourses();
        this.loading = false;
        this.closeConfirmModal();
      },
      error: (error) => {
        this.logger.error('Error deleting course', error);
        this.showMessage('Failed to delete course: ' + (error?.error || error?.message || error), 'error');
        this.loading = false;
        this.closeConfirmModal();
      },
    });
  }

  private executePurgeAllCourses(): void {
    this.loading = true;
    this.adminCourseService.purgeAllCourses().subscribe({
      next: () => {
        this.showMessage('All courses deleted successfully', 'success');
        this.selectedCourseId = '';
        this.selectedCourseIdForSpecificUser = '';
        this.loadCourses();
        this.loading = false;
        this.closeConfirmModal();
      },
      error: (error) => {
        this.logger.error('Error deleting all courses', error);
        this.showMessage('Failed to delete all courses: ' + (error?.error || error?.message || error), 'error');
        this.loading = false;
        this.closeConfirmModal();
      },
    });
  }

  private executeDeleteCourseFromUser(): void {
    this.loading = true;
    this.adminCourseService
      .deleteCourseFromUser(this.selectedUserIdForSpecificCourse, this.selectedCourseIdForSpecificUser)
      .subscribe({
        next: () => {
          this.showMessage('Course removed from user successfully', 'success');
          this.selectedUserIdForSpecificCourse = '';
          this.selectedCourseIdForSpecificUser = '';
          this.loadUsers();
          this.loading = false;
          this.closeConfirmModal();
        },
        error: (error) => {
          this.logger.error('Error removing course from user', error);
          this.showMessage('Failed to remove course from user: ' + (error?.error || error?.message || error), 'error');
          this.loading = false;
          this.closeConfirmModal();
        },
      });
  }

  private executeDeleteAllCoursesFromUser(): void {
    this.loading = true;
    this.adminCourseService.deleteAllCoursesFromUser(this.selectedUserIdForAllCourses).subscribe({
      next: () => {
        this.showMessage('All courses removed from user successfully', 'success');
        this.selectedUserIdForAllCourses = '';
        this.loadUsers();
        this.loading = false;
        this.closeConfirmModal();
      },
      error: (error) => {
        this.logger.error('Error removing all courses from user', error);
        this.showMessage('Failed to remove all courses from user: ' + (error?.error || error?.message || error), 'error');
        this.loading = false;
        this.closeConfirmModal();
      },
    });
  }

  private executeDeleteAllCoursesFromAllUsers(): void {
    this.loading = true;
    this.adminCourseService.deleteAllCoursesFromAllUsers().subscribe({
      next: () => {
        this.showMessage('All courses removed from all users successfully', 'success');
        this.loadUsers();
        this.loading = false;
        this.closeConfirmModal();
      },
      error: (error) => {
        this.logger.error('Error removing all courses from all users', error);
        this.showMessage('Failed to remove all courses from all users: ' + (error?.error || error?.message || error), 'error');
        this.loading = false;
        this.closeConfirmModal();
      },
    });
  }

  showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
    setTimeout(() => {
      this.message = '';
      this.messageType = '';
    }, 5000);
  }

  getUserDisplayName(user: any): string {
    if (!user) return '';
    const uname = user.uname || user.username || '';
    const fname = user.fname || '';
    const lname = user.lname || '';
    const name = `${fname} ${lname}`.trim();
    return name ? `${uname} (${name})` : uname;
  }
}
