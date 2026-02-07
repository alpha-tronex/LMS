import { TestBed } from '@angular/core/testing';
import { ValidationService } from './validation.service';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ValidationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('validateUsername', () => {
    it('should reject empty username', () => {
      const result = service.validateUsername('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username is required');
    });

    it('should reject username shorter than 3 characters', () => {
      const result = service.validateUsername('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username must be at least 3 characters');
    });

    it('should reject username with special characters', () => {
      const result = service.validateUsername('user@123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username may contain only letters and numbers');
    });

    it('should accept valid username', () => {
      const result = service.validateUsername('user123');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe('validatePassword', () => {
    it('should reject empty password', () => {
      const result = service.validatePassword('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password is required');
    });

    it('should reject password shorter than 6 characters', () => {
      const result = service.validatePassword('12345');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 6 characters');
    });

    it('should accept valid password', () => {
      const result = service.validatePassword('password123');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe('validateEmail', () => {
    it('should reject empty email', () => {
      const result = service.validateEmail('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should reject invalid email format', () => {
      const result = service.validateEmail('notanemail');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid email address');
    });

    it('should accept valid email', () => {
      const result = service.validateEmail('user@example.com');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe('validatePhone', () => {
    it('should reject empty phone', () => {
      const result = service.validatePhone('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Phone number is required');
    });

    it('should reject phone shorter than 10 digits', () => {
      const result = service.validatePhone('123456789');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Phone number must be at least 10 digits');
    });

    it('should accept valid phone number', () => {
      const result = service.validatePhone('(555) 123-4567');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe('validateName', () => {
    it('should reject empty name', () => {
      const result = service.validateName('', 'First name');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('First name is required');
    });

    it('should reject name shorter than 2 characters', () => {
      const result = service.validateName('A', 'Last name');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Last name must be at least 2 characters');
    });

    it('should accept valid name', () => {
      const result = service.validateName('John', 'First name');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe('validateForm', () => {
    it('should validate complete form with all valid fields', () => {
      const formData = {
        uname: 'johndoe',
        pass: 'password123',
        email: 'john@example.com',
        phone: '1234567890',
        fname: 'John',
        lname: 'Doe',
        role: 'student'
      };
      const result = service.validateForm(formData);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should return errors for invalid fields', () => {
      const formData = {
        uname: 'ab',
        pass: '123',
        email: 'invalid',
        phone: '123',
        fname: 'J',
        lname: 'D'
      };
      const result = service.validateForm(formData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
