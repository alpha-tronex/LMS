import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminBreadcrumbComponent } from '../admin-breadcrumb/admin-breadcrumb.component';
import { AdminMenuComponent } from '../admin-menu/admin-menu.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ 
        AdminDashboardComponent,
        AdminBreadcrumbComponent,
        AdminMenuComponent
      ],
      imports: [ 
        HttpClientTestingModule,
        RouterTestingModule
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
