import { Component, OnInit } from '@angular/core';
import { AdminCourse, AdminCourseService } from '@admin/services/admin-course.service';
import { LoggerService } from '@core/services/logger.service';

@Component({
  selector: 'app-course-management',
  templateUrl: './course-management.component.html',
  styleUrls: ['./course-management.component.css'],
  standalone: false,
})
export class CourseManagementComponent implements OnInit {
  courses: AdminCourse[] = [];

  isStrictAdmin = false;

  loading = true;
  saving = false;
  error = '';
  message = '';
  messageType: 'success' | 'danger' = 'success';

  // Create form
  newTitle = '';
  newDescription = '';

  // Edit mode
  editingCourseId: string | null = null;
  editTitle = '';
  editDescription = '';

  constructor(
    private adminCourseService: AdminCourseService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    const currentUserRaw = localStorage.getItem('currentUser');
    if (!currentUserRaw) {
      this.error = 'Please login as an admin or instructor to manage courses.';
      this.loading = false;
      return;
    }

    try {
      const parsed = JSON.parse(currentUserRaw);
      if (!parsed || (parsed.role !== 'admin' && parsed.role !== 'instructor')) {
        this.error = 'Access denied. Admin or instructor privileges required.';
        this.loading = false;
        return;
      }

      this.isStrictAdmin = parsed.role === 'admin';
    } catch {
      this.error = 'Unable to read current user. Please login again.';
      this.loading = false;
      return;
    }

    this.loadCourses();
  }

  loadCourses(): void {
    this.loading = true;
    this.error = '';
    this.message = '';

    this.adminCourseService.listCourses().subscribe({
      next: (courses) => {
        this.courses = courses || [];
        this.loading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load admin courses', err);
        this.error = 'Failed to load courses.';
        this.loading = false;
      },
    });
  }

  startEdit(course: AdminCourse): void {
    this.editingCourseId = course.id;
    this.editTitle = course.title;
    this.editDescription = course.description || '';
    this.message = '';
    this.error = '';
  }

  cancelEdit(): void {
    this.editingCourseId = null;
    this.editTitle = '';
    this.editDescription = '';
  }

  saveEdit(course: AdminCourse): void {
    if (!this.editingCourseId) return;

    const title = (this.editTitle || '').trim();
    if (!title) {
      this.error = 'Title is required.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';

    this.adminCourseService
      .updateCourse(course.id, { title: title, description: this.editDescription || '' })
      .subscribe({
        next: (updated) => {
          this.courses = this.courses.map((c) => (c.id === updated.id ? updated : c));
          this.messageType = 'success';
          this.message = 'Course updated.';
          this.saving = false;
          this.cancelEdit();
        },
        error: (err) => {
          this.logger.error('Failed to update course', err);
          this.error = 'Failed to update course.';
          this.saving = false;
        },
      });
  }

  createCourse(): void {
    const title = (this.newTitle || '').trim();
    if (!title) {
      this.error = 'Title is required.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';

    this.adminCourseService
      .createCourse({ title: title, description: this.newDescription || '' })
      .subscribe({
        next: (created) => {
          this.courses = [created, ...this.courses];
          this.newTitle = '';
          this.newDescription = '';
          this.messageType = 'success';
          this.message = 'Course created.';
          this.saving = false;
        },
        error: (err) => {
          this.logger.error('Failed to create course', err);
          this.error = 'Failed to create course.';
          this.saving = false;
        },
      });
  }

  archiveCourse(course: AdminCourse): void {
    if (!course || course.status === 'archived') return;

    this.saving = true;
    this.error = '';
    this.message = '';

    this.adminCourseService.archiveCourse(course.id).subscribe({
      next: () => {
        this.courses = this.courses.map((c) =>
          c.id === course.id ? { ...c, status: 'archived' } : c
        );
        this.messageType = 'success';
        this.message = 'Course archived.';
        this.saving = false;
      },
      error: (err) => {
        this.logger.error('Failed to archive course', err);
        this.error = 'Failed to archive course.';
        this.saving = false;
      },
    });
  }

  isEditing(course: AdminCourse): boolean {
    return this.editingCourseId === course.id;
  }
}
