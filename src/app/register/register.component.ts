import { Component, OnDestroy, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { User } from '@models/users';
import { LoginService } from '@core/services/login-service';
import { ValidationService } from '@shared/services/validation.service';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.css'],
    standalone: false
})
export class RegisterComponent implements OnInit, OnDestroy, AfterViewInit {
  user: User;
  subscription: Subscription;
  serverErrors: string[] = [];
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  clientErrors: string[] = [];
  invalidFields: Set<string> = new Set();
  @ViewChild('usernameInput') usernameInput: ElementRef;
  constructor(
    private router: Router,
    private loginService: LoginService,
    private validationService: ValidationService
  ) { }

  ngOnInit() {
    this.user = {
      id: '',
      uname: '',
      email: '',
      pass: '',
      confirmPass: '',
      type: '',
      fname: '',
      lname: '',
      phone: '',
      address: {
        street1: '',
        street2: '',
        street3: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      quizzes: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  ngAfterViewInit() {
    // Focus on username input field after view initializes
    if (this.usernameInput) {
      setTimeout(() => {
        this.usernameInput.nativeElement.focus();
      }, 0);
    }
  }

  registerStudent(): void {
    this.serverErrors = [];
    this.clientErrors = [];
    this.invalidFields.clear();

    // Check password confirmation
    if (this.user.pass !== this.user.confirmPass) {
      this.clientErrors.push('Passwords do not match');
      this.invalidFields.add('pass');
      this.invalidFields.add('confirmPass');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Client-side validation using validateForm
    const validationResult = this.validationService.validateForm({
      uname: this.user.uname,
      pass: this.user.pass,
      email: this.user.email,
      phone: this.user.phone,
      fname: this.user.fname,
      lname: this.user.lname,
      zipCode: this.user.address?.zipCode
    });

    if (!validationResult.valid) {
      this.clientErrors = validationResult.errors;
      this.invalidFields = new Set(validationResult.invalidFields);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.subscription = this.loginService.register(this.user).subscribe({
      next: (user) => {
        this.user = user;
        this.router.navigate(['home']);
      },
      error: (err) => {
        // err may be an object like { errors: [...] } or a string
        if (err && typeof err === 'object') {
          if (Array.isArray(err.errors)) {
            this.serverErrors = err.errors;
          } else if (err.error && Array.isArray(err.error.errors)) {
            this.serverErrors = err.error.errors;
          } else if (err.error && err.error.error) {
            // Handle single error field (e.g., { error: "message" })
            this.serverErrors = [err.error.error];
          } else if (err.message) {
            this.serverErrors = [err.message];
          } else {
            this.serverErrors = ['An error occurred during registration'];
          }
        } else if (typeof err === 'string') {
          this.serverErrors = [err];
        } else {
          this.serverErrors = ['An unknown error occurred'];
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  isFieldInvalid(fieldName: string): boolean {
    return this.invalidFields.has(fieldName);
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
