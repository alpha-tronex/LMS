import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { User } from '@models/users';
import { UserRole } from '@models/user-role';
import { environment } from '../../environments/environment';

@Injectable()
export class LoginService {
  //loggedInStudentChange: Subject<User> = new Subject<User>();
  welcomePhrase: string = environment.welcomeLoginPrompt;
  user: User;
  http: HttpClient;
  loggedIn: boolean = false;

  constructor(http: HttpClient) {
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
    return this.user && this.user.role === UserRole.Admin;
  }

  isInstructor(): boolean {
    return this.user && this.user.role === UserRole.Instructor;
  }

  isAdminOrInstructor(): boolean {
    return this.isAdmin() || this.isInstructor();
  }

  isStudent(): boolean {
    return this.user && this.user.role === UserRole.Student;
  }

  
  login(user: User): Observable<User> {
    return this.http.post<User>('/api/login', user).pipe(
      // retry(3),
      tap(response => {
        this.user = response;
        console.log('Username:', this.user.uname);
        // Store user with token in localStorage for access across components
        localStorage.setItem('currentUser', JSON.stringify(response));
        // Signal that user is logged in (app.component will start idle monitoring)
        this.loggedIn = true;
      }),
      catchError((error) => {
        console.log('Error in login:', error);
        return this.handleError(error);
      })
    );
  }

  register(user: User): Observable<User> {
    console.log(user);
    return this.http.post<User>('/api/register', JSON.stringify(user),
    { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }).pipe(
      // retry(3),
      tap(response => {
        this.user = response;
        console.log('Registered user:', this.user.uname);
        // Store user with token in localStorage for access across components
        // Signal that user is logged in (app.component will start idle monitoring)
        this.loggedIn = true;
        localStorage.setItem('currentUser', JSON.stringify(response));
      }),
      catchError((error) => {
        console.log('Error in register:', error);
        return this.handleError(error);
      })
    );
  }

  updateUser(user: User): Observable<User> {
    return this.http.put<User>('/api/user/update', user).pipe(
      tap(response => {
        this.user = response;
        console.log('User updated:', this.user.uname);
        // Update localStorage with new user data (preserve token)
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
          const parsedUser = JSON.parse(currentUser);
          const updatedUser = { ...response, token: parsedUser.token };
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
      }),
      catchError((error) => {
        console.log('Error in updateUser:', error);
        return this.handleError(error);
      })
    );
  }

  logout(): void {
    this.user = null;
    this.loggedIn = false;
    this.welcomePhrase = 'You have been logged off. Please log back in to continue learning.';
    // Clear user from localStorage
    localStorage.removeItem('currentUser');
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
