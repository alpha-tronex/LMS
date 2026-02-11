import { Component } from '@angular/core';

interface MenuItem {
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
}

@Component({
    selector: 'app-admin-menu',
    templateUrl: './admin-menu.component.html',
    styleUrls: ['./admin-menu.component.css'],
    standalone: false
})
export class AdminMenuComponent {
  private readonly isStrictAdmin: boolean;

  menuItems: MenuItem[];

  constructor() {
    this.isStrictAdmin = this.getCurrentRole() === 'admin';

    this.menuItems = [
      {
        title: 'Course Management',
        description: 'Create, edit, and archive courses',
        icon: 'fas fa-book',
        route: '/admin/course-management',
        color: 'info'
      },
      {
        title: 'Enrollment Management',
        description: 'Enroll or withdraw students from courses',
        icon: 'fas fa-user-check',
        route: '/admin/enrollment-management',
        color: 'secondary'
      },
      ...(this.isStrictAdmin
        ? [
            {
              title: 'Course Data Management',
              description: 'Delete courses and user course data',
              icon: 'fas fa-trash',
              route: '/admin/course-data-management',
              color: 'danger'
            } as MenuItem,
            {
              title: 'User Management',
              description: 'View, edit, and manage user accounts',
              icon: 'fas fa-users',
              route: '/admin/user-management',
              color: 'primary'
            } as MenuItem
          ]
        : []),
      {
        title: 'Create Assessment',
        description: 'Create a new assessment from scratch',
        icon: 'fas fa-plus-circle',
        route: '/admin/create-assessment',
        color: 'success'
      },
      {
        title: 'Upload Assessment',
        description: 'Upload an assessment from a JSON file',
        icon: 'fas fa-upload',
        route: '/admin/upload-assessment',
        color: 'info'
      },
      {
        title: 'Assessment Management',
        description: 'Manage assessment files',
        icon: 'fas fa-cogs',
        route: '/admin/assessment-management',
        color: 'warning'
      }
    ];
  }

  private getCurrentRole(): string {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      return parsed?.role || '';
    } catch {
      return '';
    }
  }
}
