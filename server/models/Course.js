const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  description: { type: String, default: '' },
  // Instructors who are allowed to manage this course (content, enrollments, etc.)
  instructorIds: {
    type: [mongoose.Schema.Types.ObjectId],
    default: [],
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
    index: true,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Course || mongoose.model('Course', courseSchema, 'courses');
