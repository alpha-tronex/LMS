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
import { CreateAssessmentComponent } from './assessments/create-assessment/create-assessment.component';
import { EditAssessmentComponent } from './assessments/edit-assessment/edit-assessment.component';
import { UploadAssessmentComponent } from './assessments/upload-assessment/upload-assessment.component';
import { AssessmentManagementComponent } from './assessments/assessment-management/assessment-management.component';
import { SharedModule } from '../shared/shared.module';
import { CourseManagementComponent } from './courses/course-management/course-management.component';
import { CourseContentManagementComponent } from './courses/course-content-management/course-content-management.component';
import { CourseInstructorsComponent } from './courses/course-instructors/course-instructors.component';
import { EnrollmentManagementComponent } from './enrollments/enrollment-management/enrollment-management.component';
import { ChapterPageEditorComponent } from './courses/chapter-page-editor/chapter-page-editor.component';
import { CourseRosterComponent } from './courses/course-roster/course-roster.component';

@NgModule({
  declarations: [
    AdminDashboardComponent,
    AdminBreadcrumbComponent,
    AdminMenuComponent,
    CourseManagementComponent,
    CourseContentManagementComponent,
    ChapterPageEditorComponent,
    CourseInstructorsComponent,
    CourseRosterComponent,
    EnrollmentManagementComponent,
    UserManagementComponent,
    CreateAssessmentComponent,
    EditAssessmentComponent,
    UploadAssessmentComponent,
    UserDetailsComponent,
    AssessmentManagementComponent
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
