import { Component, OnInit } from '@angular/core';
import { AdminCourse, AdminCourseService } from '@admin/services/admin-course.service';
import { LoggerService } from '@core/services/logger.service';

@Component({
  selector: 'app-course-content-picker',
  templateUrl: './course-content-picker.component.html',
  styleUrls: ['./course-content-picker.component.css'],
  standalone: false,
})
export class CourseContentPickerComponent implements OnInit {
  courses: AdminCourse[] = [];

  isStrictAdmin = false;

  loading = true;
  error = '';

  constructor(private adminCourseService: AdminCourseService, private logger: LoggerService) {}

  ngOnInit(): void {
    const currentUserRaw = localStorage.getItem('currentUser');
    if (!currentUserRaw) {
      this.error = 'Please login as an admin or instructor to manage course content.';
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

  private loadCourses(): void {
    this.loading = true;
    this.error = '';

    this.adminCourseService.listCourses().subscribe({
      next: (courses) => {
        this.courses = courses || [];
        this.loading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load admin courses for content picker', err);
        this.error = 'Failed to load courses.';
        this.loading = false;
      },
    });
  }
}
