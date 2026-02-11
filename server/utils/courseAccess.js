const mongoose = require('mongoose');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function getRole(req) {
  return req && req.user && (req.user.role || req.user.type);
}

function getUserId(req) {
  return req && req.user && req.user.id ? String(req.user.id) : '';
}

function isStrictAdminRequest(req) {
  return getRole(req) === 'admin';
}

function isInstructorRequest(req) {
  return getRole(req) === 'instructor';
}

function isInstructorAssigned(course, userId) {
  if (!course || !userId) return false;
  const list = Array.isArray(course.instructorIds) ? course.instructorIds : [];
  return list.some((id) => String(id) === String(userId));
}

async function requireCourseAccess({ Course, req, res, courseId }) {
  if (!Course) {
    res.status(500).json({ error: 'Course model not configured' });
    return null;
  }

  const courseIdStr = String(courseId || '');
  if (!isValidObjectId(courseIdStr)) {
    res.status(400).json({ error: 'Invalid courseId' });
    return null;
  }

  const course = await Course.findById(new mongoose.Types.ObjectId(courseIdStr)).lean();
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return null;
  }

  if (isStrictAdminRequest(req)) {
    return course;
  }

  if (isInstructorRequest(req)) {
    const userId = getUserId(req);
    if (!userId || !isValidObjectId(userId)) {
      res.status(400).json({ error: 'Invalid user id' });
      return null;
    }

    if (!isInstructorAssigned(course, userId)) {
      res.status(403).json({ error: 'Access denied. Course instructor privileges required.' });
      return null;
    }

    return course;
  }

  res.status(403).json({ error: 'Access denied. Admin or instructor privileges required.' });
  return null;
}

module.exports = {
  isValidObjectId,
  getRole,
  getUserId,
  isStrictAdminRequest,
  isInstructorRequest,
  isInstructorAssigned,
  requireCourseAccess,
};
