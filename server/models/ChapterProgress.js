const mongoose = require('mongoose');

const chapterProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started',
    index: true,
  },

  startedAt: { type: Date, required: false },
  completedAt: { type: Date, required: false },
  lastAccessedAt: { type: Date, required: false },

  updatedAt: { type: Date, default: Date.now },
});

chapterProgressSchema.index({ userId: 1, chapterId: 1 }, { unique: true });
chapterProgressSchema.index({ userId: 1, courseId: 1, status: 1 });

module.exports =
  mongoose.models.ChapterProgress ||
  mongoose.model('ChapterProgress', chapterProgressSchema, 'chapter_progress');
