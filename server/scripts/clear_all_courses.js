#!/usr/bin/env node

/**
 * Script to remove all courses and related data from the database
 * 
 * This script will delete:
 * - All courses
 * - All enrollments linked to courses
 * - All lessons linked to courses
 * - All chapters linked to courses
 * - All chapter progress linked to chapters
 * - All content assessments linked to course content
 * - All course surveys linked to courses
 * 
 * Usage:
 *   node server/scripts/clear_all_courses.js
 * 
 * Environment Variables:
 *   MONGODB_URI - MongoDB connection string (defaults to local)
 * 
 * Warning: This operation cannot be undone!
 */

require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("readline");
const path = require("path");
const fs = require("fs");

// Load env (prefer server/.env when present)
try {
  const serverEnvPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(serverEnvPath)) {
    require("dotenv").config({ path: serverEnvPath });
  }
} catch {
  // dotenv is optional; fall back to process.env
}

// Models
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Lesson = require("../models/Lesson");
const Chapter = require("../models/Chapter");
const ChapterProgress = require("../models/ChapterProgress");
const ContentAssessment = require("../models/ContentAssessment");
const CourseSurvey = require("../models/CourseSurvey");

const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/userDB";

async function clearAllCourses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB");

    // Create readline interface for user confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      "⚠️  WARNING: This will delete ALL courses and related data (enrollments, lessons, chapters, assessments, progress). This cannot be undone!\n\nType 'DELETE ALL COURSES' to confirm: ",
      async (answer) => {
        rl.close();

        if (answer !== "DELETE ALL COURSES") {
          console.log("❌ Operation cancelled.");
          await mongoose.connection.close();
          process.exit(0);
        }

        console.log("\n🗑️  Starting deletion process...\n");

        try {
          // Step 1: Get all courses to retrieve their IDs
          const courses = await Course.find({});
          const courseIds = courses.map((course) => course._id);
          const courseCount = courseIds.length;

          if (courseCount === 0) {
            console.log("✅ No courses found in database.");
            await mongoose.connection.close();
            process.exit(0);
          }

          console.log(`Found ${courseCount} course(s) to delete`);

          // Step 2: Get all lessons in these courses to retrieve chapter IDs
          const lessons = await Lesson.find({ courseId: { $in: courseIds } });
          const lessonIds = lessons.map((lesson) => lesson._id);
          console.log(`Found ${lessons.length} lesson(s) to delete`);

          // Step 3: Get all chapters in these courses
          const chapters = await Chapter.find({ courseId: { $in: courseIds } });
          const chapterIds = chapters.map((chapter) => chapter._id);
          console.log(`Found ${chapters.length} chapter(s) to delete`);

          // Step 4: Delete Course Surveys
          const deletedCourseSurveys = await CourseSurvey.deleteMany({
            courseId: { $in: courseIds },
          });
          console.log(
            `✅ Deleted ${deletedCourseSurveys.deletedCount} course survey record(s)`
          );

          // Step 5: Delete Chapter Progress (references course/lesson/chapter)
          const deletedChapterProgress = await ChapterProgress.deleteMany({
            courseId: { $in: courseIds },
          });
          console.log(
            `✅ Deleted ${deletedChapterProgress.deletedCount} chapter progress record(s)`
          );

          // Step 6: Delete Content Assessments (course/lesson/chapter scopes)
          const deletedContentAssessments = await ContentAssessment.deleteMany({
            courseId: { $in: courseIds },
          });
          console.log(
            `✅ Deleted ${deletedContentAssessments.deletedCount} content assessment(s)`
          );

          // Step 7: Delete Chapters
          const deletedChapters = await Chapter.deleteMany({
            courseId: { $in: courseIds },
          });
          console.log(`✅ Deleted ${deletedChapters.deletedCount} chapter(s)`);

          // Step 8: Delete Lessons
          const deletedLessons = await Lesson.deleteMany({
            courseId: { $in: courseIds },
          });
          console.log(`✅ Deleted ${deletedLessons.deletedCount} lesson(s)`);

          // Step 9: Delete Enrollments
          const deletedEnrollments = await Enrollment.deleteMany({
            courseId: { $in: courseIds },
          });
          console.log(`✅ Deleted ${deletedEnrollments.deletedCount} enrollment(s)`);

          // Step 10: Delete Courses
          const deletedCourses = await Course.deleteMany({ _id: { $in: courseIds } });
          console.log(`✅ Deleted ${deletedCourses.deletedCount} course(s)`);

          console.log("\n✅ All courses and related data have been successfully deleted!");
          await mongoose.connection.close();
          process.exit(0);
        } catch (error) {
          console.error("❌ Error during deletion:", error);
          await mongoose.connection.close();
          process.exit(1);
        }
      }
    );
  } catch (error) {
    console.error("❌ Error connecting to database:", error);
    process.exit(1);
  }
}

clearAllCourses();
