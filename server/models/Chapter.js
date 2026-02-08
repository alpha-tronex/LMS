const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  title: { type: String, required: true },
  sortOrder: { type: Number, default: 0, index: true },

  content: { type: mongoose.Schema.Types.Mixed, default: {} },

  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
    index: true,
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

chapterSchema.index({ lessonId: 1, status: 1, sortOrder: 1 });
chapterSchema.index({ courseId: 1, lessonId: 1, status: 1, sortOrder: 1 });

module.exports = mongoose.models.Chapter || mongoose.model('Chapter', chapterSchema, 'chapters');
