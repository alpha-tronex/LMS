const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/authMiddleware');
const { sendError, sendValidationError } = require('../utils/responses');
const { computeCourseCompletion } = require('../utils/courseCompletion');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

module.exports = function courseSurveyRoutes(
  app,
  Course,
  Lesson,
  Chapter,
  ChapterProgress,
  ContentAssessment,
  User,
  CourseSurvey
) {
  // Status endpoint used by the UI to decide whether to show the survey.
  app.get('/api/courses/:courseId/survey/status', verifyToken, async (req, res) => {
    try {
      const userId = req.user && req.user.id;
      const { courseId } = req.params;

      if (!userId || !isValidObjectId(String(userId))) {
        return sendError(res, 400, 'Invalid user id');
      }
      if (!isValidObjectId(String(courseId))) {
        return sendError(res, 400, 'Invalid courseId');
      }

      const completion = await computeCourseCompletion({
        Course,
        Lesson,
        Chapter,
        ChapterProgress,
        ContentAssessment,
        User,
        userId,
        courseId,
      });

      if (!completion.ok) {
        return sendError(res, completion.status || 500, completion.error || 'Internal server error');
      }

      const existing = await CourseSurvey.findOne({
        userId: new mongoose.Types.ObjectId(String(userId)),
        courseId: new mongoose.Types.ObjectId(String(courseId)),
      }).lean();

      return res.status(200).json({
        courseCompleted: !!completion.completed,
        chaptersCompleted: !!completion.chaptersCompleted,
        finalAssessmentRequired: !!completion.finalAssessmentRequired,
        finalAssessmentPassed: !!completion.finalAssessmentPassed,
        surveySubmitted: !!existing,
      });
    } catch (err) {
      console.log('err: ' + err);
      return sendError(res, 500, 'Internal server error');
    }
  });

  // Submit end-of-course survey (STRICTLY post-completion).
  app.post('/api/courses/:courseId/survey', verifyToken, async (req, res) => {
    try {
      const userId = req.user && req.user.id;
      const { courseId } = req.params;

      if (!userId || !isValidObjectId(String(userId))) {
        return sendError(res, 400, 'Invalid user id');
      }
      if (!isValidObjectId(String(courseId))) {
        return sendError(res, 400, 'Invalid courseId');
      }

      const ratingOverall = Number(req.body && req.body.ratingOverall);
      const ratingDifficultyRaw = req.body && req.body.ratingDifficulty;
      const ratingDifficulty = ratingDifficultyRaw === undefined || ratingDifficultyRaw === null || ratingDifficultyRaw === ''
        ? undefined
        : Number(ratingDifficultyRaw);
      const commentRaw = req.body && req.body.comment;
      const comment = typeof commentRaw === 'string' ? commentRaw : '';

      const errors = [];
      if (!Number.isInteger(ratingOverall) || ratingOverall < 1 || ratingOverall > 5) {
        errors.push('ratingOverall must be an integer between 1 and 5');
      }
      if (ratingDifficulty !== undefined) {
        if (!Number.isInteger(ratingDifficulty) || ratingDifficulty < 1 || ratingDifficulty > 5) {
          errors.push('ratingDifficulty must be an integer between 1 and 5');
        }
      }
      if (typeof comment !== 'string') {
        errors.push('comment must be a string');
      }
      if (comment && comment.length > 2000) {
        errors.push('comment must be <= 2000 characters');
      }
      if (errors.length > 0) {
        return sendValidationError(res, errors);
      }

      const completion = await computeCourseCompletion({
        Course,
        Lesson,
        Chapter,
        ChapterProgress,
        ContentAssessment,
        User,
        userId,
        courseId,
      });

      if (!completion.ok) {
        return sendError(res, completion.status || 500, completion.error || 'Internal server error');
      }

      if (!completion.completed) {
        return sendError(res, 403, 'Course is not completed');
      }

      const now = new Date();
      const filter = {
        userId: new mongoose.Types.ObjectId(String(userId)),
        courseId: new mongoose.Types.ObjectId(String(courseId)),
      };

      const existing = await CourseSurvey.findOne(filter).lean();
      if (existing) {
        return res.status(200).json({
          message: 'Survey already submitted',
          submittedAt: existing.submittedAt ? new Date(existing.submittedAt).toISOString() : null,
        });
      }

      await CourseSurvey.create({
        ...filter,
        ratingOverall,
        ratingDifficulty,
        comment,
        submittedAt: now,
        updatedAt: now,
      });

      return res.status(201).json({ message: 'Survey submitted' });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(200).json({ message: 'Survey already submitted' });
      }
      console.log('err: ' + err);
      return sendError(res, 500, 'Internal server error');
    }
  });
};
