const mongoose = require('mongoose');

const courseSurveySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  ratingOverall: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  ratingDifficulty: {
    type: Number,
    required: false,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: false,
    default: '',
  },
  submittedAt: {
    type: Date,
    required: true,
  },
  updatedAt: {
    type: Date,
    required: true,
  },
});

courseSurveySchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.models.CourseSurvey || mongoose.model('CourseSurvey', courseSurveySchema, 'course_surveys');
