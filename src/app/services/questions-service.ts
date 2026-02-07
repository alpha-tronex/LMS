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

  getAssessment(assessmentId?: number): Observable<Quiz> {
    const url = assessmentId !== undefined ? `/api/assessment?id=${assessmentId}` : '/api/assessment';
    return this.http.get<Quiz>(url).pipe(
      retry(3),
      catchError((error) => {
        console.log('Error in getAssessment:', error);
        return this.handleError(error);
      })
    );
  }

  getAvailableAssessments(): Observable<any[]> {
    return this.http.get<any[]>('/api/assessments').pipe(
      retry(1),
      catchError((error) => {
        console.log('Error in getAvailableAssessments:', error);
        return this.handleError(error);
      })
    );
  }

  saveAssessment(username: string, assessmentData: any): Observable<any> {
    return this.http.post<any>('/api/assessment', { username, assessmentData }).pipe(
      retry(1),
      catchError((error) => {
        console.log('Error in saveAssessment:', error);
        return this.handleError(error);
      })
    );
  }

  getAssessmentHistory(username: string): Observable<any> {
    return this.http.get<any>(`/api/assessment/history/${username}`).pipe(
      retry(1),
      catchError((error) => {
        console.log('Error in getAssessmentHistory:', error);
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
