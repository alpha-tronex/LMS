import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { LoginService } from './login-service';
import { environment } from '@env/environment';
import { Subject } from 'rxjs';
import { LoggerService } from '@core/services/logger.service';

@Injectable({
  providedIn: 'root'
})
export class IdleTimeoutService {
  private idleTimer: any;
  private warningTimer: any;
  private lastActivity: number = Date.now();
  private warningShownAt: number = 0; // Track when warning was shown
  
  // Configuration (in milliseconds) - from environment
  private readonly IDLE_TIMEOUT = environment.idleTimeoutMinutes * 60 * 1000;
  private readonly WARNING_TIME = environment.idleWarningMinutes * 60 * 1000;
  private readonly CHECK_INTERVAL = 1000; // Check every second
  
  private warningShown: boolean = false;
  private isActive: boolean = false;
  private countdownTimer: any = null;

  // Observable for modal communication
  public warningSubject = new Subject<{ show: boolean; remainingSeconds: number }>();
  public userResponseSubject = new Subject<boolean>();

  // Events to monitor for user activity
  private readonly ACTIVITY_EVENTS = [
    'mousedown',
    'mousemove',
    'keypress',
    'scroll',
    'touchstart',
    'click'
  ];

  constructor(
    private router: Router,
    private loginService: LoginService,
    private logger: LoggerService
  ) {}

  /**
   * Start monitoring user activity
   */
  startWatching(): void {
    if (this.isActive) {
      return; // Already watching
    }

    this.isActive = true;
    this.lastActivity = Date.now();
    this.warningShown = false;
    this.warningShownAt = 0;

    // Add event listeners for user activity
    this.ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, this.resetTimer.bind(this), true);
    });

    // Start the idle check interval
    this.idleTimer = setInterval(() => {
      this.checkIdleStatus();
    }, this.CHECK_INTERVAL);

    this.logger.info('Idle timeout monitoring started');
  }

  /**
   * Stop monitoring user activity
   */
  stopWatching(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Remove event listeners
    this.ACTIVITY_EVENTS.forEach(event => {
      window.removeEventListener(event, this.resetTimer.bind(this), true);
    });

    // Clear timers
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.warningShownAt = 0;
    this.warningShown = false;
    this.logger.info('Idle timeout monitoring stopped');
  }

  /**
   * Reset the idle timer when user activity is detected
   */
  private resetTimer(): void {
    // Don't reset timer if warning is shown and we're in the final countdown
    if (this.warningShown) {
      return;
    }
    
    this.lastActivity = Date.now();
  }

  /**
   * Check if user has been idle too long
   */
  private checkIdleStatus(): void {
    const now = Date.now();
    const idleTime = now - this.lastActivity;
    const timeUntilLogout = this.IDLE_TIMEOUT - idleTime;

    // Show warning if approaching timeout
    if (!this.warningShown && timeUntilLogout <= this.WARNING_TIME && timeUntilLogout > 0) {
      this.showWarning();
    }

    // Logout if idle timeout exceeded
    if (idleTime >= this.IDLE_TIMEOUT) {
      this.logout();
    }
  }

  /**
   * Show warning to user about impending logout
   */
  private showWarning(): void {
    this.warningShown = true;
    this.warningShownAt = Date.now();
    const seconds = Math.ceil(this.WARNING_TIME / 1000);
    
    // Emit event to show modal
    this.warningSubject.next({ show: true, remainingSeconds: seconds });
    
    // Start countdown timer
    this.startCountdown();
    
    // Set up one-time listener for user response
    const subscription = this.userResponseSubject.subscribe((stayLoggedIn: boolean) => {
      subscription.unsubscribe();
      this.handleUserResponse(stayLoggedIn);
    });
  }

  private startCountdown(): void {
    let remainingSeconds = Math.ceil(this.WARNING_TIME / 1000);
    
    this.countdownTimer = setInterval(() => {
      remainingSeconds--;
      
      if (remainingSeconds > 0) {
        this.warningSubject.next({ show: true, remainingSeconds });
      } else {
        this.clearCountdown();
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private handleUserResponse(stayLoggedIn: boolean): void {
    this.clearCountdown();
    this.warningSubject.next({ show: false, remainingSeconds: 0 });
    
    if (stayLoggedIn) {
      // Check if warning period has already expired
      const now = Date.now();
      const timeSinceWarning = now - this.warningShownAt;
      
      if (timeSinceWarning >= this.WARNING_TIME) {
        // Too late - warning period expired, proceed with logout
        this.logger.warn('Warning period expired - logging out despite OK click');
        this.logout();
      } else {
        // Still within warning window - allow user to stay logged in
        this.warningShown = false;
        this.warningShownAt = 0;
        this.lastActivity = Date.now();
        this.logger.info('User chose to stay logged in within warning window - timer reset');
      }
    } else {
      // User chose to log out
      this.logger.info('User chose to log out');
      this.logout();
    }
  }

  /**
   * Public method for user to stay logged in
   */
  public stayLoggedIn(): void {
    this.userResponseSubject.next(true);
  }

  /**
   * Public method for user to log out
   */
  public proceedWithLogout(): void {
    this.userResponseSubject.next(false);
  }

  /**
   * Logout the user due to inactivity
   */
  private logout(): void {
    this.logger.warn('Logging out user due to inactivity');
    this.stopWatching();
    this.loginService.logout();
    
    // Store message for display on login page
    sessionStorage.setItem('logoutReason', 'You have been logged out due to inactivity.');
    
    // After logout, always return the user to the home page
    this.router.navigate(['/home']);
  }

  /**
   * Get remaining time until logout (for debugging/display)
   */
  getRemainingTime(): number {
    const now = Date.now();
    const idleTime = now - this.lastActivity;
    const remaining = this.IDLE_TIMEOUT - idleTime;
    return Math.max(0, remaining);
  }

  /**
   * Check if idle timeout is currently active
   */
  isWatching(): boolean {
    return this.isActive;
  }

  /**
   * Manually reset the idle timer (e.g., after API calls)
   */
  public reset(): void {
    this.resetTimer();
  }
}
