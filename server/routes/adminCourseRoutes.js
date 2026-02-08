const mongoose = require('mongoose');
const { verifyToken, verifyAdmin, verifyAdminOrInstructor } = require('../middleware/authMiddleware');

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

function normalizeRole(user) {
  return (user && (user.role || user.type)) || '';
}

function uniqueObjectIdStrings(values) {
  const unique = [];
  const seen = new Set();
  for (const v of values || []) {
    const s = String(v);
    if (!seen.has(s)) {
      seen.add(s);
      unique.push(s);
    }
  }
  return unique;
}

module.exports = function adminCourseRoutes(app, Course, User) {
  // Create course
  app.post('/api/admin/courses', verifyToken, verifyAdminOrInstructor, async (req, res) => {
    try {
      const validation = validateCoursePayload(req.body || {}, { requireTitle: true });
      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const requesterRole = req.user && (req.user.role || req.user.type);
      const requesterId = req.user && req.user.id;

      const course = await Course.create({
        title: validation.title,
        description: validation.description || '',
        instructorIds:
          requesterRole === 'instructor' && requesterId
            ? [new mongoose.Types.ObjectId(String(requesterId))]
            : [],
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

  // Get instructors assigned to a course (admin only)
  app.get(
    '/api/admin/courses/:courseId/instructors',
    verifyToken,
    verifyAdmin,
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

        const instructorIds = (course.instructorIds || []).map((id) => String(id));

        if (!User) {
          return res.status(200).json({ courseId: String(courseId), instructorIds, instructors: [] });
        }

        const instructors = await User.find({
          _id: { $in: instructorIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select('username uname fname lname email role type')
          .lean();

        const instructorSummaries = (instructors || []).map((u) => ({
          id: String(u._id),
          uname: u.username || u.uname || '',
          fname: u.fname || '',
          lname: u.lname || '',
          email: u.email || '',
          role: normalizeRole(u),
        }));

        res.status(200).json({
          courseId: String(courseId),
          instructorIds,
          instructors: instructorSummaries,
        });
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Replace instructors assigned to a course (admin only)
  app.put(
    '/api/admin/courses/:courseId/instructors',
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      try {
        const { courseId } = req.params;
        if (!isValidObjectId(courseId)) {
          return res.status(400).json({ error: 'Invalid courseId' });
        }

        const rawIds = req.body && Array.isArray(req.body.instructorIds) ? req.body.instructorIds : null;
        if (!rawIds) {
          return res.status(400).json({ error: 'instructorIds must be an array' });
        }

        const uniqueIds = uniqueObjectIdStrings(rawIds);
        for (const id of uniqueIds) {
          if (!isValidObjectId(id)) {
            return res.status(400).json({ error: `Invalid instructorId: ${id}` });
          }
        }

        if (!User) {
          return res.status(500).json({ error: 'User model not available' });
        }

        const users = await User.find({
          _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select('username uname fname lname email role type')
          .lean();

        const foundIds = new Set((users || []).map((u) => String(u._id)));
        const missing = uniqueIds.filter((id) => !foundIds.has(String(id)));
        if (missing.length > 0) {
          return res.status(400).json({ error: `Unknown instructorIds: ${missing.join(', ')}` });
        }

        const nonInstructors = (users || []).filter((u) => normalizeRole(u) !== 'instructor');
        if (nonInstructors.length > 0) {
          const names = nonInstructors.map((u) => u.username || u.uname || String(u._id));
          return res
            .status(400)
            .json({ error: `All assigned users must have instructor role. Invalid: ${names.join(', ')}` });
        }

        const updated = await Course.findByIdAndUpdate(
          new mongoose.Types.ObjectId(courseId),
          {
            $set: {
              instructorIds: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)),
              updatedAt: new Date(),
            },
          },
          { new: true }
        ).lean();

        if (!updated) {
          return res.status(404).json({ error: 'Course not found' });
        }

        const instructorSummaries = (users || []).map((u) => ({
          id: String(u._id),
          uname: u.username || u.uname || '',
          fname: u.fname || '',
          lname: u.lname || '',
          email: u.email || '',
          role: normalizeRole(u),
        }));

        res.status(200).json({
          courseId: String(courseId),
          instructorIds: (updated.instructorIds || []).map((id) => String(id)),
          instructors: instructorSummaries,
        });
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );
};
