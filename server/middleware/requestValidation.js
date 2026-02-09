const validators = require('../utils/validators');
const { sendValidationError } = require('../utils/responses');

function requireBodyFields(requiredFields) {
  const required = Array.isArray(requiredFields) ? requiredFields : [];
  return (req, res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const errors = validators.validateRequiredFields(body, required);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }
    return next();
  };
}

function validateLoginBody(req, res, next) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const unameValidation = validators.validateUsername(body.uname);
  const passValidation = validators.validatePassword(body.pass);

  const errors = [];
  if (!unameValidation.valid) errors.push(unameValidation.error);
  if (!passValidation.valid) errors.push(passValidation.error);

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  return next();
}

module.exports = {
  requireBodyFields,
  validateLoginBody,
};
