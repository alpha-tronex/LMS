const mongoose = require('mongoose');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

module.exports = function adminCourseDataRoutes(
  app,
  Course,
  Enrollment,
  Lesson,
  Chapter,
  ChapterProgress,
  ContentAssessment,
  CourseSurvey,
  User
) {
  // Purge a specific course (admin only)
  app.delete('/api/admin/courses/:courseId/purge', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      if (!isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'Invalid courseId' });
      }

      const courseObjId = new mongoose.Types.ObjectId(String(courseId));

      const course = await Course.findById(courseObjId).lean();
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const deletedCourseSurveys = await CourseSurvey.deleteMany({ courseId: courseObjId });
      const deletedChapterProgress = await ChapterProgress.deleteMany({ courseId: courseObjId });
      const deletedContentAssessments = await ContentAssessment.deleteMany({ courseId: courseObjId });

      const deletedChapters = await Chapter.deleteMany({ courseId: courseObjId });
      const deletedLessons = await Lesson.deleteMany({ courseId: courseObjId });
      const deletedEnrollments = await Enrollment.deleteMany({ courseId: courseObjId });

      const updatedUsers = await User.updateMany(
        { 'assessments.courseId': courseObjId },
        { $pull: { assessments: { courseId: courseObjId } } }
      );

      const deletedCourse = await Course.deleteOne({ _id: courseObjId });

      return res.status(200).json({
        message: 'Course purged',
        courseId: String(courseId),
        deleted: {
          courses: deletedCourse.deletedCount || 0,
          enrollments: deletedEnrollments.deletedCount || 0,
          lessons: deletedLessons.deletedCount || 0,
          chapters: deletedChapters.deletedCount || 0,
          chapterProgress: deletedChapterProgress.deletedCount || 0,
          contentAssessments: deletedContentAssessments.deletedCount || 0,
          courseSurveys: deletedCourseSurveys.deletedCount || 0,
        },
        updatedUsers: {
          matchedCount: updatedUsers.matchedCount || 0,
          modifiedCount: updatedUsers.modifiedCount || 0,
        },
      });
    } catch (err) {
      console.log('err: ' + err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Purge ALL courses (admin only)
  app.delete('/api/admin/courses/purge-all', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const courses = await Course.find({}, { _id: 1 }).lean();
      const courseIds = (courses || []).map((c) => c._id).filter(Boolean);

      if (courseIds.length === 0) {
        return res.status(200).json({ message: 'No courses to purge', deleted: {}, updatedUsers: {} });
      }

      const deletedCourseSurveys = await CourseSurvey.deleteMany({ courseId: { $in: courseIds } });
      const deletedChapterProgress = await ChapterProgress.deleteMany({ courseId: { $in: courseIds } });
      const deletedContentAssessments = await ContentAssessment.deleteMany({ courseId: { $in: courseIds } });

      const deletedChapters = await Chapter.deleteMany({ courseId: { $in: courseIds } });
      const deletedLessons = await Lesson.deleteMany({ courseId: { $in: courseIds } });
      const deletedEnrollments = await Enrollment.deleteMany({ courseId: { $in: courseIds } });

      const updatedUsers = await User.updateMany(
        { 'assessments.courseId': { $in: courseIds } },
        { $pull: { assessments: { courseId: { $in: courseIds } } } }
      );

      const deletedCourses = await Course.deleteMany({ _id: { $in: courseIds } });

      return res.status(200).json({
        message: 'All courses purged',
        deleted: {
          courses: deletedCourses.deletedCount || 0,
          enrollments: deletedEnrollments.deletedCount || 0,
          lessons: deletedLessons.deletedCount || 0,
          chapters: deletedChapters.deletedCount || 0,
          chapterProgress: deletedChapterProgress.deletedCount || 0,
          contentAssessments: deletedContentAssessments.deletedCount || 0,
          courseSurveys: deletedCourseSurveys.deletedCount || 0,
        },
        updatedUsers: {
          matchedCount: updatedUsers.matchedCount || 0,
          modifiedCount: updatedUsers.modifiedCount || 0,
        },
      });
    } catch (err) {
      console.log('err: ' + err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete a specific course from a specific user (admin only)
  app.delete(
    '/api/admin/users/:userId/courses/:courseId',
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      try {
        const { userId, courseId } = req.params;

        if (!isValidObjectId(userId)) {
          return res.status(400).json({ error: 'Invalid userId' });
        }
        if (!isValidObjectId(courseId)) {
          return res.status(400).json({ error: 'Invalid courseId' });
        }

        const userObjId = new mongoose.Types.ObjectId(String(userId));
        const courseObjId = new mongoose.Types.ObjectId(String(courseId));

        const deletedEnrollments = await Enrollment.deleteMany({ userId: userObjId, courseId: courseObjId });
        const deletedChapterProgress = await ChapterProgress.deleteMany({ userId: userObjId, courseId: courseObjId });
        const deletedCourseSurveys = await CourseSurvey.deleteMany({ userId: userObjId, courseId: courseObjId });

        const updatedUser = await User.updateOne(
          { _id: userObjId },
          { $pull: { assessments: { courseId: courseObjId } } }
        );

        return res.status(200).json({
          message: 'Course removed from user',
          userId: String(userId),
          courseId: String(courseId),
          deleted: {
            enrollments: deletedEnrollments.deletedCount || 0,
            chapterProgress: deletedChapterProgress.deletedCount || 0,
            courseSurveys: deletedCourseSurveys.deletedCount || 0,
          },
          updatedUser: {
            matchedCount: updatedUser.matchedCount || 0,
            modifiedCount: updatedUser.modifiedCount || 0,
          },
        });
      } catch (err) {
        console.log('err: ' + err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Delete ALL courses from a specific user (admin only)
  app.delete('/api/admin/users/:userId/courses', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      if (!isValidObjectId(userId)) {
        return res.status(400).json({ error: 'Invalid userId' });
      }

      const userObjId = new mongoose.Types.ObjectId(String(userId));

      const deletedEnrollments = await Enrollment.deleteMany({ userId: userObjId });
      const deletedChapterProgress = await ChapterProgress.deleteMany({ userId: userObjId });
      const deletedCourseSurveys = await CourseSurvey.deleteMany({ userId: userObjId });

      const updatedUser = await User.updateOne(
        { _id: userObjId },
        { $pull: { assessments: { courseId: { $exists: true } } } }
      );

      return res.status(200).json({
        message: 'All courses removed from user',
        userId: String(userId),
        deleted: {
          enrollments: deletedEnrollments.deletedCount || 0,
          chapterProgress: deletedChapterProgress.deletedCount || 0,
          courseSurveys: deletedCourseSurveys.deletedCount || 0,
        },
        updatedUser: {
          matchedCount: updatedUser.matchedCount || 0,
          modifiedCount: updatedUser.modifiedCount || 0,
        },
      });
    } catch (err) {
      console.log('err: ' + err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete ALL courses from ALL users (admin only)
  app.delete('/api/admin/users/courses', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const deletedEnrollments = await Enrollment.deleteMany({});
      const deletedChapterProgress = await ChapterProgress.deleteMany({});
      const deletedCourseSurveys = await CourseSurvey.deleteMany({});

      const updatedUsers = await User.updateMany(
        { 'assessments.courseId': { $exists: true } },
        { $pull: { assessments: { courseId: { $exists: true } } } }
      );

      return res.status(200).json({
        message: 'All courses removed from all users',
        deleted: {
          enrollments: deletedEnrollments.deletedCount || 0,
          chapterProgress: deletedChapterProgress.deletedCount || 0,
          courseSurveys: deletedCourseSurveys.deletedCount || 0,
        },
        updatedUsers: {
          matchedCount: updatedUsers.matchedCount || 0,
          modifiedCount: updatedUsers.modifiedCount || 0,
        },
      });
    } catch (err) {
      console.log('err: ' + err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
};
