const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/authMiddleware');
const { sendError, sendValidationError } = require('../utils/responses');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function computePercentScore(attempt) {
  if (!attempt) return null;
  if (Number.isFinite(Number(attempt.percentScore))) return Number(attempt.percentScore);
  const score = Number(attempt.score);
  const total = Number(attempt.totalQuestions);
  if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(100, (score / total) * 100));
}

function isAttemptPassingForMapping(attempt, mapping) {
  if (!attempt || !mapping) return false;
  if (Number(attempt.id) !== Number(mapping.assessmentId)) return false;
  if (attempt.passed === true) return true;

  const passScore = mapping.passScore;
  if (!Number.isFinite(Number(passScore))) {
    // If no passScore is configured, treat any attempt as passing.
    return true;
  }

  const pct = computePercentScore(attempt);
  if (!Number.isFinite(Number(pct))) return false;
  return Number(pct) >= Number(passScore);
}

async function computeCourseCompletion({
  Course,
  Lesson,
  Chapter,
  ChapterProgress,
  ContentAssessment,
  User,
  userId,
  courseId,
}) {
  const course = await Course.findOne({
    _id: new mongoose.Types.ObjectId(String(courseId)),
    status: 'active',
  }).lean();

  if (!course) {
    return { ok: false, status: 404, error: 'Course not found' };
  }

  const lessons = await Lesson.find({
    courseId: new mongoose.Types.ObjectId(String(courseId)),
    status: 'active',
  }).lean();

  const chapters = await Chapter.find({
    courseId: new mongoose.Types.ObjectId(String(courseId)),
    status: 'active',
  }).lean();

  if (!lessons || lessons.length === 0 || !chapters || chapters.length === 0) {
    return {
      ok: true,
      completed: false,
      chaptersCompleted: false,
      finalAssessmentRequired: false,
      finalAssessmentPassed: false,
    };
  }

  const chapterIds = chapters.map((c) => String(c._id));
  const progressItems = await ChapterProgress.find({
    userId: new mongoose.Types.ObjectId(String(userId)),
    courseId: new mongoose.Types.ObjectId(String(courseId)),
    chapterId: { $in: chapterIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
  }).lean();

  const statusByChapterId = new Map();
  for (const item of progressItems || []) {
    if (!item || !item.chapterId) continue;
    statusByChapterId.set(String(item.chapterId), item.status || 'not_started');
  }

  const chaptersCompleted = chapterIds.every((id) => statusByChapterId.get(String(id)) === 'completed');

  let finalAssessmentRequired = false;
  let finalAssessmentPassed = false;

  if (ContentAssessment && User) {
    const mapping = await ContentAssessment.findOne({
      status: 'active',
      scopeType: 'course',
      scopeId: String(courseId),
      courseId: String(courseId),
      $or: [{ isRequired: true }, { isRequired: { $exists: false } }],
    }).lean();

    if (mapping) {
      finalAssessmentRequired = true;
      const user = await User.findById(new mongoose.Types.ObjectId(String(userId))).lean();
      const attempts = user && Array.isArray(user.assessments) ? user.assessments : [];
      finalAssessmentPassed = attempts.some((a) => {
        if (!a) return false;
        if (a.scopeType !== 'course') return false;
        if (String(a.courseId || '') !== String(courseId)) return false;
        return isAttemptPassingForMapping(a, mapping);
      });
    }
  }

  const completed = chaptersCompleted && (!finalAssessmentRequired || finalAssessmentPassed);

  return {
    ok: true,
    completed,
    chaptersCompleted,
    finalAssessmentRequired,
    finalAssessmentPassed,
  };
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
