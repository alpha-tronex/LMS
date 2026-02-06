import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';

interface Breadcrumb {
  label: string;
  url: string;
}

@Component({
    selector: 'app-breadcrumb',
    templateUrl: './breadcrumb.component.html',
    styleUrls: ['./breadcrumb.component.css'],
    standalone: false
})
export class BreadcrumbComponent implements OnInit {
  breadcrumbs: Breadcrumb[] = [];

  private routeLabels: { [key: string]: string } = {
    'home': 'Home',
    'account': 'My Account',
    'history': 'Assessment History',
    'login': 'Login',
    'register': 'Register',
    'questions': 'Take Assessment',
    'admin': 'Admin',
    'user-management': 'User Management',
    'user-details': 'User Details',
    // Canonical assessment routes
    'assessment-management': 'Assessment Management',
    'create-assessment': 'Create Assessment',
    'upload-assessment': 'Upload Assessment',
    'edit-assessment': 'Edit Assessment',

    // Legacy quiz routes (kept for backwards compatibility)
    'quiz-management': 'Assessment Management',
    'create-quiz': 'Create Assessment',
    'upload-quiz': 'Upload Assessment',
    'edit-quiz': 'Edit Assessment'
  };

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) { }

  ngOnInit() {
    this.updateBreadcrumbs();
    
    // Update breadcrumbs on navigation
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateBreadcrumbs();
    });
  }

  private updateBreadcrumbs(): void {
    const url = this.router.url;
    
    // Don't show breadcrumbs on home page
    if (url === '/' || url === '/home') {
      this.breadcrumbs = [];
      return;
    }
    
    // Remove query parameters/hash and split path
    const path = url.split('?')[0].split('#')[0];
    const segments = path.split('/').filter(segment => segment);

    // Admin: user details page is a parameterized route (user-details/:id).
    // The naive cumulative URL builder would create /admin/user-details (invalid) which redirects.
    if (segments[0] === 'admin' && segments[1] === 'user-details' && segments.length >= 3) {
      const userId = segments[2];
      this.breadcrumbs = [
        { label: 'Home', url: '/home' },
        { label: 'Admin', url: '/admin' },
        { label: 'User Management', url: '/admin/user-management' },
        { label: 'User Details', url: `/admin/user-details/${userId}` }
      ];
      return;
    }

    // Admin: edit assessment page is a parameterized route.
    if (
      segments[0] === 'admin' &&
      (segments[1] === 'edit-assessment' || segments[1] === 'edit-quiz') &&
      segments.length >= 3
    ) {
      const quizId = segments[2];
      this.breadcrumbs = [
        { label: 'Home', url: '/home' },
        { label: 'Admin', url: '/admin' },
        { label: 'Assessment Management', url: '/admin/assessment-management' },
        { label: 'Edit Assessment', url: `/admin/edit-assessment/${quizId}` }
      ];
      return;
    }
    
    this.breadcrumbs = [
      { label: 'Home', url: '/home' }
    ];

    let currentPath = '';
    segments.forEach(segment => {
      currentPath += `/${segment}`;
      
      // Get label from routeLabels or use segment as fallback
      const label = this.routeLabels[segment] || this.formatSegment(segment);
      
      this.breadcrumbs.push({
        label: label,
        url: currentPath
      });
    });
  }

  private formatSegment(segment: string): string {
    // Convert kebab-case to Title Case
    return segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
