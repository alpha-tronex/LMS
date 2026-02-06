import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { QuestionsComponent } from './questions/questions.component';
import { AppRoutingModule } from './/app-routing.module';
import { HomeComponent } from './home/home.component';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { LoginComponent } from './login/login.component';
import { AccountComponent } from './account/account.component';
import { RegisterComponent } from './register/register.component';
import { HistoryComponent } from './history/history.component';
import { BreadcrumbComponent } from './breadcrumb/breadcrumb.component';
import { LoginService } from '@core/services/login-service';
import { QuestionsService } from '@core/services/questions-service';
import { AuthInterceptor } from '@core/services/auth.interceptor';
import { SharedModule } from './shared/shared.module';

@NgModule({
    declarations: [
        AppComponent,
        QuestionsComponent,
        HomeComponent,
        HeaderComponent,
        FooterComponent,
        LoginComponent,
        AccountComponent,
        RegisterComponent,
        HistoryComponent,
        BreadcrumbComponent
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        AppRoutingModule,
        FormsModule,
        SharedModule], providers: [
            LoginService,
            QuestionsService,
            {
                provide: HTTP_INTERCEPTORS,
                useClass: AuthInterceptor,
                multi: true
            },
            provideHttpClient(withInterceptorsFromDi())
        ]
})
export class AppModule { }
