const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/authMiddleware');
const { computeCourseCompletion } = require('../utils/courseCompletion');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function isValidProgressStatus(value) {
  return value === 'not_started' || value === 'in_progress' || value === 'completed';
}

module.exports = function courseRoutes(
  app,
  Course,
  Enrollment,
  Lesson,
  Chapter,
  ChapterProgress,
  ContentAssessment,
  User
) {
  const disableLegacyContentFields =
    String(process.env.DISABLE_LEGACY_CONTENT_FIELDS || '').toLowerCase() === '1' ||
    String(process.env.DISABLE_LEGACY_CONTENT_FIELDS || '').toLowerCase() === 'true';

  // List active courses
  app.get('/api/courses', verifyToken, async (req, res) => {
    try {
      const courses = await Course.find({ status: 'active' })
        .sort({ title: 1 })
        .lean();

      const results = courses.map((c) => ({
        id: String(c._id),
        title: c.title,
        description: c.description || '',
      }));

      res.status(200).json(results);
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // List enrolled courses for the current user
  app.get('/api/my/courses', verifyToken, async (req, res) => {
    try {
      const userId = req.user && req.user.id;
      if (!userId || !isValidObjectId(String(userId))) {
        return res.status(400).json({ error: 'Invalid user id' });
      }

      const enrollments = await Enrollment.find({
        userId: new mongoose.Types.ObjectId(String(userId)),
        status: 'enrolled',
      })
        .sort({ enrolledAt: -1 })
        .lean();

      const courseIds = enrollments.map((e) => e.courseId);
      const courses = await Course.find({
        _id: { $in: courseIds },
        status: 'active',
      })
        .lean();

      const courseById = new Map(courses.map((c) => [String(c._id), c]));

      // Pre-compute progress signals across all enrolled courses.
      const progressCourseIds = new Set();
      if (ChapterProgress && courseIds && courseIds.length > 0) {
        try {
          const progressItems = await ChapterProgress.find({
            userId: new mongoose.Types.ObjectId(String(userId)),
            courseId: { $in: courseIds },
            $or: [
              { status: 'in_progress' },
              { status: 'completed' },
              { startedAt: { $exists: true, $ne: null } },
              { lastAccessedAt: { $exists: true, $ne: null } },
              { completedAt: { $exists: true, $ne: null } },
            ],
          })
            .select({ courseId: 1 })
            .lean();

          for (const p of progressItems || []) {
            if (p && p.courseId) progressCourseIds.add(String(p.courseId));
          }
        } catch (e) {
          // Non-blocking: we can still compute completion.
        }
      }

      const attemptCourseIds = new Set();
      if (User) {
        try {
          const user = await User.findById(new mongoose.Types.ObjectId(String(userId)))
            .select({ assessments: 1 })
            .lean();
          const attempts = user && Array.isArray(user.assessments) ? user.assessments : [];
          for (const a of attempts) {
            if (!a) continue;
            if (!a.courseId) continue;
            attemptCourseIds.add(String(a.courseId));
          }
        } catch (e) {
          // Non-blocking
        }
      }

      const results = enrollments
        .map((e) => {
          const course = courseById.get(String(e.courseId));
          if (!course) return null;
          return {
            id: String(course._id),
            title: course.title,
            description: course.description || '',
            enrolledAt: e.enrolledAt ? e.enrolledAt.toISOString() : null,
          };
        })
        .filter(Boolean);

      // Compute completion per enrolled course.
      await Promise.all(
        results.map(async (item) => {
          try {
            const completion = await computeCourseCompletion({
              Course,
              Lesson,
              Chapter,
              ChapterProgress,
              ContentAssessment,
              User,
              userId,
              courseId: item.id,
            });

            item.courseCompleted = !!(completion && completion.ok && completion.completed);
            item.courseInProgress =
              !item.courseCompleted &&
              (progressCourseIds.has(String(item.id)) || attemptCourseIds.has(String(item.id)));
          } catch (e) {
            item.courseCompleted = false;
            item.courseInProgress = false;
          }
        })
      );

      res.status(200).json(results);
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get course detail (active only for MVP)
  app.get('/api/courses/:courseId', verifyToken, async (req, res) => {
    try {
      const { courseId } = req.params;
      if (!isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'Invalid courseId' });
      }

      const course = await Course.findOne({
        _id: new mongoose.Types.ObjectId(courseId),
        status: 'active',
      }).lean();

      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      res.status(200).json({
        id: String(course._id),
        title: course.title,
        description: course.description || '',
      });
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get course content tree (lessons + chapters)
  app.get('/api/courses/:courseId/content', verifyToken, async (req, res) => {
    try {
      const { courseId } = req.params;
      if (!isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'Invalid courseId' });
      }

      const course = await Course.findOne({
        _id: new mongoose.Types.ObjectId(courseId),
        status: 'active',
      }).lean();

      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      // Defensive: if models aren't provided, return empty outline.
      if (!Lesson || !Chapter) {
        return res.status(200).json({
          course: {
            id: String(course._id),
            title: course.title,
            description: course.description || '',
          },
          lessons: [],
        });
      }

      const lessons = await Lesson.find({
        courseId: new mongoose.Types.ObjectId(courseId),
        status: 'active',
      })
        .sort({ sortOrder: 1, title: 1 })
        .lean();

      const chapters = await Chapter.find({
        courseId: new mongoose.Types.ObjectId(courseId),
        status: 'active',
      })
        .sort({ sortOrder: 1, title: 1 })
        .lean();

      // Optional: include attached assessments by scope.
      let courseAssessments = [];
      const lessonAssessmentsByLessonId = new Map();
      const chapterAssessmentsByChapterId = new Map();

      if (ContentAssessment) {
        const mappings = await ContentAssessment.find({
          courseId: new mongoose.Types.ObjectId(courseId),
          status: 'active',
        })
          .sort({ updatedAt: -1 })
          .lean();

        for (const m of mappings || []) {
          const item = {
            assessmentId: m.assessmentId,
            isRequired: !!m.isRequired,
            passScore: m.passScore ?? null,
            maxAttempts: m.maxAttempts ?? null,
          };

          if (m.scopeType === 'course') {
            courseAssessments.push(item);
            continue;
          }

          if (m.scopeType === 'lesson') {
            const key = String(m.scopeId);
            const arr = lessonAssessmentsByLessonId.get(key) || [];
            arr.push(item);
            lessonAssessmentsByLessonId.set(key, arr);
            continue;
          }

          if (m.scopeType === 'chapter') {
            const key = String(m.scopeId);
            const arr = chapterAssessmentsByChapterId.get(key) || [];
            arr.push(item);
            chapterAssessmentsByChapterId.set(key, arr);
          }
        }
      }

      const chaptersByLessonId = new Map();
      for (const c of chapters) {
        const lessonKey = String(c.lessonId);
        const arr = chaptersByLessonId.get(lessonKey) || [];
        arr.push({
          id: String(c._id),
          lessonId: String(c.lessonId),
          title: c.title,
          sortOrder: c.sortOrder || 0,
          assessments: chapterAssessmentsByChapterId.get(String(c._id)) || [],
        });
        chaptersByLessonId.set(lessonKey, arr);
      }

      const resultLessons = lessons.map((l) => ({
        id: String(l._id),
        courseId: String(l.courseId),
        title: l.title,
        description: l.description || '',
        sortOrder: l.sortOrder || 0,
        chapters: chaptersByLessonId.get(String(l._id)) || [],
        assessments: lessonAssessmentsByLessonId.get(String(l._id)) || [],
      }));

      res.status(200).json({
        course: {
          id: String(course._id),
          title: course.title,
          description: course.description || '',
          assessments: courseAssessments,
        },
        lessons: resultLessons,
      });
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get chapter-level progress for the current user in a course
  app.get('/api/courses/:courseId/progress', verifyToken, async (req, res) => {
    try {
      const userId = req.user && req.user.id;
      const { courseId } = req.params;

      if (!userId || !isValidObjectId(String(userId))) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      if (!isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'Invalid courseId' });
      }

      const course = await Course.findOne({
        _id: new mongoose.Types.ObjectId(courseId),
        status: 'active',
      }).lean();

      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      if (!ChapterProgress) {
        return res.status(500).json({ error: 'ChapterProgress model not configured' });
      }

      const items = await ChapterProgress.find({
        userId: new mongoose.Types.ObjectId(String(userId)),
        courseId: new mongoose.Types.ObjectId(courseId),
      })
        .sort({ updatedAt: -1 })
        .lean();

      res.status(200).json(
        (items || []).map((p) => ({
          chapterId: String(p.chapterId),
          status: p.status || 'not_started',
          updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
        }))
      );
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Upsert chapter progress for the current user
  app.post('/api/courses/:courseId/progress', verifyToken, async (req, res) => {
    try {
      const userId = req.user && req.user.id;
      const { courseId } = req.params;

      if (!userId || !isValidObjectId(String(userId))) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      if (!isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'Invalid courseId' });
      }

      const chapterIdRaw = req.body && req.body.chapterId;
      const statusRaw = req.body && req.body.status;
      const chapterId = typeof chapterIdRaw === 'string' ? chapterIdRaw : '';
      const status = typeof statusRaw === 'string' ? statusRaw : '';

      if (!isValidObjectId(chapterId)) {
        return res.status(400).json({ error: 'Invalid chapterId' });
      }
      if (!isValidProgressStatus(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const course = await Course.findOne({
        _id: new mongoose.Types.ObjectId(courseId),
        status: 'active',
      }).lean();
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      if (!ChapterProgress) {
        return res.status(500).json({ error: 'ChapterProgress model not configured' });
      }
      if (!Chapter) {
        return res.status(500).json({ error: 'Chapter model not configured' });
      }

      const chapter = await Chapter.findOne({
        _id: new mongoose.Types.ObjectId(chapterId),
        courseId: new mongoose.Types.ObjectId(courseId),
        status: 'active',
      }).lean();

      if (!chapter) {
        return res.status(404).json({ error: 'Chapter not found' });
      }

      // Milestone E: if a required chapter checkpoint assessment exists, only allow
      // marking the chapter as completed after a passing attempt.
      if (status === 'completed' && ContentAssessment && User) {
        const mapping = await ContentAssessment.findOne({
          status: 'active',
          scopeType: 'chapter',
          scopeId: chapterId,
          courseId: courseId,
          chapterId: chapterId,
          $or: [{ isRequired: true }, { isRequired: { $exists: false } }],
        }).lean();

        if (mapping) {
          const user = await User.findById(new mongoose.Types.ObjectId(String(userId))).lean();
          if (!user) {
            return res.status(404).json({ error: 'User not found' });
          }

          const attempts = Array.isArray(user.assessments) ? user.assessments : [];
          const passScore = mapping.passScore;

          const hasPassed = attempts.some((a) => {
            if (!a) return false;
            if (Number(a.id) !== Number(mapping.assessmentId)) return false;
            if (a.scopeType !== 'chapter') return false;
            if (String(a.courseId || '') !== String(courseId)) return false;
            if (String(a.chapterId || '') !== String(chapterId)) return false;
            if (a.passed === true) return true;

            if (!Number.isFinite(Number(passScore))) {
              return true;
            }

            const score = Number(a.score);
            const total = Number(a.totalQuestions);
            if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0) return false;
            const pct = (score / total) * 100;
            return pct >= Number(passScore);
          });

          if (!hasPassed) {
            return res.status(409).json({
              error: 'Checkpoint quiz required before completing this chapter',
              requiredAssessmentId: mapping.assessmentId,
              passScore: mapping.passScore ?? null,
            });
          }
        }
      }

      const now = new Date();
      const existing = await ChapterProgress.findOne({
        userId: new mongoose.Types.ObjectId(String(userId)),
        chapterId: new mongoose.Types.ObjectId(chapterId),
      }).lean();

      const nextStartedAt =
        status === 'not_started'
          ? existing && existing.startedAt
          : (existing && existing.startedAt) || now;

      const nextCompletedAt =
        status === 'completed'
          ? (existing && existing.completedAt) || now
          : null;

      const updated = await ChapterProgress.findOneAndUpdate(
        {
          userId: new mongoose.Types.ObjectId(String(userId)),
          chapterId: new mongoose.Types.ObjectId(chapterId),
        },
        {
          $set: {
            userId: new mongoose.Types.ObjectId(String(userId)),
            courseId: new mongoose.Types.ObjectId(courseId),
            lessonId: new mongoose.Types.ObjectId(String(chapter.lessonId)),
            chapterId: new mongoose.Types.ObjectId(chapterId),
            status,
            startedAt: nextStartedAt,
            completedAt: nextCompletedAt,
            lastAccessedAt: now,
            updatedAt: now,
          },
        },
        { upsert: true, new: true }
      ).lean();

      res.status(200).json({
        chapterId: String(updated.chapterId),
        status: updated.status,
        updatedAt: updated.updatedAt ? updated.updatedAt.toISOString() : null,
      });
    } catch (err) {
      // Handle unique index race condition gracefully
      if (err && err.code === 11000) {
        return res.status(200).json({ message: 'Updated' });
      }
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Enroll current user in course
  app.post('/api/courses/:courseId/enroll', verifyToken, async (req, res) => {
    try {
      const userId = req.user && req.user.id;
      const { courseId } = req.params;

      if (!userId || !isValidObjectId(String(userId))) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      if (!isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'Invalid courseId' });
      }

      const course = await Course.findOne({
        _id: new mongoose.Types.ObjectId(courseId),
        status: 'active',
      }).lean();

      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const existing = await Enrollment.findOne({
        userId: new mongoose.Types.ObjectId(String(userId)),
        courseId: new mongoose.Types.ObjectId(courseId),
      });

      if (!existing) {
        await Enrollment.create({
          userId: new mongoose.Types.ObjectId(String(userId)),
          courseId: new mongoose.Types.ObjectId(courseId),
          status: 'enrolled',
          enrolledAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        const now = new Date();
        const update = { status: 'enrolled', updatedAt: now };
        // If re-enrolling after withdrawal, reset enrolledAt
        if (existing.status !== 'enrolled') {
          update.enrolledAt = now;
        }
        await Enrollment.updateOne({ _id: existing._id }, { $set: update });
      }

      res.status(200).json({ message: 'Enrolled', courseId: String(courseId) });
    } catch (err) {
      // Handle duplicate key race condition gracefully
      if (err && err.code === 11000) {
        return res.status(200).json({ message: 'Enrolled', courseId: String(req.params.courseId) });
      }
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Withdraw current user from course
  app.post('/api/courses/:courseId/withdraw', verifyToken, async (req, res) => {
    try {
      const userId = req.user && req.user.id;
      const { courseId } = req.params;

      if (!userId || !isValidObjectId(String(userId))) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      if (!isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'Invalid courseId' });
      }

      await Enrollment.updateOne(
        {
          userId: new mongoose.Types.ObjectId(String(userId)),
          courseId: new mongoose.Types.ObjectId(courseId),
        },
        { $set: { status: 'withdrawn', updatedAt: new Date() } }
      );

      res.status(200).json({ message: 'Withdrawn', courseId: String(courseId) });
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get a chapter (including content)
  app.get('/api/chapters/:chapterId', verifyToken, async (req, res) => {
    try {
      const { chapterId } = req.params;
      if (!isValidObjectId(chapterId)) {
        return res.status(400).json({ error: 'Invalid chapterId' });
      }

      if (!Chapter) {
        return res.status(500).json({ error: 'Chapter model not configured' });
      }

      const chapter = await Chapter.findOne({
        _id: new mongoose.Types.ObjectId(chapterId),
        status: 'active',
      }).lean();

      if (!chapter) {
        return res.status(404).json({ error: 'Chapter not found' });
      }

      // Ensure parent course is active
      const course = await Course.findOne({
        _id: new mongoose.Types.ObjectId(String(chapter.courseId)),
        status: 'active',
      }).lean();

      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const rawContent = chapter.content || {};
      const pages =
        rawContent && Array.isArray(rawContent.pages)
          ? rawContent.pages
              .map((p) => ({
                text: typeof p?.text === 'string' ? p.text : '',
                assets: Array.isArray(p?.assets) ? p.assets : [],
              }))
              .filter((p) => p.text || (p.assets && p.assets.length > 0))
          : [];

      const legacyText = rawContent && typeof rawContent.text === 'string' ? rawContent.text : '';
      const legacyAssets = rawContent && Array.isArray(rawContent.assets) ? rawContent.assets : [];

      // Backward compatibility + forward default:
      // - If there are no pages, expose a single page derived from legacy fields.
      // - Keep legacy fields in the response so older clients don't break.
      const normalizedPages =
        pages.length > 0
          ? pages
          : disableLegacyContentFields
            ? []
            : [{ text: legacyText, assets: legacyAssets }];

      res.status(200).json({
        id: String(chapter._id),
        courseId: String(chapter.courseId),
        lessonId: String(chapter.lessonId),
        title: chapter.title,
        sortOrder: chapter.sortOrder || 0,
        content: {
          ...rawContent,
          pages: normalizedPages,
          ...(disableLegacyContentFields ? {} : { text: legacyText, assets: legacyAssets }),
        },
      });
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};
