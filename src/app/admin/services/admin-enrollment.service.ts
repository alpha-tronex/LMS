import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '@core/services/logger.service';

export interface CourseEnrollmentRow {
  userId: string;
  enrollmentStatus: 'enrolled' | 'withdrawn';
  enrolledAt: string | null;
  username: string;
  fname: string;
  lname: string;
  email: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminEnrollmentService {
  constructor(private http: HttpClient, private logger: LoggerService) {}

  listCourseEnrollments(courseId: string): Observable<CourseEnrollmentRow[]> {
    return this.http
      .get<CourseEnrollmentRow[]>(`/api/admin/courses/${courseId}/enrollments`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  enrollByUsername(courseId: string, username: string): Observable<any> {
    return this.http
      .post(`/api/admin/courses/${courseId}/enrollments`, { username })
      .pipe(
        tap(() => this.logger.info('Enrollment created/updated', { courseId, username })),
        catchError((error) => this.handleError(error))
      );
  }

  withdrawUser(courseId: string, userId: string): Observable<any> {
    return this.http
      .post(`/api/admin/courses/${courseId}/enrollments/${userId}/withdraw`, {})
      .pipe(
        tap(() => this.logger.info('Enrollment withdrawn', { courseId, userId })),
        catchError((error) => this.handleError(error))
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = error.error?.error || error.error?.message || error.message || 'Server error';
    }

    this.logger.error('Admin enrollment service error', errorMessage);
    return throwError(() => errorMessage);
  }
}
