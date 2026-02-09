import { Component, OnInit } from '@angular/core';
import { AdminCourse, AdminCourseService } from '@admin/services/admin-course.service';
import { AdminAssessmentService } from '@admin/services/admin-assessment.service';
import {
  AdminContentAssessmentMapping,
  AdminContentService,
} from '@admin/services/admin-content.service';
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

  // Milestone F: course assessment mapping
  availableAssessments: Array<{ id: number; title: string }> = [];
  availableAssessmentsLoading = false;
  mappingsLoading = false;
  courseMappingsByCourseId = new Map<string, AdminContentAssessmentMapping>();
  archivedCourseMappingsByCourseId = new Map<string, AdminContentAssessmentMapping[]>();
  selectedCourseAssessmentId: Record<string, number | null> = {};

  constructor(
    private adminCourseService: AdminCourseService,
    private adminContentService: AdminContentService,
    private adminAssessmentService: AdminAssessmentService,
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

    this.loadAvailableAssessments();
    this.loadCourseAssessmentMappings();
    this.loadCourses();
  }

  private loadAvailableAssessments(): void {
    this.availableAssessmentsLoading = true;
    this.adminAssessmentService.getAvailableAssessments().subscribe({
      next: (items) => {
        const list = Array.isArray(items) ? items : [];
        this.availableAssessments = list
          .map((a) => ({ id: Number(a && a.id), title: String((a && a.title) || '') }))
          .filter((a) => Number.isFinite(a.id) && a.title.length > 0)
          .sort((a, b) => a.id - b.id);
        this.availableAssessmentsLoading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load available assessments', err);
        this.availableAssessments = [];
        this.availableAssessmentsLoading = false;
      },
    });
  }

  private loadCourseAssessmentMappings(): void {
    this.mappingsLoading = true;
    // Load archived too so admins can unarchive older mappings
    this.adminContentService.listContentAssessmentMappings(undefined, true).subscribe({
      next: (items) => {
        const map = new Map<string, AdminContentAssessmentMapping>();
        const archivedByCourseId = new Map<string, AdminContentAssessmentMapping[]>();
        for (const m of Array.isArray(items) ? items : []) {
          if (!m) continue;
          if (m.scopeType !== 'course') continue;

          const courseId = String(m.scopeId);
          if (m.status === 'active') {
            map.set(courseId, m);
            continue;
          }

          if (m.status === 'archived') {
            const arr = archivedByCourseId.get(courseId) || [];
            arr.push(m);
            archivedByCourseId.set(courseId, arr);
          }
        }

        // Sort archived mappings by most-recent first (best-effort).
        for (const [courseId, arr] of archivedByCourseId.entries()) {
          arr.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
          archivedByCourseId.set(courseId, arr);
        }

        this.courseMappingsByCourseId = map;
        this.archivedCourseMappingsByCourseId = archivedByCourseId;
        this.mappingsLoading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load course assessment mappings', err);
        this.courseMappingsByCourseId = new Map();
        this.archivedCourseMappingsByCourseId = new Map();
        this.mappingsLoading = false;
      },
    });
  }

  getCourseMapping(courseId: string): AdminContentAssessmentMapping | null {
    return this.courseMappingsByCourseId.get(String(courseId)) || null;
  }

  getArchivedCourseMappings(courseId: string): AdminContentAssessmentMapping[] {
    return this.archivedCourseMappingsByCourseId.get(String(courseId)) || [];
  }

  getAssessmentTitle(assessmentId: number): string {
    const id = Number(assessmentId);
    const found = (Array.isArray(this.availableAssessments) ? this.availableAssessments : []).find(
      (a) => a && Number(a.id) === id
    );
    return found ? found.title : '';
  }

  attachCourseAssessment(course: AdminCourse): void {
    if (!course) return;
    if (course.status === 'archived') return;

    const selected = this.selectedCourseAssessmentId[String(course.id)];
    const assessmentId = Number(selected);
    if (!Number.isFinite(assessmentId)) {
      this.error = 'Please select an assessment to attach.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';

    this.adminContentService
      .attachContentAssessmentMapping({ scopeType: 'course', scopeId: course.id, assessmentId })
      .subscribe({
        next: () => {
          this.messageType = 'success';
          this.message = 'Course assessment attached.';
          this.saving = false;
          this.loadCourseAssessmentMappings();
        },
        error: (err) => {
          this.logger.error('Failed to attach course assessment mapping', err);
          this.error = 'Failed to attach course assessment.';
          this.saving = false;
        },
      });
  }

  archiveCourseAssessment(course: AdminCourse): void {
    if (!course) return;

    this.saving = true;
    this.error = '';
    this.message = '';

    this.adminContentService
      .detachContentAssessmentMapping({ scopeType: 'course', scopeId: course.id })
      .subscribe({
        next: () => {
          this.messageType = 'success';
          this.message = 'Course assessment mapping archived.';
          this.saving = false;
          this.loadCourseAssessmentMappings();
        },
        error: (err) => {
          this.logger.error('Failed to archive course assessment mapping', err);
          this.error = 'Failed to archive course assessment mapping.';
          this.saving = false;
        },
      });
  }

  unarchiveCourseAssessmentMapping(course: AdminCourse, mapping: AdminContentAssessmentMapping): void {
    if (!course || !mapping) return;
    if (mapping.status !== 'archived') return;
    if (course.status === 'archived') return;

    if (this.getCourseMapping(course.id)) {
      this.error = 'Cannot unarchive: an active course assessment mapping already exists.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';

    this.adminContentService.unarchiveContentAssessmentMapping(mapping.id).subscribe({
      next: () => {
        this.messageType = 'success';
        this.message = 'Course assessment mapping unarchived.';
        this.saving = false;
        this.loadCourseAssessmentMappings();
      },
      error: (err) => {
        this.logger.error('Failed to unarchive course assessment mapping', err);
        this.error = 'Failed to unarchive course assessment mapping.';
        this.saving = false;
      },
    });
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

  unarchiveCourse(course: AdminCourse): void {
    if (!course || course.status !== 'archived') return;

    this.saving = true;
    this.error = '';
    this.message = '';

    this.adminCourseService.unarchiveCourse(course.id).subscribe({
      next: () => {
        this.courses = this.courses.map((c) =>
          c.id === course.id ? { ...c, status: 'active' } : c
        );
        this.messageType = 'success';
        this.message = 'Course unarchived.';
        this.saving = false;
      },
      error: (err) => {
        this.logger.error('Failed to unarchive course', err);
        this.error = 'Failed to unarchive course.';
        this.saving = false;
      },
    });
  }

  isEditing(course: AdminCourse): boolean {
    return this.editingCourseId === course.id;
  }
}
