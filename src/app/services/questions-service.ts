import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { Quiz } from '../shared/models/quiz';

@Injectable()
export class QuestionsService {
  http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  getQuiz(quizId?: number): Observable<Quiz> {
    const url = quizId !== undefined ? `/api/quiz?id=${quizId}` : '/api/quiz';
    return this.http.get<Quiz>(url).pipe(
      retry(3),
      catchError((error) => {
        console.log('Error in getQuiz:', error);
        return this.handleError(error);
      })
    );
  }

  getAvailableQuizzes(): Observable<any[]> {
    return this.http.get<any[]>('/api/quizzes').pipe(
      retry(1),
      catchError((error) => {
        console.log('Error in getQuiz:', error);
        return this.handleError(error);
      })
    );
  }

  saveQuiz(username: string, quizData: any): Observable<any> {
    return this.http.post<any>('/api/quiz', { username, quizData }).pipe(
      retry(1),
      catchError((error) => {
        console.log('Error in getQuiz:', error);
        return this.handleError(error);
      })
    );
  }

  getQuizHistory(username: string): Observable<any> {
    return this.http.get<any>(`/api/quiz/history/${username}`).pipe(
      retry(1),
      catchError((error) => {
        console.log('Error in getQuiz:', error);
        return this.handleError(error);
      })
    );
  }

  handleError(error: HttpErrorResponse) {
    if (error.error instanceof ErrorEvent) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('An error occurred:', error.error.message);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      console.error(
        `Backend returned code ${error.status}, ` +
        `body was: ${JSON.stringify(error.error)}`);
    }
    // Propagate backend error body when available so components can show messages
    const backendError = error.error || 'Something bad happened; please try again later.';
    return throwError(backendError);
  }
}
