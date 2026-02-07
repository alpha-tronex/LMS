import { Injectable } from '@angular/core';

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ValidationService {

  constructor() { }

  /**
   * Validate username
   */
  validateUsername(username: string): ValidationResult {
    if (!username || typeof username !== 'string') {
      return { valid: false, error: 'Username is required' };
    }
    
    const trimmed = username.trim();
    
    if (trimmed.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters' };
    }
    
    if (!/^[A-Za-z0-9]+$/.test(trimmed)) {
      return { valid: false, error: 'Username may contain only letters and numbers' };
    }
    
    return { valid: true, error: null };
  }

  /**
   * Validate password
   */
  validatePassword(password: string): ValidationResult {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Password is required' };
    }
    
    if (password.length < 6) {
      return { valid: false, error: 'Password must be at least 6 characters' };
    }
    
    return { valid: true, error: null };
  }

  /**
   * Validate email address
   */
  validateEmail(email: string): ValidationResult {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email is required' };
    }
    
    const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{3,}$/;
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Invalid email address' };
    }
    
    return { valid: true, error: null };
  }

  /**
   * Validate phone number
   */
  validatePhone(phone: string): ValidationResult {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, error: 'Phone number is required' };
    }

    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length > 0 && digitsOnly.length < 10) {
      return { valid: false, error: 'Phone number must be at least 10 digits' };
    }
    
    const phoneRegex = /^(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
    if (!phoneRegex.test(phone)) {
      return { valid: false, error: 'Invalid phone number format' };
    }
    
    return { valid: true, error: null };
  }

  /**
   * Validate name (first name or last name)
   */
  validateName(name: string, fieldName: string = 'Name'): ValidationResult {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: `${fieldName} is required` };
    }
    
    const trimmed = name.trim();
    
    if (trimmed.length < 2) {
      return { valid: false, error: `${fieldName} must be at least 2 characters` };
    }
    
    return { valid: true, error: null };
  }

  /**
   * Validate user role
   */
  validateUserRole(role: string): ValidationResult {
    const validRoles = ['student', 'admin'];

    if (!role || !validRoles.includes(role)) {
      return { valid: false, error: 'Role must be either student or admin' };
    }
    
    return { valid: true, error: null };
  }

  /**
   * Validate zip code (US format: 12345 or 12345-6789)
   */
  validateZipCode(zipCode: string): ValidationResult {
    if (!zipCode || typeof zipCode !== 'string') {
      return { valid: false, error: 'Zip code is required' };
    }
    
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(zipCode.trim())) {
      return { valid: false, error: 'Invalid zip code format (use 12345 or 12345-6789)' };
    }
    
    return { valid: true, error: null };
  }

  /**
   * Validate required fields and return all errors
   */
  validateRequiredFields(fields: { [key: string]: any }, requiredFields: string[]): string[] {
    const errors: string[] = [];
    
    requiredFields.forEach(fieldName => {
      if (!fields[fieldName] || (typeof fields[fieldName] === 'string' && !fields[fieldName].trim())) {
        errors.push(`${fieldName} is required`);
      }
    });
    
    return errors;
  }

  /**
   * Validate all fields in a form
   */
  validateForm(formData: any): { valid: boolean; errors: string[]; invalidFields: string[] } {
    const errors: string[] = [];
    const invalidFields: string[] = [];

    // Username validation
    if (formData.uname !== undefined) {
      const usernameResult = this.validateUsername(formData.uname);
      if (!usernameResult.valid && usernameResult.error) {
        errors.push(usernameResult.error);
        invalidFields.push('uname');
      }
    }

    // Password validation
    if (formData.pass !== undefined) {
      const passwordResult = this.validatePassword(formData.pass);
      if (!passwordResult.valid && passwordResult.error) {
        errors.push(passwordResult.error);
        invalidFields.push('pass');
      }
    }

    // Email validation (only if provided and not empty)
    if (formData.email !== undefined && formData.email && formData.email.trim()) {
      const emailResult = this.validateEmail(formData.email);
      if (!emailResult.valid && emailResult.error) {
        errors.push(emailResult.error);
        invalidFields.push('email');
      }
    }

    // Phone validation (only if provided and not empty)
    if (formData.phone !== undefined && formData.phone && formData.phone.trim()) {
      const phoneResult = this.validatePhone(formData.phone);
      if (!phoneResult.valid && phoneResult.error) {
        errors.push(phoneResult.error);
        invalidFields.push('phone');
      }
    }

    // First name validation (only if provided and not empty)
    if (formData.fname !== undefined && formData.fname && formData.fname.trim()) {
      const fnameResult = this.validateName(formData.fname, 'First name');
      if (!fnameResult.valid && fnameResult.error) {
        errors.push(fnameResult.error);
        invalidFields.push('fname');
      }
    }

    // Last name validation (only if provided and not empty)
    if (formData.lname !== undefined && formData.lname && formData.lname.trim()) {
      const lnameResult = this.validateName(formData.lname, 'Last name');
      if (!lnameResult.valid && lnameResult.error) {
        errors.push(lnameResult.error);
        invalidFields.push('lname');
      }
    }

    // Role validation
    if (formData.role !== undefined) {
      const roleResult = this.validateUserRole(formData.role);
      if (!roleResult.valid && roleResult.error) {
        errors.push(roleResult.error);
        invalidFields.push('role');
      }
    }

    // Zip code validation
    if (formData.zipCode !== undefined && formData.zipCode && formData.zipCode.trim()) {
      const zipCodeResult = this.validateZipCode(formData.zipCode);
      if (!zipCodeResult.valid && zipCodeResult.error) {
        errors.push(zipCodeResult.error);
        invalidFields.push('zipCode');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      invalidFields: invalidFields
    };
  }
}
