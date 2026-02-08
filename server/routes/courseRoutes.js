const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/authMiddleware');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

module.exports = function courseRoutes(app, Course, Enrollment, Lesson, Chapter) {
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

      const chaptersByLessonId = new Map();
      for (const c of chapters) {
        const lessonKey = String(c.lessonId);
        const arr = chaptersByLessonId.get(lessonKey) || [];
        arr.push({
          id: String(c._id),
          lessonId: String(c.lessonId),
          title: c.title,
          sortOrder: c.sortOrder || 0,
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
      }));

      res.status(200).json({
        course: {
          id: String(course._id),
          title: course.title,
          description: course.description || '',
        },
        lessons: resultLessons,
      });
    } catch (err) {
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
      const normalizedPages = pages.length > 0 ? pages : [{ text: legacyText, assets: legacyAssets }];

      res.status(200).json({
        id: String(chapter._id),
        courseId: String(chapter.courseId),
        lessonId: String(chapter.lessonId),
        title: chapter.title,
        sortOrder: chapter.sortOrder || 0,
        content: {
          ...rawContent,
          pages: normalizedPages,
          text: legacyText,
          assets: legacyAssets,
        },
      });
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};
