/**
 * Common validation functions for the quiz application
 */

/**
 * Validate username
 * @param {string} username - Username to validate
 * @returns {object} - { valid: boolean, error: string }
 */
function validateUsername(username) {
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
 * @param {string} password - Password to validate
 * @returns {object} - { valid: boolean, error: string }
 */
function validatePassword(password) {
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
 * @param {string} email - Email to validate
 * @returns {object} - { valid: boolean, error: string }
 */
function validateEmail(email) {
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
 * @param {string} phone - Phone number to validate
 * @returns {object} - { valid: boolean, error: string }
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }
  
  const phoneRegex = /^(\+?\d{1,3}[-\.\s]?)?\(?\d{3}\)?[-\.\s]?\d{3}[-\.\s]?\d{4}$/;
  if (!phoneRegex.test(phone)) {
    return { valid: false, error: 'Invalid phone number format' };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate name (first name or last name)
 * @param {string} name - Name to validate
 * @param {string} fieldName - Field name for error message
 * @returns {object} - { valid: boolean, error: string }
 */
function validateName(name, fieldName = 'Name') {
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
 * @param {string} role - User role to validate
 * @returns {object} - { valid: boolean, error: string }
 */
function validateUserRole(role) {
  const validRoles = ['student', 'admin', 'instructor'];

  if (!role || !validRoles.includes(role)) {
    return { valid: false, error: 'Role must be one of: student, instructor, admin' };
  }

  return { valid: true, error: null };
}

// Backwards compatible alias
function validateUserType(type) {
  return validateUserRole(type);
}

/**
 * Validate zip code (US format: 12345 or 12345-6789)
 * @param {string} zipCode - Zip code to validate
 * @returns {object} - { valid: boolean, error: string }
 */
function validateZipCode(zipCode) {
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
 * @param {object} fields - Object with field names and values
 * @param {array} requiredFields - Array of required field names
 * @returns {array} - Array of error messages
 */
function validateRequiredFields(fields, requiredFields) {
  const errors = [];
  
  requiredFields.forEach(fieldName => {
    if (!fields[fieldName] || (typeof fields[fieldName] === 'string' && !fields[fieldName].trim())) {
      errors.push(`${fieldName} is required`);
    }
  });
  
  return errors;
}

module.exports = {
  validateUsername,
  validatePassword,
  validateEmail,
  validatePhone,
  validateName,
  validateUserRole,
  validateUserType,
  validateZipCode,
  validateRequiredFields
};
