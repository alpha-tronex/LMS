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

  private handleError(error: HttpErrorResponse) {
    const backendError = error.error || 'Something bad happened; please try again later.';
    return throwError(backendError);
  }
}
