import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '@core/services/logger.service';

@Injectable({
  providedIn: 'root'
})
export class QuizUploadService {

  constructor(private http: HttpClient, private logger: LoggerService) { }

  uploadQuiz(quizData: any): Observable<any> {
    return this.http.post('/api/quiz/upload', quizData).pipe(
      tap(response => this.logger.info('Assessment uploaded', response)),
      catchError((error) => this.handleError(error))
    );
  }

  getQuizList(): Observable<any[]> {
    return this.http.get<any[]>('/api/quiz/list').pipe(
      catchError((error) => this.handleError(error))
    );
  }

  deleteQuiz(quizId: number): Observable<any> {
    return this.http.delete(`/api/quiz/delete/${quizId}`).pipe(
      tap(() => this.logger.info('Assessment deleted', { quizId })),
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
    
    this.logger.error('Assessment upload service error', errorMessage);
    return throwError(() => errorMessage);
  }
}
