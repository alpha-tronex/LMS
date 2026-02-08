import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminCourse, AdminCourseService, CourseInstructorAssignment } from '@admin/services/admin-course.service';
import { AdminUserService } from '@admin/services/admin-user.service';
import { LoggerService } from '@core/services/logger.service';
import { User } from '@models/users';

@Component({
  selector: 'app-course-instructors',
  templateUrl: './course-instructors.component.html',
  styleUrls: ['./course-instructors.component.css'],
  standalone: false,
})
export class CourseInstructorsComponent implements OnInit {
  courseId = '';
  courseTitle = '';

  loading = true;
  saving = false;

  error = '';
  message = '';
  messageType: 'success' | 'danger' = 'success';

  allInstructorUsers: User[] = [];
  selectedInstructorId = '';

  assignment: CourseInstructorAssignment | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminCourseService: AdminCourseService,
    private adminUserService: AdminUserService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    const currentUserRaw = localStorage.getItem('currentUser');
    if (!currentUserRaw) {
      this.error = 'Please login as an admin to assign course instructors.';
      this.loading = false;
      return;
    }

    try {
      const parsed = JSON.parse(currentUserRaw);
      if (!parsed || parsed.role !== 'admin') {
        this.error = 'Access denied. Admin privileges required.';
        this.loading = false;
        return;
      }
    } catch {
      this.error = 'Unable to read current user. Please login again.';
      this.loading = false;
      return;
    }

    this.courseId = String(this.route.snapshot.paramMap.get('courseId') || '').trim();
    if (!this.courseId) {
      this.error = 'Missing courseId.';
      this.loading = false;
      return;
    }

    this.loadPageData();
  }

  loadPageData(): void {
    this.loading = true;
    this.error = '';
    this.message = '';

    this.adminUserService.getAllUsers().subscribe({
      next: (users) => {
        const list = users || [];
        this.allInstructorUsers = list
          .filter((u) => (u.role as any) === 'instructor')
          .sort((a, b) => String(a.uname || '').localeCompare(String(b.uname || '')));

        this.adminCourseService.getCourseInstructors(this.courseId).subscribe({
          next: (assignment) => {
            this.assignment = assignment;
            this.loading = false;
            this.loadCourseTitleBestEffort();
          },
          error: (err) => {
            this.logger.error('Failed to load course instructors', err);
            this.error = String(err || 'Failed to load course instructors.');
            this.loading = false;
          },
        });
      },
      error: (err) => {
        this.logger.error('Failed to load users for instructor assignment', err);
        this.error = String(err || 'Failed to load users.');
        this.loading = false;
      },
    });
  }

  private loadCourseTitleBestEffort(): void {
    this.adminCourseService.listCourses().subscribe({
      next: (courses: AdminCourse[]) => {
        const match = (courses || []).find((c) => c.id === this.courseId);
        this.courseTitle = match ? match.title : '';
      },
      error: () => {
        // best effort only
      },
    });
  }

  get assignedInstructors() {
    return (this.assignment && this.assignment.instructors) || [];
  }

  addInstructor(): void {
    if (!this.assignment) return;

    const instructorId = (this.selectedInstructorId || '').trim();
    if (!instructorId) {
      this.error = 'Please select an instructor.';
      return;
    }

    const nextIds = Array.from(new Set([...(this.assignment.instructorIds || []), instructorId]));
    this.saveInstructorIds(nextIds);
  }

  removeInstructor(instructorId: string): void {
    if (!this.assignment) return;

    const nextIds = (this.assignment.instructorIds || []).filter((id) => id !== instructorId);
    this.saveInstructorIds(nextIds);
  }

  private saveInstructorIds(instructorIds: string[]): void {
    this.saving = true;
    this.error = '';
    this.message = '';

    this.adminCourseService.setCourseInstructors(this.courseId, instructorIds).subscribe({
      next: (updated) => {
        this.assignment = updated;
        this.messageType = 'success';
        this.message = 'Course instructors updated.';
        this.selectedInstructorId = '';
        this.saving = false;
      },
      error: (err) => {
        this.logger.error('Failed to update course instructors', err);
        this.error = String(err || 'Failed to update course instructors.');
        this.saving = false;
      },
    });
  }

  backToCourses(): void {
    this.router.navigate(['/admin/course-management']);
  }
}
