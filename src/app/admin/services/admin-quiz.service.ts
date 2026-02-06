import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '@core/services/logger.service';

@Injectable({
  providedIn: 'root'
})
export class AdminQuizService {

  constructor(private http: HttpClient, private logger: LoggerService) { }

  getAvailableQuizzes(): Observable<any[]> {
    return this.http.get<any[]>('/api/quizzes').pipe(
      catchError((error) => this.handleError(error))
    );
  }

  uploadQuiz(quizData: any): Observable<any> {
    return this.http.post('/api/quiz/upload', quizData).pipe(
      tap(() => this.logger.info('Assessment uploaded successfully')),
      catchError((error) => this.handleError(error))
    );
  }

  deleteAllUsersQuizData(): Observable<any> {
    return this.http.delete('/api/admin/quizzes/all-users-data').pipe(
      tap(() => this.logger.info('All users assessment data deleted')),
      catchError((error) => this.handleError(error))
    );
  }

  deleteQuizFile(quizId: string): Observable<any> {
    return this.http.delete(`/api/admin/quiz-file/${quizId}`).pipe(
      tap(() => this.logger.info('Assessment file deleted', { quizId })),
      catchError((error) => this.handleError(error))
    );
  }

  deleteAllQuizFiles(): Observable<any> {
    return this.http.delete('/api/admin/quiz-files/all').pipe(
      tap(() => this.logger.info('All assessment files deleted')),
      catchError((error) => this.handleError(error))
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = error.error?.error || error.error?.message || error.message || 'Server error';
    }
    
    this.logger.error('Admin assessment service error', errorMessage);
    return throwError(() => errorMessage);
  }
}
