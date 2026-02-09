import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CoursesService } from '@core/services/courses.service';
import { Course } from '@models/course';
import { ChapterOutline, ContentAssessmentAttachment, LessonOutline } from '@models/course-content';
import { ChapterProgressStatus } from '@models/chapter-progress';
import { LoggerService } from '@core/services/logger.service';
import { CourseSurveyStatus, SubmitCourseSurveyPayload } from '@core/services/courses.service';

@Component({
  selector: 'app-course-detail',
  templateUrl: './course-detail.component.html',
  styleUrls: ['./course-detail.component.css'],
  standalone: false,
})
export class CourseDetailComponent implements OnInit {
  courseId = '';
  course: Course | null = null;
  loading = true;
  error = '';

  outlineLoading = true;
  outlineError = '';
  lessons: LessonOutline[] = [];
  courseAssessments: ContentAssessmentAttachment[] = [];

  progressLoading = true;
  progressError = '';
  progressByChapterId = new Map<string, ChapterProgressStatus>();

  surveyLoading = true;
  surveyError = '';
  surveyStatus: CourseSurveyStatus | null = null;
  surveyDismissed = false;
  surveySubmitted = false;
  surveyForm: SubmitCourseSurveyPayload = {
    ratingOverall: 0,
    ratingDifficulty: undefined,
    comment: '',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coursesService: CoursesService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    if (!localStorage.getItem('currentUser')) {
      this.error = 'Please login to view course details.';
      this.loading = false;
      return;
    }

    const courseId = this.route.snapshot.paramMap.get('id');
    if (!courseId) {
      this.error = 'Missing course id.';
      this.loading = false;
      return;
    }

    this.courseId = courseId;

    this.surveyDismissed = this.isSurveyDismissed(courseId);

    this.coursesService.getCourseSurveyStatus(courseId).subscribe({
      next: (status) => {
        this.surveyStatus = status;
        this.surveySubmitted = !!status.surveySubmitted;
        this.surveyLoading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load course survey status', err);
        this.surveyError = 'Failed to load survey status.';
        this.surveyLoading = false;
      },
    });

    this.coursesService.getCourse(courseId).subscribe({
      next: (course) => {
        this.course = course;
        this.loading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load course detail', err);
        this.error = 'Failed to load course.';
        this.loading = false;
      },
    });

    this.coursesService.getCourseContent(courseId).subscribe({
      next: (tree) => {
        this.lessons = Array.isArray(tree.lessons) ? tree.lessons : [];
        this.courseAssessments =
          tree && tree.course && Array.isArray(tree.course.assessments)
            ? tree.course.assessments
            : [];
        this.outlineLoading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load course content tree', err);
        this.outlineError = 'Failed to load course outline.';
        this.outlineLoading = false;
      },
    });

    this.coursesService.getCourseProgress(courseId).subscribe({
      next: (items) => {
        const map = new Map<string, ChapterProgressStatus>();
        for (const item of Array.isArray(items) ? items : []) {
          if (!item || !item.chapterId) continue;
          map.set(String(item.chapterId), item.status || 'not_started');
        }
        this.progressByChapterId = map;
        this.progressLoading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load course progress', err);
        this.progressError = 'Failed to load progress.';
        this.progressLoading = false;
      },
    });
  }

  getChapterStatus(chapter: ChapterOutline): ChapterProgressStatus {
    if (!chapter || !chapter.id) return 'not_started';
    return this.progressByChapterId.get(String(chapter.id)) || 'not_started';
  }

  isChapterCompleted(chapter: ChapterOutline): boolean {
    return this.getChapterStatus(chapter) === 'completed';
  }

  isLessonCompleted(lesson: LessonOutline): boolean {
    const chapters = lesson && Array.isArray(lesson.chapters) ? lesson.chapters : [];
    if (chapters.length === 0) return false;
    return chapters.every((c) => this.isChapterCompleted(c));
  }

  isCourseReadyForFinalAssessment(): boolean {
    const lessons = Array.isArray(this.lessons) ? this.lessons : [];
    if (lessons.length === 0) return false;
    return lessons.every((l) => this.isLessonCompleted(l));
  }

  openAssessment(assessmentId: number): void {
    const id = Number(assessmentId);
    if (!Number.isFinite(id)) return;

    // After completion, return the learner back to this course.
    this.router.navigate(['/questions'], {
      queryParams: {
        id,
        returnTo: 'course',
        returnCourseId: this.courseId,
      },
    });
  }

  openChapter(chapter: ChapterOutline): void {
    if (!chapter?.id || !this.courseId) return;
    this.router.navigate(['/courses', this.courseId, 'chapters', chapter.id], {
      queryParams: { page: 1 },
    });
  }

  shouldShowSurvey(): boolean {
    if (this.surveyLoading) return false;
    if (this.surveyDismissed) return false;
    if (this.surveySubmitted) return false;
    if (!this.surveyStatus) return false;
    return !!this.surveyStatus.courseCompleted;
  }

  dismissSurvey(): void {
    this.surveyDismissed = true;
    this.setSurveyDismissed(this.courseId);
  }

  submitSurvey(): void {
    if (!this.courseId) return;
    if (!Number.isInteger(Number(this.surveyForm.ratingOverall)) || Number(this.surveyForm.ratingOverall) < 1) return;

    const payload: SubmitCourseSurveyPayload = {
      ratingOverall: Number(this.surveyForm.ratingOverall),
      ratingDifficulty:
        this.surveyForm.ratingDifficulty === undefined || this.surveyForm.ratingDifficulty === null || this.surveyForm.ratingDifficulty === ('' as any)
          ? undefined
          : Number(this.surveyForm.ratingDifficulty),
      comment: (this.surveyForm.comment || '').trim(),
    };

    this.coursesService.submitCourseSurvey(this.courseId, payload).subscribe({
      next: () => {
        this.surveySubmitted = true;
      },
      error: (err) => {
        this.logger.error('Failed to submit course survey', err);
        this.surveyError = (err && (err.error || err.message)) || 'Failed to submit survey.';
      },
    });
  }

  private surveyDismissKey(courseId: string): string {
    return `courseSurveyDismissed:${courseId}`;
  }

  private isSurveyDismissed(courseId: string): boolean {
    try {
      return localStorage.getItem(this.surveyDismissKey(courseId)) === '1';
    } catch {
      return false;
    }
  }

  private setSurveyDismissed(courseId: string): void {
    try {
      localStorage.setItem(this.surveyDismissKey(courseId), '1');
    } catch {
      // ignore
    }
  }
}
