const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/authMiddleware');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

module.exports = function courseRoutes(app, Course, Enrollment) {
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
};
