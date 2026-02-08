import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CoursesService } from '@core/services/courses.service';
import { Course } from '@models/course';
import { ChapterAsset, ChapterDetail, ChapterOutline, LessonOutline } from '@models/course-content';
import { LoggerService } from '@core/services/logger.service';

@Component({
  selector: 'app-course-detail',
  templateUrl: './course-detail.component.html',
  styleUrls: ['./course-detail.component.css'],
  standalone: false,
})
export class CourseDetailComponent implements OnInit {
  course: Course | null = null;
  loading = true;
  error = '';

  outlineLoading = true;
  outlineError = '';
  lessons: LessonOutline[] = [];

  selectedChapterId: string | null = null;
  chapterLoading = false;
  chapterError = '';
  chapterDetail: ChapterDetail | null = null;

  constructor(
    private route: ActivatedRoute,
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
        this.outlineLoading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load course content tree', err);
        this.outlineError = 'Failed to load course outline.';
        this.outlineLoading = false;
      },
    });
  }

  selectChapter(chapter: ChapterOutline): void {
    if (!chapter?.id) return;

    this.selectedChapterId = chapter.id;
    this.chapterLoading = true;
    this.chapterError = '';
    this.chapterDetail = null;

    this.coursesService.getChapter(chapter.id).subscribe({
      next: (detail) => {
        this.chapterDetail = detail;
        this.chapterLoading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load chapter', err);
        this.chapterError = 'Failed to load chapter content.';
        this.chapterLoading = false;
      },
    });
  }

  isSelectedChapter(chapter: ChapterOutline): boolean {
    return !!chapter?.id && this.selectedChapterId === chapter.id;
  }

  trackAsset(_index: number, asset: ChapterAsset): string {
    return asset.url;
  }
}
