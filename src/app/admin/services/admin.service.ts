import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { User } from '@models/users';
import { LoggerService } from '@core/services/logger.service';

/**
 * @deprecated This service has been split into AdminUserService and AdminQuizService.
 * Please use those services instead:
 * - AdminUserService for user management operations
 * - AdminQuizService for assessment management operations
 * This service is kept for backwards compatibility but will be removed in a future version.
 */
@Injectable({
  providedIn: 'root'
})
export class AdminService {

  constructor(private http: HttpClient, private logger: LoggerService) { }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>('/api/admin/users').pipe(
      catchError((error) => this.handleError(error))
    );
  }

  getUserById(userId: string): Observable<User> {
    return this.http.get<User>(`/api/admin/user/${userId}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  updateUser(user: User): Observable<User> {
    return this.http.put<User>(`/api/admin/user/${user.id}`, user).pipe(
      tap(response => this.logger.info('User updated', response)),
      catchError((error) => this.handleError(error))
    );
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`/api/admin/user/${userId}`).pipe(
      tap(() => this.logger.info('User deleted', { userId })),
      catchError((error) => this.handleError(error))
    );
  }

  updateUserType(userId: string, type: string): Observable<User> {
    return this.http.patch<User>(`/api/admin/user/${userId}/type`, { type }).pipe(
      tap(response => this.logger.info('User type updated', response)),
      catchError((error) => this.handleError(error))
    );
  }

  // Assessment Management Methods
  deleteUserQuizData(userId: string): Observable<any> {
    return this.http.delete(`/api/admin/user/${userId}/assessments`).pipe(
      tap(() => this.logger.info('User assessment data deleted', { userId })),
      catchError((error) => this.handleError(error))
    );
  }

  deleteSpecificUserQuiz(userId: string, assessmentId: string): Observable<any> {
    return this.http.delete(`/api/admin/user/${userId}/assessment/${assessmentId}`).pipe(
      tap(() => this.logger.info('Specific assessment deleted from user', { userId, quizId: assessmentId })),
      catchError((error) => this.handleError(error))
    );
  }

  deleteAllUsersQuizData(): Observable<any> {
    return this.http.delete('/api/admin/assessments/all-users-data').pipe(
      tap(() => this.logger.info('All users assessment data deleted')),
      catchError((error) => this.handleError(error))
    );
  }

  getAvailableQuizzes(): Observable<any[]> {
    return this.http.get<any[]>('/api/assessments').pipe(
      catchError((error) => this.handleError(error))
    );
  }

  deleteQuizFile(assessmentFileId: string): Observable<any> {
    return this.http.delete(`/api/admin/assessment-file/${assessmentFileId}`).pipe(
      tap(() => this.logger.info('Assessment file deleted', { quizId: assessmentFileId })),
      catchError((error) => this.handleError(error))
    );
  }

  deleteAllQuizFiles(): Observable<any> {
    return this.http.delete('/api/admin/assessment-files/all').pipe(
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
    
    this.logger.error('Admin service error', errorMessage);
    return throwError(() => errorMessage);
  }
}
