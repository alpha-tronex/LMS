const mongoose = require('mongoose');
const { verifyToken, verifyAdmin, verifyAdminOrInstructor } = require('../middleware/authMiddleware');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function getRole(req) {
  return req.user && (req.user.role || req.user.type);
}

module.exports = function adminEnrollmentRoutes(app, Course, Enrollment, User) {
  async function requireCourseAccess(req, res, next) {
    try {
      const { courseId } = req.params;
      if (!isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'Invalid courseId' });
      }

      const course = await Course.findById(new mongoose.Types.ObjectId(courseId)).lean();
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const role = getRole(req);
      if (role === 'admin') {
        req.course = course;
        return next();
      }

      const userId = req.user && req.user.id;
      if (!userId || !isValidObjectId(String(userId))) {
        return res.status(400).json({ error: 'Invalid user id' });
      }

      const allowed = Array.isArray(course.instructorIds)
        ? course.instructorIds.some((id) => String(id) === String(userId))
        : false;

      if (!allowed) {
        return res.status(403).json({ error: 'Access denied. Course instructor privileges required.' });
      }

      req.course = course;
      next();
    } catch (err) {
      console.log('err: ' + err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // List enrollments for a course (admin or course instructor)
  app.get(
    '/api/admin/courses/:courseId/enrollments',
    verifyToken,
    verifyAdminOrInstructor,
    requireCourseAccess,
    async (req, res) => {
      try {
        const { courseId } = req.params;

        const enrollments = await Enrollment.find({
          courseId: new mongoose.Types.ObjectId(courseId),
          status: 'enrolled',
        })
          .sort({ enrolledAt: -1 })
          .lean();

        const userIds = enrollments.map((e) => e.userId);
        const users = await User.find(
          { _id: { $in: userIds } },
          { password: 0, assessments: 0 }
        ).lean();

        const userById = new Map(users.map((u) => [String(u._id), u]));

        res.status(200).json(
          enrollments.map((e) => {
            const u = userById.get(String(e.userId));
            return {
              userId: String(e.userId),
              enrollmentStatus: e.status,
              enrolledAt: e.enrolledAt ? e.enrolledAt.toISOString() : null,
              username: u ? u.username : '',
              fname: u ? u.fname || '' : '',
              lname: u ? u.lname || '' : '',
              email: u ? u.email || '' : '',
            };
          })
        );
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Enroll a user into a course (admin or course instructor)
  // Admin can pass { userId } or { username }. Instructor must pass { username }.
  app.post(
    '/api/admin/courses/:courseId/enrollments',
    verifyToken,
    verifyAdminOrInstructor,
    requireCourseAccess,
    async (req, res) => {
      try {
        const role = getRole(req);
        const { courseId } = req.params;

        const userIdRaw = req.body && req.body.userId;
        const usernameRaw = req.body && req.body.username;

        let user = null;
        if (role === 'admin' && userIdRaw && isValidObjectId(String(userIdRaw))) {
          user = await User.findById(new mongoose.Types.ObjectId(String(userIdRaw)), { password: 0 }).lean();
        } else {
          const username = typeof usernameRaw === 'string' ? usernameRaw.trim() : '';
          if (!username) {
            return res.status(400).json({ error: 'Missing username' });
          }
          user = await User.findOne({ username: username }, { password: 0 }).lean();
        }

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        const now = new Date();

        const existing = await Enrollment.findOne({
          userId: new mongoose.Types.ObjectId(String(user._id)),
          courseId: new mongoose.Types.ObjectId(courseId),
        });

        if (!existing) {
          await Enrollment.create({
            userId: new mongoose.Types.ObjectId(String(user._id)),
            courseId: new mongoose.Types.ObjectId(courseId),
            status: 'enrolled',
            enrolledAt: now,
            updatedAt: now,
          });
        } else {
          const update = { status: 'enrolled', updatedAt: now };
          if (existing.status !== 'enrolled') {
            update.enrolledAt = now;
          }
          await Enrollment.updateOne({ _id: existing._id }, { $set: update });
        }

        res.status(200).json({ message: 'Enrolled', courseId: String(courseId), userId: String(user._id) });
      } catch (err) {
        if (err && err.code === 11000) {
          return res.status(200).json({ message: 'Enrolled', courseId: String(req.params.courseId) });
        }
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Withdraw a user from a course (admin or course instructor)
  app.post(
    '/api/admin/courses/:courseId/enrollments/:userId/withdraw',
    verifyToken,
    verifyAdminOrInstructor,
    requireCourseAccess,
    async (req, res) => {
      try {
        const { courseId, userId } = req.params;
        if (!isValidObjectId(courseId)) {
          return res.status(400).json({ error: 'Invalid courseId' });
        }
        if (!isValidObjectId(userId)) {
          return res.status(400).json({ error: 'Invalid userId' });
        }

        await Enrollment.updateOne(
          {
            userId: new mongoose.Types.ObjectId(String(userId)),
            courseId: new mongoose.Types.ObjectId(String(courseId)),
          },
          { $set: { status: 'withdrawn', updatedAt: new Date() } }
        );

        res.status(200).json({ message: 'Withdrawn', courseId: String(courseId), userId: String(userId) });
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );
};
