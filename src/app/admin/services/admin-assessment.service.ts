import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '@core/services/logger.service';

@Injectable({
  providedIn: 'root'
})
export class AdminAssessmentService {
  constructor(private http: HttpClient, private logger: LoggerService) {}

  getAvailableAssessments(): Observable<any[]> {
    return this.http.get<any[]>('/api/assessments').pipe(
      catchError((error) => this.handleError(error))
    );
  }

  uploadAssessment(assessmentData: any): Observable<any> {
    return this.http.post('/api/assessment/upload', assessmentData).pipe(
      tap(() => this.logger.info('Assessment uploaded successfully')),
      catchError((error) => this.handleError(error))
    );
  }

  deleteAllUsersAssessmentData(): Observable<any> {
    return this.http.delete('/api/admin/assessments/all-users-data').pipe(
      tap(() => this.logger.info('All users assessment data deleted')),
      catchError((error) => this.handleError(error))
    );
  }

  deleteAssessmentFile(assessmentFileId: string): Observable<any> {
    return this.http.delete(`/api/admin/assessment-file/${assessmentFileId}`).pipe(
      tap(() => this.logger.info('Assessment file deleted', { assessmentId: assessmentFileId })),
      catchError((error) => this.handleError(error))
    );
  }

  deleteAllAssessmentFiles(): Observable<any> {
    return this.http.delete('/api/admin/assessment-files/all').pipe(
      tap(() => this.logger.info('All assessment files deleted')),
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

    this.logger.error('Admin assessment service error', errorMessage);
    return throwError(() => errorMessage);
  }
}
