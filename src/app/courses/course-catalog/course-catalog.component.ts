import { Component, OnInit } from '@angular/core';
import { CoursesService } from '@core/services/courses.service';
import { Course } from '@models/course';
import { LoggerService } from '@core/services/logger.service';

@Component({
  selector: 'app-course-catalog',
  templateUrl: './course-catalog.component.html',
  styleUrls: ['./course-catalog.component.css'],
  standalone: false,
})
export class CourseCatalogComponent implements OnInit {
  courses: Course[] = [];
  enrolledCourseIds = new Set<string>();

  loading = true;
  error = '';

  constructor(
    private coursesService: CoursesService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    if (!localStorage.getItem('currentUser')) {
      this.error = 'Please login to view available courses.';
      this.loading = false;
      return;
    }

    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = '';

    this.coursesService.getCourses().subscribe({
      next: (courses) => {
        this.courses = courses || [];
        this.loadMyCourses();
      },
      error: (err) => {
        this.logger.error('Failed to load courses', err);
        this.error = 'Failed to load courses.';
        this.loading = false;
      },
    });
  }

  loadMyCourses(): void {
    this.coursesService.getMyCourses().subscribe({
      next: (myCourses) => {
        this.enrolledCourseIds = new Set((myCourses || []).map((c) => c.id));
        this.loading = false;
      },
      error: (err) => {
        // Still show the catalog even if my-courses fails
        this.logger.warn('Failed to load my courses', err);
        this.loading = false;
      },
    });
  }

  isEnrolled(courseId: string): boolean {
    return this.enrolledCourseIds.has(courseId);
  }

  enroll(courseId: string): void {
    this.coursesService.enroll(courseId).subscribe({
      next: () => {
        this.enrolledCourseIds.add(courseId);
      },
      error: (err) => {
        this.logger.error('Enroll failed', err);
        this.error = 'Failed to enroll in course.';
      },
    });
  }

  withdraw(courseId: string): void {
    this.coursesService.withdraw(courseId).subscribe({
      next: () => {
        this.enrolledCourseIds.delete(courseId);
      },
      error: (err) => {
        this.logger.error('Withdraw failed', err);
        this.error = 'Failed to withdraw from course.';
      },
    });
  }
}
