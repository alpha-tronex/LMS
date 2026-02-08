const mongoose = require('mongoose');
const { verifyToken, verifyAdminOrInstructor } = require('../middleware/authMiddleware');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function validateCoursePayload(payload, { requireTitle }) {
  const errors = [];
  const title = payload && typeof payload.title === 'string' ? payload.title.trim() : '';
  const description =
    payload && typeof payload.description === 'string' ? payload.description : undefined;

  if (requireTitle) {
    if (!title) {
      errors.push('title is required');
    }
  }

  if (payload && payload.title !== undefined) {
    if (!title) {
      errors.push('title must be a non-empty string');
    } else if (title.length > 200) {
      errors.push('title must be <= 200 characters');
    }
  }

  if (description !== undefined && typeof description !== 'string') {
    errors.push('description must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
    title,
    description: description !== undefined ? description : undefined,
  };
}

module.exports = function adminCourseRoutes(app, Course) {
  // Create course
  app.post('/api/admin/courses', verifyToken, verifyAdminOrInstructor, async (req, res) => {
    try {
      const validation = validateCoursePayload(req.body || {}, { requireTitle: true });
      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const course = await Course.create({
        title: validation.title,
        description: validation.description || '',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      res.status(201).json({
        id: String(course._id),
        title: course.title,
        description: course.description || '',
        status: course.status,
      });
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update course
  app.put('/api/admin/courses/:courseId', verifyToken, verifyAdminOrInstructor, async (req, res) => {
    try {
      const { courseId } = req.params;
      if (!isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'Invalid courseId' });
      }

      const validation = validateCoursePayload(req.body || {}, { requireTitle: false });
      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const update = { updatedAt: new Date() };
      if (req.body && req.body.title !== undefined) update.title = validation.title;
      if (req.body && req.body.description !== undefined)
        update.description = validation.description || '';

      const updated = await Course.findByIdAndUpdate(
        new mongoose.Types.ObjectId(courseId),
        { $set: update },
        { new: true }
      ).lean();

      if (!updated) {
        return res.status(404).json({ error: 'Course not found' });
      }

      res.status(200).json({
        id: String(updated._id),
        title: updated.title,
        description: updated.description || '',
        status: updated.status,
      });
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Archive course
  app.post(
    '/api/admin/courses/:courseId/archive',
    verifyToken,
    verifyAdminOrInstructor,
    async (req, res) => {
      try {
        const { courseId } = req.params;
        if (!isValidObjectId(courseId)) {
          return res.status(400).json({ error: 'Invalid courseId' });
        }

        const updated = await Course.findByIdAndUpdate(
          new mongoose.Types.ObjectId(courseId),
          { $set: { status: 'archived', updatedAt: new Date() } },
          { new: true }
        ).lean();

        if (!updated) {
          return res.status(404).json({ error: 'Course not found' });
        }

        res.status(200).json({ message: 'Archived', courseId: String(courseId) });
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // List courses (includes archived)
  app.get('/api/admin/courses', verifyToken, verifyAdminOrInstructor, async (req, res) => {
    try {
      const courses = await Course.find({}).sort({ updatedAt: -1 }).lean();

      const results = courses.map((c) => ({
        id: String(c._id),
        title: c.title,
        description: c.description || '',
        status: c.status,
      }));

      res.status(200).json(results);
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};
