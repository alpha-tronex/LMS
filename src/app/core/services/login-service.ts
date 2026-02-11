import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { User } from '@models/users';
import { LoggerService } from '@core/services/logger.service';
import { UserRole } from '@models/user-role';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  //loggedInStudentChange: Subject<User> = new Subject<User>();
  welcomePhrase: string = environment.welcomeLoginPrompt;

  private authStateSubject: BehaviorSubject<User | null>;
  authState$: Observable<User | null>;

  user: User;
  http: HttpClient;
  loggedIn: boolean = false;

  constructor(http: HttpClient, private logger: LoggerService) {
    this.http = http;

    const storedUser = this.readStoredUser();
    this.authStateSubject = new BehaviorSubject<User | null>(storedUser);
    this.authState$ = this.authStateSubject.asObservable();
    if (storedUser) {
      this.user = storedUser;
      this.loggedIn = true;
    }
    /*
    this.loggedInStudentChange.subscribe((student) => {
      this.loggedInStudent = student;
    });
    */
  }

  setCurrentUser(user: User | null): void {
    this.user = user as any;
    this.loggedIn = !!user;
    this.authStateSubject.next(user);
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
        this.logger.info('Logged in', { username: this.user?.uname });
        // Store user with token in localStorage for access across components
        localStorage.setItem('currentUser', JSON.stringify(response));
        // Signal that user is logged in (app.component will start idle monitoring)
        this.setCurrentUser(response);
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
        this.logger.info('Registered user', { username: this.user?.uname });
        // Store user with token in localStorage for access across components
        // Signal that user is logged in (app.component will start idle monitoring)
        localStorage.setItem('currentUser', JSON.stringify(response));
        this.setCurrentUser(response);
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
        this.logger.info('User updated', { username: this.user?.uname });
        // Update localStorage with new user data (preserve token)
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
          const parsedUser = JSON.parse(currentUser);
          const updatedUser = { ...response, token: parsedUser.token };
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          this.setCurrentUser(updatedUser);
          return;
        }

        this.setCurrentUser(response);
      }),
      catchError((error) => {
        this.logger.error('Error in updateUser', error);
        return this.handleError(error);
      })
    );
  }

  logout(): void {
    this.welcomePhrase = 'You have been logged off. Please log back in to continue learning.';
    // Clear user from localStorage
    localStorage.removeItem('currentUser');
    this.setCurrentUser(null);
  }

  private readStoredUser(): User | null {
    try {
      const raw = localStorage.getItem('currentUser');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed) return null;

      // Backward compatibility: older stored sessions used `type`.
      if (parsed && !parsed.role && parsed.type) {
        parsed.role = parsed.type;
        localStorage.setItem('currentUser', JSON.stringify(parsed));
      }

      return parsed as User;
    } catch (e) {
      this.logger.error('Failed to read stored user', e);
      return null;
    }
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
