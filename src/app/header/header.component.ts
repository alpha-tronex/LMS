import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LoginService } from '@core/services/login-service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  standalone: false
})
export class HeaderComponent implements OnInit, AfterViewInit, OnDestroy {
  subscription: any;

  welcomeShort = environment.welcomeShort;

  quizSubmenuOpen = false;
  coursesSubmenuOpen = false;

  @ViewChild('adminDropdownWrapper')
  private adminDropdownWrapper?: ElementRef<HTMLElement>;

  private removeAdminDropdownHideListener?: () => void;

  private authSubscription?: Subscription;
  private currentUser: any | null = null;

  // Modal state for shared alpha-tronex popup
  showPopup = false;
  popupTitle = 'Under Construction';
  popupMessage = '';

  constructor(
    private router: Router,
    private loginService: LoginService,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.currentUser = this.getCurrentUserFromStorage();
    this.authSubscription = this.loginService.authState$.subscribe((user) => {
      this.currentUser = this.normalizeUser(user);
    });
  }

  ngAfterViewInit(): void {
    const wrapper = this.adminDropdownWrapper?.nativeElement;
    if (!wrapper) {
      return;
    }

    // If Bootstrap's dropdown JS is present, it will emit hide.bs.dropdown on close.
    // This prevents the submenu staying open between opens.
    this.removeAdminDropdownHideListener = this.renderer.listen(wrapper, 'hide.bs.dropdown', () => {
      this.quizSubmenuOpen = false;
      this.coursesSubmenuOpen = false;
    });
  }

  getUsername(): string {
    return this.currentUser?.uname || this.currentUser?.username || '';
  }

  isAdmin(): boolean {
    const role = (this.currentUser?.role || '').toString().toLowerCase();
    return role === 'admin' || role === 'instructor';
  }

  isStrictAdmin(): boolean {
    const role = (this.currentUser?.role || '').toString().toLowerCase();
    return role === 'admin';
  }

  collapseNavbar(): void {
    this.quizSubmenuOpen = false;
    this.coursesSubmenuOpen = false;
    const navbarToggler = document.querySelector('.navbar-toggler') as HTMLElement;
    const navbarCollapse = document.getElementById('navbarResponsive');
    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
      if (navbarToggler) {
        navbarToggler.click();
      }
    }
  }

  toggleQuizSubmenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.coursesSubmenuOpen = false;
    this.quizSubmenuOpen = !this.quizSubmenuOpen;
  }

  toggleCoursesSubmenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.quizSubmenuOpen = false;
    this.coursesSubmenuOpen = !this.coursesSubmenuOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.quizSubmenuOpen && !this.coursesSubmenuOpen) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      this.quizSubmenuOpen = false;
      this.coursesSubmenuOpen = false;
      return;
    }

    // Keep the submenu open if the click is inside it.
    if (target.closest('.dropdown-submenu')) {
      return;
    }

    this.quizSubmenuOpen = false;
    this.coursesSubmenuOpen = false;
  }

  logOff(): void {
    this.collapseNavbar();
    this.loginService.logout();
    this.router.navigate(['/home']);
  }

  ngOnDestroy(): void {
    if (this.removeAdminDropdownHideListener) {
      this.removeAdminDropdownHideListener();
      this.removeAdminDropdownHideListener = undefined;
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = undefined;
    }
    // if (this.subscription) {
    //   this.subscription.unsubscribe();
    // }
  }

  // Show the shared alpha-tronex popup with a custom message
  showUnderConstruction(event: Event, feature: string) {
    event.preventDefault();
    this.popupMessage = `${feature} is under construction.`;
    this.showPopup = true;
  }

  // Hide the shared alpha-tronex popup
  closePopup() {
    this.showPopup = false;
    this.popupMessage = '';
  }

  // Custom links for the dropdown menu
  customLinks = [
    { name: 'Lesson Management', icon: 'fas fa-book', url: '#' },
    { name: 'Enrollment Management', icon: 'fas fa-user-check', url: '#' }
  ];

  private getCurrentUserFromStorage(): any | null {
    try {
      const raw = localStorage.getItem('currentUser');
      if (!raw) return null;
      return this.normalizeUser(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  private normalizeUser(user: any | null): any | null {
    if (!user) return null;

    // Backward compatibility: older stored sessions used `type`.
    if (user && !user.role && user.type) {
      user.role = user.type;
      try {
        localStorage.setItem('currentUser', JSON.stringify(user));
      } catch {
        // ignore
      }
    }

    return user;
  }
}
