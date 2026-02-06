import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminUserService } from '../../../services/admin-user.service';
import { LoginService } from '../../../services/login-service';
import { UtilService, State, Country } from '../../../services/util.service';
import { ValidationService } from '../../../services/validation.service';
import { User } from '../../../models/users';

@Component({
    selector: 'app-user-details',
    templateUrl: './user-details.component.html',
    styleUrls: ['./user-details.component.css'],
    standalone: false
})
export class UserDetailsComponent implements OnInit, AfterViewInit {
  user: User | null = null;
  loading: boolean = true;
  saving: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  states: State[] = [];
  countries: Country[] = [];
  clientErrors: string[] = [];
  invalidFields: Set<string> = new Set();
  @ViewChild('fnameInput') fnameInput: ElementRef;
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminUserService: AdminUserService,
    private loginService: LoginService,
    private utilService: UtilService,
    private validationService: ValidationService
  ) { }

  ngOnInit() {
    const userId = this.route.snapshot.paramMap.get('id');
    if (userId) {
      this.loadUser(userId);
    } else {
      this.errorMessage = 'No user ID provided';
      this.loading = false;
    }
    
    // Load states
    this.utilService.getStates().subscribe({
      next: (data) => {
        this.states = data;
      },
      error: (error) => {
        console.error('Error loading states:', error);
      }
    });

    // Load countries
    this.utilService.getCountries().subscribe({
      next: (data) => {
        this.countries = data;
      },
      error: (error) => {
        console.error('Error loading countries:', error);
      }
    });
  }

  ngAfterViewInit() {
    // Focus on first name input field after view initializes
    if (this.fnameInput && !this.loading) {
      setTimeout(() => {
        this.fnameInput.nativeElement.focus();
      }, 100);
    }
  }

  loadUser(userId: string): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.adminUserService.getUserById(userId).subscribe({
      next: (data) => {
        this.user = data;
        // Initialize address if it doesn't exist
        if (!this.user.address) {
          this.user.address = {
            street1: '',
            street2: '',
            street3: '',
            city: '',
            state: '',
            zipCode: '',
            country: ''
          };
        } else {
          // Ensure all address fields exist
          this.user.address.street1 = this.user.address.street1 || '';
          this.user.address.street2 = this.user.address.street2 || '';
          this.user.address.street3 = this.user.address.street3 || '';
          this.user.address.city = this.user.address.city || '';
          this.user.address.state = this.user.address.state || '';
          this.user.address.zipCode = this.user.address.zipCode || '';
          this.user.address.country = this.user.address.country || '';
        }
        this.loading = false;
        
        // Focus on first name field after data is loaded
        setTimeout(() => {
          if (this.fnameInput) {
            this.fnameInput.nativeElement.focus();
          }
        }, 100);
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.errorMessage = 'Failed to load user details: ' + error;
        this.loading = false;
      }
    });
  }

  saveUser(): void {
    if (!this.user) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.clientErrors = [];
    this.invalidFields.clear();

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
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.adminUserService.updateUser(this.user).subscribe({
      next: (updatedUser) => {
        this.user = updatedUser;
        this.saving = false;
        this.successMessage = 'User updated successfully!';

        //If the updated user is the currently logged-in user, update LoginService and localStorage
        const currentUser = this.loginService.user;
        if (currentUser && currentUser.id === updatedUser.id) {
          this.loginService.user = updatedUser;
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
        
        // 
        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Clear message after 5 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
      },
      error: (error) => {
        console.error('Error updating user:', error);
        this.errorMessage = 'Failed to update user: ' + error;
        this.saving = false;
        
        // Scroll to top to show error message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/user-management']);
  }

  isFieldInvalid(fieldName: string): boolean {
    return this.invalidFields.has(fieldName);
  }
}
