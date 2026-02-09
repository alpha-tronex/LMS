import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { Quiz } from '@models/quiz';
import { LoggerService } from '@core/services/logger.service';

@Injectable({
  providedIn: 'root'
})
export class QuestionsService {
  http: HttpClient;

  constructor(http: HttpClient, private logger: LoggerService) {
    this.http = http;
  }

  getAssessment(
    assessmentId?: number,
    scope?: { scopeType: 'chapter' | 'lesson' | 'course'; courseId: string; lessonId?: string | null; chapterId?: string | null }
  ): Observable<Quiz> {
    const params: string[] = [];
    if (assessmentId !== undefined) params.push(`id=${encodeURIComponent(String(assessmentId))}`);
    if (scope) {
      params.push(`scopeType=${encodeURIComponent(scope.scopeType)}`);
      params.push(`courseId=${encodeURIComponent(scope.courseId)}`);
      if (scope.lessonId) params.push(`lessonId=${encodeURIComponent(scope.lessonId)}`);
      if (scope.chapterId) params.push(`chapterId=${encodeURIComponent(scope.chapterId)}`);
    }
    const url = params.length > 0 ? `/api/assessment?${params.join('&')}` : '/api/assessment';
    return this.http.get<Quiz>(url).pipe(
      retry(3),
      catchError((error) => {
        this.logger.error('Error in getAssessment', error);
        return this.handleError(error);
      })
    );
  }

  getAvailableAssessments(): Observable<any[]> {
    return this.http.get<any[]>('/api/assessments').pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in getAvailableAssessments', error);
        return this.handleError(error);
      })
    );
  }

  saveAssessment(username: string, assessmentData: any): Observable<any> {
    return this.http.post<any>('/api/assessment', { username, assessmentData }).pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in saveAssessment', error);
        return this.handleError(error);
      })
    );
  }

  getAssessmentHistory(username: string): Observable<any> {
    return this.http.get<any>(`/api/assessment/history/${username}`).pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in getAssessmentHistory', error);
        return this.handleError(error);
      })
    );
  }

  handleError(error: HttpErrorResponse) {
    if (error.error instanceof ErrorEvent) {
      // A client-side or network error occurred. Handle it accordingly.
      this.logger.error('An error occurred', error.error.message);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      this.logger.error(
        `Backend returned code ${error.status}, body was: ${JSON.stringify(error.error)}`
      );
    }
    // Propagate backend error body when available so components can show messages
    const backendError = error.error || 'Something bad happened; please try again later.';
    return throwError(backendError);
  }
}
