const mongoose = require('mongoose');

const ContentAssessmentSchema = new mongoose.Schema(
  {
    scopeType: {
      type: String,
      required: true,
      enum: ['chapter', 'lesson', 'course'],
      index: true,
    },
    scopeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Denormalized for fast lookups when building course content trees.
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      index: true,
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      index: true,
    },

    // Assessments are stored on disk and addressed by numeric ID.
    assessmentId: {
      type: Number,
      required: true,
      index: true,
    },

    isRequired: {
      type: Boolean,
      default: true,
    },
    passScore: {
      type: Number,
      required: false,
      min: 0,
      max: 100,
    },
    // null/undefined => unlimited attempts
    maxAttempts: {
      type: Number,
      required: false,
      min: 1,
    },

    status: {
      type: String,
      required: true,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },

    archivedAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true, collection: 'content_assessments' }
);

// Only allow one active assessment per scope.
ContentAssessmentSchema.index(
  { scopeType: 1, scopeId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
  }
);

ContentAssessmentSchema.index({ courseId: 1, status: 1, scopeType: 1 });

module.exports = mongoose.model('ContentAssessment', ContentAssessmentSchema);
