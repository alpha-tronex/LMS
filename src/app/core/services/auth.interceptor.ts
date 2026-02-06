import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { IdleTimeoutService } from './idle-timeout.service';
import { LoggerService } from '@core/services/logger.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  
  constructor(
    private router: Router,
    private idleTimeoutService: IdleTimeoutService,
    private logger: LoggerService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Get token from localStorage
    const currentUser = localStorage.getItem('currentUser');
    let token: string | null = null;

    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        token = user.token;
      } catch (e) {
        this.logger.error('Error parsing user from localStorage', e);
      }
    }

    // Clone request and add authorization header if token exists
    if (token) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    // Handle the request and catch errors
    return next.handle(req).pipe(
      tap(() => {
        // Reset idle timer on successful API calls
        if (this.idleTimeoutService.isWatching()) {
          this.idleTimeoutService.reset();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // If 401 Unauthorized, token is invalid/expired - redirect to login
        if (error.status === 401) {
          this.logger.warn('Unauthorized - redirecting to login');
          localStorage.removeItem('currentUser');
          this.router.navigate(['/login']);
        }
        return throwError(error);
      })
    );
  }
}
