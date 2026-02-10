const mongoose = require('mongoose');

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

module.exports = {
  computePercentScore,
  isAttemptPassingForMapping,
  computeCourseCompletion,
};
