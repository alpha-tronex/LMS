import { Component, OnInit } from '@angular/core';
import { CoursesService } from '@core/services/courses.service';
import { Course } from '@models/course';
import { LoggerService } from '@core/services/logger.service';

@Component({
  selector: 'app-my-courses',
  templateUrl: './my-courses.component.html',
  styleUrls: ['./my-courses.component.css'],
  standalone: false,
})
export class MyCoursesComponent implements OnInit {
  courses: Course[] = [];
  loading = true;
  error = '';

  constructor(
    private coursesService: CoursesService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    if (!localStorage.getItem('currentUser')) {
      this.error = 'Please login to view your courses.';
      this.loading = false;
      return;
    }

    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.coursesService.getMyCourses().subscribe({
      next: (courses) => {
        this.courses = courses || [];
        this.loading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load my courses', err);
        this.error = 'Failed to load your courses.';
        this.loading = false;
      },
    });
  }
}
