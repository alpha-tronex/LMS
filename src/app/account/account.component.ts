import { Component, OnInit } from '@angular/core';
import { User } from '@models/users';
import { LoginService } from '@core/services/login-service';
import { UtilService, State, Country } from '@shared/services/util.service';
import { ValidationService } from '@shared/services/validation.service';
import { LoggerService } from '@core/services/logger.service';
import { ScrollService } from '@core/services/scroll.service';

@Component({
    selector: 'app-account',
    templateUrl: './account.component.html',
    styleUrls: ['./account.component.css'],
    standalone: false
})
export class AccountComponent implements OnInit {
  user: User;
  loading: boolean = false;
  error: string = '';
  editMode: boolean = false;
  saving: boolean = false;
  serverErrors: string[] = [];
  states: State[] = [];
  countries: Country[] = [];
  clientErrors: string[] = [];
  invalidFields: Set<string> = new Set();

  constructor(
    private loginService: LoginService,
    private utilService: UtilService,
    private validationService: ValidationService,
    private logger: LoggerService,
    private scroll: ScrollService
  ) { }

  ngOnInit() {
    // Get the current logged-in user from the login service
    this.user = this.loginService.user;
    
    if (!this.user) {
      this.error = 'No user is currently logged in.';
    } else if (!this.user.address) {
      this.user.address = {
        street1: '',
        street2: '',
        street3: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      };
    }
    
    // Load states
    this.utilService.getStates().subscribe({
      next: (data) => {
        this.states = data;
      },
      error: (error) => {
        this.logger.error('Error loading states', error);
      }
    });

    // Load countries
    this.utilService.getCountries().subscribe({
      next: (data) => {
        this.countries = data;
      },
      error: (error) => {
        this.logger.error('Error loading countries', error);
      }
    });
  }

  toggleEditMode(): void {
    this.editMode = !this.editMode;
    this.serverErrors = [];
    this.error = '';
    this.scroll.toTop();
  }

  saveChanges(): void {
    if (!this.user) return;
    
    this.saving = true;
    this.serverErrors = [];
    this.clientErrors = [];
    this.invalidFields.clear();
    this.error = '';

    // Client-side validation
    const validationResult = this.validationService.validateForm({
      fname: this.user.fname,
      lname: this.user.lname,
      email: this.user.email,
      phone: this.user.phone,
      zipCode: this.user.address?.zipCode
    });

    if (!validationResult.valid) {
      this.clientErrors = validationResult.errors;
      this.invalidFields = new Set(validationResult.invalidFields);
      this.saving = false;
      this.scroll.toTop();
      return;
    }
    
    this.loginService.updateUser(this.user).subscribe({
      next: (updatedUser) => {
        this.user = updatedUser;
        this.editMode = false;
        this.saving = false;
        this.scroll.toTop();
      },
      error: (err) => {
        this.saving = false;
        if (err && typeof err === 'object') {
          if (Array.isArray(err.errors)) {
            this.serverErrors = err.errors;
          } else if (err.error && Array.isArray(err.error.errors)) {
            this.serverErrors = err.error.errors;
          } else if (err.message) {
            this.serverErrors = [err.message];
          } else {
            this.serverErrors = [JSON.stringify(err)];
          }
        } else if (typeof err === 'string') {
          this.serverErrors = [err];
        } else {
          this.serverErrors = ['An error occurred while updating user information'];
        }
        this.scroll.toTop();
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    return this.invalidFields.has(fieldName);
  }

}
