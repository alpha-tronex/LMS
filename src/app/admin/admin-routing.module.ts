import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { UserManagementComponent } from './users/user-management/user-management.component';
import { UserDetailsComponent } from './users/user-details/user-details.component';
import { CreateQuizComponent } from './assessments/create-assessment/create-assessment.component';
import { EditQuizComponent } from './assessments/edit-assessment/edit-assessment.component';
import { UploadQuizComponent } from './assessments/upload-assessment/upload-assessment.component';
import { QuizManagementComponent } from './assessments/assessment-management/assessment-management.component';

const routes: Routes = [
  { path: '', component: AdminDashboardComponent },
  { path: 'user-management', component: UserManagementComponent },
  { path: 'user-details/:id', component: UserDetailsComponent },
  // New canonical assessment routes
  { path: 'create-assessment', component: CreateQuizComponent },
  { path: 'edit-assessment/:id', component: EditQuizComponent },
  { path: 'upload-assessment', component: UploadQuizComponent },
  { path: 'assessment-management', component: QuizManagementComponent },

  // Legacy quiz routes (kept for backwards compatibility)
  { path: 'create-quiz', redirectTo: 'create-assessment', pathMatch: 'full' },
  { path: 'edit-quiz/:id', redirectTo: 'edit-assessment/:id' },
  { path: 'upload-quiz', redirectTo: 'upload-assessment', pathMatch: 'full' },
  { path: 'quiz-management', redirectTo: 'assessment-management', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
