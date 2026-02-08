import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { UserManagementComponent } from './users/user-management/user-management.component';
import { UserDetailsComponent } from './users/user-details/user-details.component';
import { CreateAssessmentComponent } from './assessments/create-assessment/create-assessment.component';
import { EditAssessmentComponent } from './assessments/edit-assessment/edit-assessment.component';
import { UploadAssessmentComponent } from './assessments/upload-assessment/upload-assessment.component';
import { AssessmentManagementComponent } from './assessments/assessment-management/assessment-management.component';
import { CourseManagementComponent } from './courses/course-management/course-management.component';
import { CourseContentManagementComponent } from './courses/course-content-management/course-content-management.component';

const routes: Routes = [
  { path: '', component: AdminDashboardComponent },
  { path: 'course-management', component: CourseManagementComponent },
  { path: 'course-content/:courseId', component: CourseContentManagementComponent },
  { path: 'user-management', component: UserManagementComponent },
  { path: 'user-details/:id', component: UserDetailsComponent },
  // New canonical assessment routes
  { path: 'create-assessment', component: CreateAssessmentComponent },
  { path: 'edit-assessment/:id', component: EditAssessmentComponent },
  { path: 'upload-assessment', component: UploadAssessmentComponent },
  { path: 'assessment-management', component: AssessmentManagementComponent },

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
