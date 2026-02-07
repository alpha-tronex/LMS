const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  status: {
    type: String,
    enum: ['enrolled', 'withdrawn'],
    default: 'enrolled',
    index: true,
  },
  enrolledAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Prevent duplicate enrollments for the same user/course
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports =
  mongoose.models.Enrollment ||
  mongoose.model('Enrollment', enrollmentSchema, 'enrollments');
