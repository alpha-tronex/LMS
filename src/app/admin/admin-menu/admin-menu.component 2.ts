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
      title: 'Create Quiz',
      description: 'Create a new quiz from scratch',
      icon: 'fas fa-plus-circle',
      route: '/admin/create-quiz',
      color: 'success'
    },
    {
      title: 'Upload Quiz',
      description: 'Upload a quiz from a JSON file',
      icon: 'fas fa-upload',
      route: '/admin/upload-quiz',
      color: 'info'
    },
    {
      title: 'Quiz Management',
      description: 'Edit quizzes and manage quiz data',
      icon: 'fas fa-cogs',
      route: '/admin/quiz-management',
      color: 'warning'
    }
  ];
}
