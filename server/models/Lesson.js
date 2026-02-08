const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  title: { type: String, required: true },
  description: { type: String, default: '' },
  sortOrder: { type: Number, default: 0, index: true },

  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
    index: true,
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

lessonSchema.index({ courseId: 1, status: 1, sortOrder: 1 });

module.exports = mongoose.models.Lesson || mongoose.model('Lesson', lessonSchema, 'lessons');
