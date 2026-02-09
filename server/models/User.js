const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  username: String,
  email: String,
  password: String,
  phone: String,
  address: {
    street1: String,
    street2: String,
    street3: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  // Canonical authorization field
  role: {
    type: String,
    enum: ['student', 'instructor', 'admin'],
    default: 'student',
  },
  createdAt: Date,
  updatedAt: Date,
  assessments: [
    {
      id: Number,
      title: String,

      // Optional scope metadata (Milestone E)
      scopeType: {
        type: String,
        required: false,
        enum: ['chapter', 'lesson', 'course'],
      },
      courseId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
      },
      lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
      },
      chapterId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
      },

      completedAt: Date,
      questions: [
        {
          questionNum: Number,
          question: String,
          answers: [String],
          selection: [Number],
          correct: [Number],
          isCorrect: Boolean,
        },
      ],
      score: Number,
      totalQuestions: Number,
      percentScore: Number,
      passed: Boolean,
      duration: Number,
      createdAt: Date,
      updatedAt: Date,
    },
  ],
});

// NOTE: LMS intentionally uses a separate MongoDB collection from the legacy app.
// This avoids sharing the same `users` collection with the old "quizzes" production deployment.
module.exports = mongoose.models.LmsUser || mongoose.model('LmsUser', userSchema, 'lms_users');
