import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '@core/services/logger.service';

@Injectable({
  providedIn: 'root'
})
export class AssessmentUploadService {
  constructor(private http: HttpClient, private logger: LoggerService) {}

  uploadAssessment(assessmentData: any): Observable<any> {
    return this.http.post('/api/assessment/upload', assessmentData).pipe(
      tap((response) => this.logger.info('Assessment uploaded', response)),
      catchError((error) => this.handleError(error))
    );
  }

  getAssessmentList(): Observable<any[]> {
    return this.http.get<any[]>('/api/assessment/list').pipe(
      catchError((error) => this.handleError(error))
    );
  }

  deleteAssessment(assessmentId: number): Observable<any> {
    return this.http.delete(`/api/assessment/delete/${assessmentId}`).pipe(
      tap(() => this.logger.info('Assessment deleted', { assessmentId })),
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

    this.logger.error('Assessment upload service error', errorMessage);
    return throwError(() => errorMessage);
  }
}
