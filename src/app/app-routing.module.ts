import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QuestionsComponent } from './questions/questions.component';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { AccountComponent } from './account/account.component';
import { HistoryComponent } from './history/history.component';
import { CourseCatalogComponent } from './courses/course-catalog/course-catalog.component';
import { MyCoursesComponent } from './courses/my-courses/my-courses.component';
import { CourseDetailComponent } from './courses/course-detail/course-detail.component';
import { ChapterViewerComponent } from './courses/chapter-viewer/chapter-viewer.component';


const routes: Routes = [
  { path: '', component: HomeComponent }, // Default route
  { path: 'questions', component: QuestionsComponent },
  { path: 'courses', component: CourseCatalogComponent },
  { path: 'my-courses', component: MyCoursesComponent },
  { path: 'courses/:courseId/chapters/:chapterId', component: ChapterViewerComponent },
  { path: 'courses/:id', component: CourseDetailComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'account', component: AccountComponent },
  { path: 'history', component: HistoryComponent },
  { 
    path: 'admin', 
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
  },
  { path: '**', redirectTo: '' } // Redirect unknown routes to home
];


@NgModule({
  imports: [RouterModule.forRoot(routes, {
    scrollPositionRestoration: 'top',
    anchorScrolling: 'enabled'
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
