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

  // Modal state for shared alpha-tronex popup
  showPopup = false;
  popupTitle = 'Under Construction';
  popupMessage = '';

  constructor(
    private router: Router,
    private loginService: LoginService,
    private renderer: Renderer2
  ) { }

  ngOnInit() {}

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
    if (localStorage.getItem('currentUser')) {
      return this.loginService.userName;
    }
    return '';
  }

  isAdmin(): boolean {
    if (localStorage.getItem('currentUser')) {
      return this.loginService.isAdminOrInstructor();
    }
    return false;
  }

  isStrictAdmin(): boolean {
    if (localStorage.getItem('currentUser')) {
      return this.loginService.isAdmin();
    }
    return false;
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

  logOff() {
    this.collapseNavbar();
    this.loginService.logout();
    this.router.navigate(['home']);
  }

  ngOnDestroy(): void {
    if (this.removeAdminDropdownHideListener) {
      this.removeAdminDropdownHideListener();
      this.removeAdminDropdownHideListener = undefined;
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
}
