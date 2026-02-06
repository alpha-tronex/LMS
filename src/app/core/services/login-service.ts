import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { User } from '@models/users';
import { LoggerService } from '@core/services/logger.service';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  //loggedInStudentChange: Subject<User> = new Subject<User>();
  welcomePhrase: string = 'Welcome to ISRA learning. Please login or register to start taking quizzes!';
  user: User;
  http: HttpClient;
  loggedIn: boolean = false;

  constructor(http: HttpClient, private logger: LoggerService) {
    this.http = http;
    /*
    this.loggedInStudentChange.subscribe((student) => {
      this.loggedInStudent = student;
    });
    */
  }

  get userName(): string {
    if (!this.user) {
      return '';
    }
    return this.user.uname;
  }

  isAdmin(): boolean {
    return this.user && this.user.type === 'admin';
  }

  isStudent(): boolean {
    return this.user && this.user.type === 'student';
  }

  
  login(user: User): Observable<User> {
    return this.http.post<User>('/api/login', user).pipe(
      // retry(3),
      tap(response => {
        this.user = response;
        this.logger.info('Logged in', { username: this.user?.uname });
        // Store user with token in localStorage for access across components
        localStorage.setItem('currentUser', JSON.stringify(response));
        // Signal that user is logged in (app.component will start idle monitoring)
        this.loggedIn = true;
      }),
      catchError((error) => {
        this.logger.error('Error in login', error);
        return this.handleError(error);
      })
    );
  }

  register(user: User): Observable<User> {
    this.logger.debug('Register payload', user);
    return this.http.post<User>('/api/register', JSON.stringify(user),
    { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }).pipe(
      // retry(3),
      tap(response => {
        this.user = response;
        this.logger.info('Registered user', { username: this.user?.uname });
        // Store user with token in localStorage for access across components
        // Signal that user is logged in (app.component will start idle monitoring)
        this.loggedIn = true;
        localStorage.setItem('currentUser', JSON.stringify(response));
      }),
      catchError((error) => {
        this.logger.error('Error in register', error);
        return this.handleError(error);
      })
    );
  }

  updateUser(user: User): Observable<User> {
    return this.http.put<User>('/api/user/update', user).pipe(
      tap(response => {
        this.user = response;
        this.logger.info('User updated', { username: this.user?.uname });
        // Update localStorage with new user data (preserve token)
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
          const parsedUser = JSON.parse(currentUser);
          const updatedUser = { ...response, token: parsedUser.token };
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
      }),
      catchError((error) => {
        this.logger.error('Error in updateUser', error);
        return this.handleError(error);
      })
    );
  }

  logout(): void {
    this.user = null;
    this.loggedIn = false;
    this.welcomePhrase = 'You have been logged off. Please log back in to continue taking quizzes.';
    // Clear user from localStorage
    localStorage.removeItem('currentUser');
  }

  handleError(error: HttpErrorResponse) {
    if (error.error instanceof ErrorEvent) {
      // A client-side or network error occurred. Handle it accordingly.
      this.logger.error('Client/network error', error.error.message);
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
