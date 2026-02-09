import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminCourse, AdminCourseService } from '@admin/services/admin-course.service';
import { AdminEnrollmentService, CourseEnrollmentRow } from '@admin/services/admin-enrollment.service';
import { LoggerService } from '@core/services/logger.service';

@Component({
  selector: 'app-course-roster',
  templateUrl: './course-roster.component.html',
  styleUrls: ['./course-roster.component.css'],
  standalone: false,
})
export class CourseRosterComponent implements OnInit {
  courseId = '';
  course: AdminCourse | null = null;

  enrollments: CourseEnrollmentRow[] = [];

  loadingCourse = true;
  loadingRoster = true;

  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminCourseService: AdminCourseService,
    private adminEnrollmentService: AdminEnrollmentService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    const currentUserRaw = localStorage.getItem('currentUser');
    if (!currentUserRaw) {
      this.error = 'Please login as an admin or instructor to view course rosters.';
      this.loadingCourse = false;
      this.loadingRoster = false;
      return;
    }

    try {
      const parsed = JSON.parse(currentUserRaw);
      if (!parsed || (parsed.role !== 'admin' && parsed.role !== 'instructor')) {
        this.error = 'Access denied. Admin or instructor privileges required.';
        this.loadingCourse = false;
        this.loadingRoster = false;
        return;
      }
    } catch {
      this.error = 'Unable to read current user. Please login again.';
      this.loadingCourse = false;
      this.loadingRoster = false;
      return;
    }

    const courseId = String(this.route.snapshot.paramMap.get('courseId') || '').trim();
    if (!courseId) {
      this.error = 'Missing courseId.';
      this.loadingCourse = false;
      this.loadingRoster = false;
      return;
    }

    this.courseId = courseId;
    this.loadCourse();
    this.loadRoster();
  }

  backToCourses(): void {
    this.router.navigate(['/admin/course-management']);
  }

  private loadCourse(): void {
    this.loadingCourse = true;

    this.adminCourseService.listCourses().subscribe({
      next: (courses) => {
        const found = (courses || []).find((c) => c.id === this.courseId) || null;
        this.course = found;
        this.loadingCourse = false;
      },
      error: (err) => {
        this.logger.error('Failed to load admin courses for roster page', err);
        this.loadingCourse = false;
      },
    });
  }

  private loadRoster(): void {
    this.loadingRoster = true;
    this.error = '';

    this.adminEnrollmentService.listCourseEnrollments(this.courseId).subscribe({
      next: (rows) => {
        this.enrollments = rows || [];
        this.loadingRoster = false;
      },
      error: (err) => {
        this.logger.error('Failed to load course roster', err);
        this.error = String(err || 'Failed to load roster.');
        this.loadingRoster = false;
      },
    });
  }

  formatDate(value: string | null): string {
    if (!value) return 'N/A';
    const d = new Date(value);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
