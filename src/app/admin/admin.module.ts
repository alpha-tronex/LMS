import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AdminRoutingModule } from './admin-routing.module';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { AdminBreadcrumbComponent } from './admin-breadcrumb/admin-breadcrumb.component';
import { AdminMenuComponent } from './admin-menu/admin-menu.component';
import { UserManagementComponent } from './users/user-management/user-management.component';
import { UserDetailsComponent } from './users/user-details/user-details.component';
import { CreateQuizComponent } from './quizzes/create-quiz/create-quiz.component';
import { EditQuizComponent } from './quizzes/edit-quiz/edit-quiz.component';
import { UploadQuizComponent } from './quizzes/upload-quiz/upload-quiz.component';
import { QuizManagementComponent } from './quizzes/quiz-management/quiz-management.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [
    AdminDashboardComponent,
    AdminBreadcrumbComponent,
    AdminMenuComponent,
    UserManagementComponent,
    CreateQuizComponent,
    EditQuizComponent,
    UploadQuizComponent,
    UserDetailsComponent,
    QuizManagementComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    AdminRoutingModule,
    SharedModule
  ],
  providers: [provideHttpClient(withInterceptorsFromDi())]
})
export class AdminModule { }
