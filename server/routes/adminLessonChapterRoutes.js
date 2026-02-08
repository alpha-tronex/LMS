const mongoose = require('mongoose');
const { verifyToken, verifyAdminOrInstructor } = require('../middleware/authMiddleware');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function parseBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'string') {
    return value === '1' || value.toLowerCase() === 'true';
  }
  return false;
}

function validateLessonPayload(payload, { requireTitle, requireCourseId }) {
  const errors = [];

  const title = payload && typeof payload.title === 'string' ? payload.title.trim() : '';
  const description =
    payload && typeof payload.description === 'string' ? payload.description : undefined;

  const sortOrderRaw = payload ? payload.sortOrder : undefined;
  const sortOrder =
    sortOrderRaw === undefined || sortOrderRaw === null || sortOrderRaw === ''
      ? undefined
      : Number(sortOrderRaw);

  const courseId = payload && typeof payload.courseId === 'string' ? payload.courseId : undefined;

  if (requireTitle && !title) errors.push('title is required');
  if (payload && payload.title !== undefined) {
    if (!title) errors.push('title must be a non-empty string');
    if (title.length > 200) errors.push('title must be <= 200 characters');
  }

  if (description !== undefined && typeof description !== 'string') {
    errors.push('description must be a string');
  }

  if (sortOrder !== undefined && Number.isNaN(sortOrder)) {
    errors.push('sortOrder must be a number');
  }

  if (requireCourseId) {
    if (!courseId || !isValidObjectId(courseId)) {
      errors.push('courseId is required and must be a valid id');
    }
  } else if (courseId !== undefined && !isValidObjectId(courseId)) {
    errors.push('courseId must be a valid id');
  }

  return {
    valid: errors.length === 0,
    errors,
    title,
    description,
    sortOrder,
    courseId,
  };
}

function validateChapterPayload(payload, { requireTitle }) {
  const errors = [];

  const title = payload && typeof payload.title === 'string' ? payload.title.trim() : '';

  const sortOrderRaw = payload ? payload.sortOrder : undefined;
  const sortOrder =
    sortOrderRaw === undefined || sortOrderRaw === null || sortOrderRaw === ''
      ? undefined
      : Number(sortOrderRaw);

  const content = payload && payload.content !== undefined ? payload.content : undefined;

  if (requireTitle && !title) errors.push('title is required');
  if (payload && payload.title !== undefined) {
    if (!title) errors.push('title must be a non-empty string');
    if (title.length > 200) errors.push('title must be <= 200 characters');
  }

  if (sortOrder !== undefined && Number.isNaN(sortOrder)) {
    errors.push('sortOrder must be a number');
  }

  return {
    valid: errors.length === 0,
    errors,
    title,
    sortOrder,
    content,
  };
}

module.exports = function adminLessonChapterRoutes(app, Course, Lesson, Chapter) {
  // Create lesson under course
  app.post(
    '/api/admin/courses/:courseId/lessons',
    verifyToken,
    verifyAdminOrInstructor,
    async (req, res) => {
      try {
        const { courseId } = req.params;
        if (!isValidObjectId(courseId)) {
          return res.status(400).json({ error: 'Invalid courseId' });
        }

        const course = await Course.findById(new mongoose.Types.ObjectId(courseId)).lean();
        if (!course) {
          return res.status(404).json({ error: 'Course not found' });
        }

        const validation = validateLessonPayload({ ...(req.body || {}), courseId }, {
          requireTitle: true,
          requireCourseId: true,
        });
        if (!validation.valid) {
          return res.status(400).json({ errors: validation.errors });
        }

        const lesson = await Lesson.create({
          courseId: new mongoose.Types.ObjectId(courseId),
          title: validation.title,
          description: validation.description || '',
          sortOrder: validation.sortOrder !== undefined ? validation.sortOrder : 0,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        res.status(201).json({
          id: String(lesson._id),
          courseId: String(lesson.courseId),
          title: lesson.title,
          description: lesson.description || '',
          sortOrder: lesson.sortOrder || 0,
          status: lesson.status,
        });
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // List lessons for a course
  app.get(
    '/api/admin/courses/:courseId/lessons',
    verifyToken,
    verifyAdminOrInstructor,
    async (req, res) => {
      try {
        const { courseId } = req.params;
        if (!isValidObjectId(courseId)) {
          return res.status(400).json({ error: 'Invalid courseId' });
        }

        const includeArchived = parseBoolean(req.query && req.query.includeArchived);
        const filter = {
          courseId: new mongoose.Types.ObjectId(courseId),
        };
        if (!includeArchived) {
          filter.status = 'active';
        }

        const lessons = await Lesson.find(filter)
          .sort({ sortOrder: 1, title: 1 })
          .lean();

        res.status(200).json(
          lessons.map((l) => ({
            id: String(l._id),
            courseId: String(l.courseId),
            title: l.title,
            description: l.description || '',
            sortOrder: l.sortOrder || 0,
            status: l.status,
          }))
        );
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Update lesson
  app.put('/api/admin/lessons/:lessonId', verifyToken, verifyAdminOrInstructor, async (req, res) => {
    try {
      const { lessonId } = req.params;
      if (!isValidObjectId(lessonId)) {
        return res.status(400).json({ error: 'Invalid lessonId' });
      }

      const validation = validateLessonPayload(req.body || {}, {
        requireTitle: false,
        requireCourseId: false,
      });
      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const update = { updatedAt: new Date() };
      if (req.body && req.body.title !== undefined) update.title = validation.title;
      if (req.body && req.body.description !== undefined)
        update.description = validation.description || '';
      if (req.body && req.body.sortOrder !== undefined)
        update.sortOrder = validation.sortOrder !== undefined ? validation.sortOrder : 0;

      const updated = await Lesson.findByIdAndUpdate(
        new mongoose.Types.ObjectId(lessonId),
        { $set: update },
        { new: true }
      ).lean();

      if (!updated) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      res.status(200).json({
        id: String(updated._id),
        courseId: String(updated.courseId),
        title: updated.title,
        description: updated.description || '',
        sortOrder: updated.sortOrder || 0,
        status: updated.status,
      });
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Archive lesson (also archives its chapters)
  app.post(
    '/api/admin/lessons/:lessonId/archive',
    verifyToken,
    verifyAdminOrInstructor,
    async (req, res) => {
      try {
        const { lessonId } = req.params;
        if (!isValidObjectId(lessonId)) {
          return res.status(400).json({ error: 'Invalid lessonId' });
        }

        const now = new Date();
        const updated = await Lesson.findByIdAndUpdate(
          new mongoose.Types.ObjectId(lessonId),
          { $set: { status: 'archived', updatedAt: now } },
          { new: true }
        ).lean();

        if (!updated) {
          return res.status(404).json({ error: 'Lesson not found' });
        }

        await Chapter.updateMany(
          { lessonId: new mongoose.Types.ObjectId(lessonId) },
          { $set: { status: 'archived', updatedAt: now } }
        );

        res.status(200).json({ message: 'Archived', lessonId: String(lessonId) });
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Create chapter under lesson
  app.post(
    '/api/admin/lessons/:lessonId/chapters',
    verifyToken,
    verifyAdminOrInstructor,
    async (req, res) => {
      try {
        const { lessonId } = req.params;
        if (!isValidObjectId(lessonId)) {
          return res.status(400).json({ error: 'Invalid lessonId' });
        }

        const lesson = await Lesson.findById(new mongoose.Types.ObjectId(lessonId)).lean();
        if (!lesson) {
          return res.status(404).json({ error: 'Lesson not found' });
        }

        const validation = validateChapterPayload(req.body || {}, { requireTitle: true });
        if (!validation.valid) {
          return res.status(400).json({ errors: validation.errors });
        }

        const chapter = await Chapter.create({
          courseId: new mongoose.Types.ObjectId(String(lesson.courseId)),
          lessonId: new mongoose.Types.ObjectId(lessonId),
          title: validation.title,
          sortOrder: validation.sortOrder !== undefined ? validation.sortOrder : 0,
          content: validation.content !== undefined ? validation.content : {},
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        res.status(201).json({
          id: String(chapter._id),
          courseId: String(chapter.courseId),
          lessonId: String(chapter.lessonId),
          title: chapter.title,
          sortOrder: chapter.sortOrder || 0,
          status: chapter.status,
        });
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // List chapters for a lesson
  app.get(
    '/api/admin/lessons/:lessonId/chapters',
    verifyToken,
    verifyAdminOrInstructor,
    async (req, res) => {
      try {
        const { lessonId } = req.params;
        if (!isValidObjectId(lessonId)) {
          return res.status(400).json({ error: 'Invalid lessonId' });
        }

        const includeArchived = parseBoolean(req.query && req.query.includeArchived);
        const filter = {
          lessonId: new mongoose.Types.ObjectId(lessonId),
        };
        if (!includeArchived) {
          filter.status = 'active';
        }

        const chapters = await Chapter.find(filter)
          .sort({ sortOrder: 1, title: 1 })
          .lean();

        res.status(200).json(
          chapters.map((c) => ({
            id: String(c._id),
            courseId: String(c.courseId),
            lessonId: String(c.lessonId),
            title: c.title,
            sortOrder: c.sortOrder || 0,
            status: c.status,
          }))
        );
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Update chapter
  app.put('/api/admin/chapters/:chapterId', verifyToken, verifyAdminOrInstructor, async (req, res) => {
    try {
      const { chapterId } = req.params;
      if (!isValidObjectId(chapterId)) {
        return res.status(400).json({ error: 'Invalid chapterId' });
      }

      const validation = validateChapterPayload(req.body || {}, { requireTitle: false });
      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const update = { updatedAt: new Date() };
      if (req.body && req.body.title !== undefined) update.title = validation.title;
      if (req.body && req.body.sortOrder !== undefined)
        update.sortOrder = validation.sortOrder !== undefined ? validation.sortOrder : 0;
      if (req.body && req.body.content !== undefined) update.content = validation.content;

      const updated = await Chapter.findByIdAndUpdate(
        new mongoose.Types.ObjectId(chapterId),
        { $set: update },
        { new: true }
      ).lean();

      if (!updated) {
        return res.status(404).json({ error: 'Chapter not found' });
      }

      res.status(200).json({
        id: String(updated._id),
        courseId: String(updated.courseId),
        lessonId: String(updated.lessonId),
        title: updated.title,
        sortOrder: updated.sortOrder || 0,
        status: updated.status,
      });
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Archive chapter
  app.post(
    '/api/admin/chapters/:chapterId/archive',
    verifyToken,
    verifyAdminOrInstructor,
    async (req, res) => {
      try {
        const { chapterId } = req.params;
        if (!isValidObjectId(chapterId)) {
          return res.status(400).json({ error: 'Invalid chapterId' });
        }

        const updated = await Chapter.findByIdAndUpdate(
          new mongoose.Types.ObjectId(chapterId),
          { $set: { status: 'archived', updatedAt: new Date() } },
          { new: true }
        ).lean();

        if (!updated) {
          return res.status(404).json({ error: 'Chapter not found' });
        }

        res.status(200).json({ message: 'Archived', chapterId: String(chapterId) });
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );
};
