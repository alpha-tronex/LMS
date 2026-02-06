import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

interface Breadcrumb {
  label: string;
  url: string;
}

@Component({
    selector: 'app-admin-breadcrumb',
    templateUrl: './admin-breadcrumb.component.html',
    styleUrls: ['./admin-breadcrumb.component.css'],
    standalone: false
})
export class AdminBreadcrumbComponent implements OnInit {
  breadcrumbs: Breadcrumb[] = [];

  private routeLabels: { [key: string]: string } = {
    'admin': 'Admin',
    'user-management': 'User Management',
    'user-details': 'User Details',
    'create-quiz': 'Create Assessment',
    'upload-quiz': 'Upload Assessment',
    'quiz-management': 'Assessment Management',
    'edit-quiz': 'Edit Assessment'
  };

  constructor(private router: Router) { }

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
    const segments = url.split('/').filter(segment => segment && segment !== 'admin');
    
    this.breadcrumbs = [
      { label: 'Dashboard', url: '/admin' }
    ];

    let currentPath = '/admin';
    segments.forEach((segment) => {
      // Remove query/hash/matrix parameters if any
      const cleanSegment = segment.split(/[?#;]/)[0];
      let label = this.routeLabels[cleanSegment] || this.formatSegment(cleanSegment);
      let url = currentPath + `/${cleanSegment}`;

      // Special case: parameterized route base isn't navigable; clicking should go back to the list view.
      if (cleanSegment === 'edit-quiz') {
        url = '/admin/quiz-management';
      } else if (cleanSegment === 'user-details') {
        url = '/admin/user-management';
      } else {
        currentPath = url;
      }

      this.breadcrumbs.push({
        label: label,
        url: url
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
