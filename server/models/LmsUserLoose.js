const mongoose = require('mongoose');

// A permissive model to read/write legacy or unknown fields (e.g., during migrations).
// Targets the LMS users collection only.
const userAnySchema = new mongoose.Schema({}, { strict: false, collection: 'lms_users' });

module.exports = mongoose.models.LmsUserLoose || mongoose.model('LmsUserLoose', userAnySchema);
