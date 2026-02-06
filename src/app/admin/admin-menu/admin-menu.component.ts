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
  menuItems: MenuItem[] = [
    {
      title: 'User Management',
      description: 'View, edit, and manage user accounts',
      icon: 'fas fa-users',
      route: '/admin/user-management',
      color: 'primary'
    },
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
      description: 'Manage assessments and user data',
      icon: 'fas fa-cogs',
      route: '/admin/assessment-management',
      color: 'warning'
    }
  ];
}
