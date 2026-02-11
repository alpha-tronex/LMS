import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { LoginService } from '@core/services/login-service';
import { IdleTimeoutService } from '@core/services/idle-timeout.service';
import { LoggerService } from '@core/services/logger.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'app';
  private routerSubscription: any;
  private warningSubscription: any;
  showIdleWarning: boolean = false;
  idleRemainingSeconds: number = 0;
  private idleModalInstance: any = null;

  constructor(
    private router: Router,
    private loginService: LoginService,
    private idleTimeoutService: IdleTimeoutService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    // Check if user is already logged in (from localStorage)
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        // Backward compatibility: older stored sessions used `type`.
        if (user && !user.role && user.type) {
          user.role = user.type;
          localStorage.setItem('currentUser', JSON.stringify(user));
        }
        this.loginService.setCurrentUser(user);
        // Start idle monitoring for already logged in user
        this.idleTimeoutService.startWatching();
      } catch (e) {
        this.logger.error('Error parsing stored user', e);
        localStorage.removeItem('currentUser');
      }
    }

    // Monitor route changes and login state
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      if (this.loginService.loggedIn && !this.idleTimeoutService.isWatching()) {
        // User logged in, start idle monitoring
        this.idleTimeoutService.startWatching();
      } else if (!this.loginService.loggedIn && this.idleTimeoutService.isWatching()) {
        // User logged out, stop idle monitoring
        this.idleTimeoutService.stopWatching();
      }
    });

    // Subscribe to idle timeout warnings
    this.warningSubscription = this.idleTimeoutService.warningSubject.subscribe(
      ({ show, remainingSeconds }) => {
        this.showIdleWarning = show;
        this.idleRemainingSeconds = remainingSeconds;
        
        if (show) {
          this.showIdleModal();
        } else {
          this.closeIdleModal();
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.warningSubscription) {
      this.warningSubscription.unsubscribe();
    }
    this.idleTimeoutService.stopWatching();
  }

  private showIdleModal(): void {
    const modalElement = document.getElementById('idleWarningModal');
    if (modalElement && !this.idleModalInstance) {
      this.idleModalInstance = new (window as any).bootstrap.Modal(modalElement, {
        backdrop: 'static',
        keyboard: false
      });
      this.idleModalInstance.show();
    }
  }

  private closeIdleModal(): void {
    if (this.idleModalInstance) {
      this.idleModalInstance.hide();
      
      // Wait for hide animation to complete before cleanup
      setTimeout(() => {
        if (this.idleModalInstance) {
          this.idleModalInstance.dispose();
          this.idleModalInstance = null;
        }
        
        // Manually remove all backdrops if they still exist
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        
        // Remove modal-open class from body
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        // Reset the modal element itself
        const modalElement = document.getElementById('idleWarningModal');
        if (modalElement) {
          modalElement.classList.remove('show');
          modalElement.style.display = 'none';
          modalElement.setAttribute('aria-hidden', 'true');
          modalElement.removeAttribute('aria-modal');
        }
      }, 300); // Wait for Bootstrap modal animation
    }
  }

  onStayLoggedIn(): void {
    this.idleTimeoutService.stayLoggedIn();
  }

  onLogout(): void {
    this.idleTimeoutService.proceedWithLogout();
  }
}
