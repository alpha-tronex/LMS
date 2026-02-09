function sendError(res, status, message, extra) {
  const payload = {
    error: message,
  };

  if (extra && typeof extra === 'object') {
    Object.assign(payload, extra);
  }

  return res.status(status).json(payload);
}

function sendValidationError(res, errors) {
  const list = Array.isArray(errors) ? errors.filter(Boolean) : [];
  return sendError(res, 400, 'Validation failed', { errors: list });
}

module.exports = {
  sendError,
  sendValidationError,
};
