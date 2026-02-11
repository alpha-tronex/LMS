import { Component, OnDestroy, OnInit } from '@angular/core';
import { CoursesService } from '@core/services/courses.service';
import { LoggerService } from '@core/services/logger.service';
import { Course } from '@models/course';
import { environment } from '../../environments/environment';
import { Subscription } from 'rxjs';
import { LoginService } from '@core/services/login-service';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    standalone: false
})
export class HomeComponent implements OnInit, OnDestroy {
  loggedIn = false;
  username = '';
  isAdmin = false;

  welcomeShort = environment.welcomeShort;

  private authSubscription?: Subscription;

  myCoursesLoading = false;
  myCoursesError = '';
  myCourses: Course[] = [];
  enrolledCount = 0;
  completedCount = 0;

  constructor(
    private coursesService: CoursesService,
    private logger: LoggerService,
    private loginService: LoginService
  ) { }

  ngOnInit() {
    const currentUser = this.getCurrentUser();
    this.loggedIn = !!currentUser;
    this.username = currentUser?.uname || '';
    this.isAdmin = (currentUser?.role || '').toLowerCase() === 'admin';

    if (this.loggedIn) {
      this.loadMyCourses();
    }

    this.authSubscription = this.loginService.authState$.subscribe((user) => {
      const wasLoggedIn = this.loggedIn;
      this.loggedIn = !!user;
      this.username = user?.uname || '';
      this.isAdmin = (user?.role || '').toLowerCase() === 'admin';

      if (!this.loggedIn) {
        this.myCoursesLoading = false;
        this.myCoursesError = '';
        this.myCourses = [];
        this.enrolledCount = 0;
        this.completedCount = 0;
        return;
      }

      if (!wasLoggedIn) {
        this.loadMyCourses();
      }
    });
  }

  loadMyCourses(): void {
    this.myCoursesLoading = true;
    this.myCoursesError = '';

    this.coursesService.getMyCourses().subscribe({
      next: (courses) => {
        const items = courses || [];
        // Show newest enrollments first
        this.myCourses = items
          .slice()
          .sort((a, b) => new Date(b.enrolledAt || 0).getTime() - new Date(a.enrolledAt || 0).getTime())
          .slice(0, 3);

        this.enrolledCount = items.length;
        this.completedCount = items.filter((c) => !!c.courseCompleted).length;
        this.myCoursesLoading = false;
      },
      error: (err) => {
        this.logger.error('Failed to load my courses summary', err);
        this.myCoursesError = 'Failed to load your courses.';
        this.myCoursesLoading = false;
      },
    });
  }

  private getCurrentUser(): any | null {
    try {
      const raw = localStorage.getItem('currentUser');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    // if (this.subscription) {
    //   this.subscription.unsubscribe();
    // }
  }
}
