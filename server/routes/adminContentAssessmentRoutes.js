const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { verifyToken, verifyAdminOrInstructor } = require('../middleware/authMiddleware');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function assessmentFileExists(assessmentId) {
  const id = Number(assessmentId);
  if (!Number.isFinite(id) || id < 0) return false;

  const newPath = path.join(__dirname, '../assessments', `assessment_${id}.json`);
  const legacyPath = path.join(__dirname, '../quizzes', `quiz_${id}.json`);
  return fs.existsSync(newPath) || fs.existsSync(legacyPath);
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

module.exports = function adminContentAssessmentRoutes(
  app,
  Course,
  Lesson,
  Chapter,
  ContentAssessment
) {
  // Attach (or replace) an active assessment mapping for a scope.
  app.post(
    '/api/admin/content-assessments/attach',
    verifyToken,
    verifyAdminOrInstructor,
    async (req, res) => {
      try {
        if (!ContentAssessment) {
          return res.status(500).json({ error: 'ContentAssessment model not configured' });
        }

        const scopeType = req.body && req.body.scopeType;
        const scopeId = req.body && req.body.scopeId;
        const assessmentIdRaw = req.body && req.body.assessmentId;

        if (scopeType !== 'chapter' && scopeType !== 'lesson' && scopeType !== 'course') {
          return res.status(400).json({ error: 'Invalid scopeType' });
        }
        if (!isValidObjectId(String(scopeId))) {
          return res.status(400).json({ error: 'Invalid scopeId' });
        }

        const assessmentId = Number(assessmentIdRaw);
        if (!Number.isFinite(assessmentId) || assessmentId < 0) {
          return res.status(400).json({ error: 'Invalid assessmentId' });
        }
        if (!assessmentFileExists(assessmentId)) {
          return res.status(404).json({ error: 'Assessment not found' });
        }

        let courseId = null;
        let lessonId = null;
        let chapterId = null;

        if (scopeType === 'course') {
          if (!Course) return res.status(500).json({ error: 'Course model not configured' });
          const course = await Course.findOne({
            _id: new mongoose.Types.ObjectId(String(scopeId)),
            status: 'active',
          }).lean();
          if (!course) return res.status(404).json({ error: 'Course not found' });
          courseId = course._id;
        }

        if (scopeType === 'lesson') {
          if (!Lesson) return res.status(500).json({ error: 'Lesson model not configured' });
          const lesson = await Lesson.findOne({
            _id: new mongoose.Types.ObjectId(String(scopeId)),
            status: 'active',
          }).lean();
          if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
          courseId = lesson.courseId;
          lessonId = lesson._id;
        }

        if (scopeType === 'chapter') {
          if (!Chapter) return res.status(500).json({ error: 'Chapter model not configured' });
          const chapter = await Chapter.findOne({
            _id: new mongoose.Types.ObjectId(String(scopeId)),
            status: 'active',
          }).lean();
          if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
          courseId = chapter.courseId;
          lessonId = chapter.lessonId;
          chapterId = chapter._id;
        }

        const isRequiredRaw = req.body && req.body.isRequired;
        const isRequired = isRequiredRaw === undefined ? true : Boolean(isRequiredRaw);

        let passScore = parseOptionalNumber(req.body && req.body.passScore);
        let maxAttempts = parseOptionalNumber(req.body && req.body.maxAttempts);

        // Defaults based on agreed rules
        if (passScore === undefined) {
          if (scopeType === 'chapter') passScore = 100;
          if (scopeType === 'course') passScore = 80;
        }
        if (maxAttempts === undefined) {
          if (scopeType === 'course') maxAttempts = 2;
        }

        // Validate score/attempts if provided
        if (passScore !== undefined && (passScore < 0 || passScore > 100)) {
          return res.status(400).json({ error: 'Invalid passScore' });
        }
        if (maxAttempts !== undefined && (!Number.isInteger(maxAttempts) || maxAttempts < 1)) {
          return res.status(400).json({ error: 'Invalid maxAttempts' });
        }

        const now = new Date();

        const doc = await ContentAssessment.findOneAndUpdate(
          {
            scopeType,
            scopeId: new mongoose.Types.ObjectId(String(scopeId)),
            status: 'active',
          },
          {
            $set: {
              scopeType,
              scopeId: new mongoose.Types.ObjectId(String(scopeId)),
              courseId,
              lessonId,
              chapterId,
              assessmentId,
              isRequired,
              passScore,
              maxAttempts,
              status: 'active',
              archivedAt: null,
              updatedAt: now,
            },
            $setOnInsert: {
              createdAt: now,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        return res.status(200).json({
          id: String(doc._id),
          scopeType: doc.scopeType,
          scopeId: String(doc.scopeId),
          courseId: String(doc.courseId),
          lessonId: doc.lessonId ? String(doc.lessonId) : null,
          chapterId: doc.chapterId ? String(doc.chapterId) : null,
          assessmentId: doc.assessmentId,
          isRequired: !!doc.isRequired,
          passScore: doc.passScore ?? null,
          maxAttempts: doc.maxAttempts ?? null,
          status: doc.status,
        });
      } catch (err) {
        console.log('err: ' + err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Detach by archiving the active mapping.
  app.post(
    '/api/admin/content-assessments/detach',
    verifyToken,
    verifyAdminOrInstructor,
    async (req, res) => {
      try {
        if (!ContentAssessment) {
          return res.status(500).json({ error: 'ContentAssessment model not configured' });
        }

        const scopeType = req.body && req.body.scopeType;
        const scopeId = req.body && req.body.scopeId;

        if (scopeType !== 'chapter' && scopeType !== 'lesson' && scopeType !== 'course') {
          return res.status(400).json({ error: 'Invalid scopeType' });
        }
        if (!isValidObjectId(String(scopeId))) {
          return res.status(400).json({ error: 'Invalid scopeId' });
        }

        const updated = await ContentAssessment.findOneAndUpdate(
          {
            scopeType,
            scopeId: new mongoose.Types.ObjectId(String(scopeId)),
            status: 'active',
          },
          {
            $set: {
              status: 'archived',
              archivedAt: new Date(),
            },
          },
          { new: true }
        ).lean();

        if (!updated) {
          return res.status(404).json({ error: 'Active mapping not found' });
        }

        return res.status(200).json({
          message: 'Mapping archived',
          id: String(updated._id),
          scopeType: updated.scopeType,
          scopeId: String(updated.scopeId),
          status: updated.status,
        });
      } catch (err) {
        console.log('err: ' + err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Optional list endpoint for admin UI wiring.
  app.get(
    '/api/admin/content-assessments',
    verifyToken,
    verifyAdminOrInstructor,
    async (req, res) => {
      try {
        if (!ContentAssessment) {
          return res.status(500).json({ error: 'ContentAssessment model not configured' });
        }

        const courseId = req.query && req.query.courseId;
        const q = {};
        if (courseId !== undefined) {
          if (!isValidObjectId(String(courseId))) {
            return res.status(400).json({ error: 'Invalid courseId' });
          }
          q.courseId = new mongoose.Types.ObjectId(String(courseId));
        }

        const items = await ContentAssessment.find(q).sort({ updatedAt: -1 }).lean();
        return res.status(200).json(
          (items || []).map((doc) => ({
            id: String(doc._id),
            scopeType: doc.scopeType,
            scopeId: String(doc.scopeId),
            courseId: String(doc.courseId),
            lessonId: doc.lessonId ? String(doc.lessonId) : null,
            chapterId: doc.chapterId ? String(doc.chapterId) : null,
            assessmentId: doc.assessmentId,
            isRequired: !!doc.isRequired,
            passScore: doc.passScore ?? null,
            maxAttempts: doc.maxAttempts ?? null,
            status: doc.status,
            archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
            updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
          }))
        );
      } catch (err) {
        console.log('err: ' + err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  );
};
