import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CoursesService } from '@core/services/courses.service';
import { Course } from '@models/course';
import { ChapterOutline, LessonOutline } from '@models/course-content';
import { LoggerService } from '@core/services/logger.service';

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

  openChapter(chapter: ChapterOutline): void {
    if (!chapter?.id || !this.courseId) return;
    this.router.navigate(['/courses', this.courseId, 'chapters', chapter.id], {
      queryParams: { page: 1 },
    });
  }
}
