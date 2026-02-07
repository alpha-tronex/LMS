import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CoursesService } from '@core/services/courses.service';
import { Course } from '@models/course';
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
  }
}
