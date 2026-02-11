import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { LoggerService } from '@core/services/logger.service';

export interface AdminCourse {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived';
}

export interface CourseInstructorAssignment {
  courseId: string;
  instructorIds: string[];
  instructors: Array<{
    id: string;
    uname: string;
    fname: string;
    lname: string;
    email: string;
    role: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class AdminCourseService {
  constructor(private http: HttpClient, private logger: LoggerService) {}

  listCourses(): Observable<AdminCourse[]> {
    return this.http.get<AdminCourse[]>('/api/admin/courses').pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in listCourses', error);
        return this.handleError(error);
      })
    );
  }

  createCourse(payload: { title: string; description?: string }): Observable<AdminCourse> {
    return this.http.post<AdminCourse>('/api/admin/courses', payload).pipe(
      catchError((error) => {
        this.logger.error('Error in createCourse', error);
        return this.handleError(error);
      })
    );
  }

  updateCourse(courseId: string, payload: { title?: string; description?: string }): Observable<AdminCourse> {
    return this.http.put<AdminCourse>(`/api/admin/courses/${courseId}`, payload).pipe(
      catchError((error) => {
        this.logger.error('Error in updateCourse', error);
        return this.handleError(error);
      })
    );
  }

  archiveCourse(courseId: string): Observable<any> {
    return this.http.post<any>(`/api/admin/courses/${courseId}/archive`, {}).pipe(
      catchError((error) => {
        this.logger.error('Error in archiveCourse', error);
        return this.handleError(error);
      })
    );
  }

  unarchiveCourse(courseId: string): Observable<any> {
    return this.http.post<any>(`/api/admin/courses/${courseId}/unarchive`, {}).pipe(
      catchError((error) => {
        this.logger.error('Error in unarchiveCourse', error);
        return this.handleError(error);
      })
    );
  }

  getCourseInstructors(courseId: string): Observable<CourseInstructorAssignment> {
    return this.http.get<CourseInstructorAssignment>(`/api/admin/courses/${courseId}/instructors`).pipe(
      catchError((error) => {
        this.logger.error('Error in getCourseInstructors', error);
        return this.handleError(error);
      })
    );
  }

  setCourseInstructors(courseId: string, instructorIds: string[]): Observable<CourseInstructorAssignment> {
    return this.http
      .put<CourseInstructorAssignment>(`/api/admin/courses/${courseId}/instructors`, { instructorIds })
      .pipe(
        catchError((error) => {
          this.logger.error('Error in setCourseInstructors', error);
          return this.handleError(error);
        })
      );
  }

  purgeCourse(courseId: string): Observable<any> {
    return this.http.delete<any>(`/api/admin/courses/${courseId}/purge`).pipe(
      catchError((error) => {
        this.logger.error('Error in purgeCourse', error);
        return this.handleError(error);
      })
    );
  }

  purgeAllCourses(): Observable<any> {
    return this.http.delete<any>('/api/admin/courses/purge-all').pipe(
      catchError((error) => {
        this.logger.error('Error in purgeAllCourses', error);
        return this.handleError(error);
      })
    );
  }

  deleteCourseFromUser(userId: string, courseId: string): Observable<any> {
    return this.http.delete<any>(`/api/admin/users/${userId}/courses/${courseId}`).pipe(
      catchError((error) => {
        this.logger.error('Error in deleteCourseFromUser', error);
        return this.handleError(error);
      })
    );
  }

  deleteAllCoursesFromUser(userId: string): Observable<any> {
    return this.http.delete<any>(`/api/admin/users/${userId}/courses`).pipe(
      catchError((error) => {
        this.logger.error('Error in deleteAllCoursesFromUser', error);
        return this.handleError(error);
      })
    );
  }

  deleteAllCoursesFromAllUsers(): Observable<any> {
    return this.http.delete<any>('/api/admin/users/courses').pipe(
      catchError((error) => {
        this.logger.error('Error in deleteAllCoursesFromAllUsers', error);
        return this.handleError(error);
      })
    );
  }

  private handleError(error: HttpErrorResponse) {
    const backendError = error.error || 'Something bad happened; please try again later.';
    return throwError(backendError);
  }
}
