/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

// Load env (prefer server/.env when present)
try {
  const dotenv = require('dotenv');
  const serverEnvPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath });
  } else {
    dotenv.config();
  }
} catch {
  // dotenv is optional; fall back to process.env
}

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const User = require('../models/User');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Chapter = require('../models/Chapter');
const Enrollment = require('../models/Enrollment');

const SALT_ROUNDS = 10;

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function ensureSeedGif(filename) {
  ensureUploadsDir();
  const target = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(target)) return;

  // Minimal 1x1 GIF (valid .gif). Small + safe for demo.
  const base64 = 'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
  fs.writeFileSync(target, Buffer.from(base64, 'base64'));
}

async function ensureChapterPages({ chapterId, pages }) {
  if (!chapterId) return;

  const chapter = await Chapter.findById(new mongoose.Types.ObjectId(String(chapterId))).exec();
  if (!chapter) return;

  const current = chapter.content || {};
  const existingPages = current && Array.isArray(current.pages) ? current.pages : [];
  if (existingPages.length > 0) {
    console.log(`[seed]    Chapter already has pages; skipping pages seed: ${String(chapter._id)}`);
    return;
  }

  const normalizedPages = Array.isArray(pages)
    ? pages.map((p) => ({
        text: typeof p?.text === 'string' ? p.text : '',
        assets: Array.isArray(p?.assets) ? p.assets : [],
      }))
    : [];

  const first = normalizedPages[0] || { text: '', assets: [] };

  chapter.content = {
    ...(current || {}),
    pages: normalizedPages,
    // Legacy compatibility: page 1 mirrors to legacy fields
    text: first.text || '',
    assets: Array.isArray(first.assets) ? first.assets : [],
  };
  chapter.updatedAt = new Date();
  await chapter.save();
  console.log(`[seed]    Seeded pages into chapter: ${String(chapter._id)} (pages=${normalizedPages.length})`);
}

function uniqObjectIds(ids) {
  const seen = new Set();
  const out = [];
  for (const id of ids || []) {
    const s = String(id);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(id);
    }
  }
  return out;
}

async function ensureInstructor({ username, password }) {
  let user = await User.findOne({ username }).exec();

  if (!user) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    user = await User.create({
      fname: 'Course',
      lname: 'Instructor',
      username,
      email: `${username}@example.com`,
      password: hash,
      phone: '',
      address: {},
      role: 'instructor',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[seed] Created instructor user: ${username} (${String(user._id)})`);
    return user;
  }

  let changed = false;
  if ((user.role || user.type) !== 'instructor') {
    user.role = 'instructor';
    changed = true;
  }

  if (changed) {
    user.updatedAt = new Date();
    await user.save();
    console.log(`[seed] Updated existing user to instructor: ${username} (${String(user._id)})`);
  } else {
    console.log(`[seed] Instructor already exists: ${username} (${String(user._id)})`);
  }

  // Intentionally does not overwrite password for existing users.
  return user;
}

async function ensureStudent({ username, password }) {
  let user = await User.findOne({ username }).exec();

  if (!user) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    user = await User.create({
      fname: 'Sample',
      lname: 'Student',
      username,
      email: `${username}@example.com`,
      password: hash,
      phone: '',
      address: {},
      role: 'student',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[seed] Created student user: ${username} (${String(user._id)})`);
    return user;
  }

  let changed = false;
  if ((user.role || user.type) !== 'student') {
    user.role = 'student';
    changed = true;
  }

  if (changed) {
    user.updatedAt = new Date();
    await user.save();
    console.log(`[seed] Updated existing user to student: ${username} (${String(user._id)})`);
  } else {
    console.log(`[seed] Student already exists: ${username} (${String(user._id)})`);
  }

  // Intentionally does not overwrite password for existing users.
  return user;
}

async function ensureEnrollment({ userId, courseId }) {
  const now = new Date();
  const existing = await Enrollment.findOne({ userId, courseId }).exec();

  if (!existing) {
    await Enrollment.create({
      userId,
      courseId,
      status: 'enrolled',
      enrolledAt: now,
      updatedAt: now,
    });
    console.log(`[seed] Enrolled user ${String(userId)} into course ${String(courseId)}`);
    return;
  }

  if (existing.status !== 'enrolled') {
    existing.status = 'enrolled';
    existing.enrolledAt = now;
    existing.updatedAt = now;
    await existing.save();
    console.log(`[seed] Re-enrolled user ${String(userId)} into course ${String(courseId)}`);
  } else {
    console.log(`[seed] Enrollment already exists (enrolled): user ${String(userId)} -> course ${String(courseId)}`);
  }
}

async function ensureCourse({ title, description, instructorId }) {
  let course = await Course.findOne({ title }).exec();

  if (!course) {
    course = await Course.create({
      title,
      description,
      instructorIds: [instructorId],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[seed] Created course: ${title} (${String(course._id)})`);
    return course;
  }

  const nextInstructorIds = uniqObjectIds([...(course.instructorIds || []), instructorId]);
  const needsInstructor = nextInstructorIds.length !== (course.instructorIds || []).length;
  const needsDescription = typeof description === 'string' && description !== course.description;

  if (needsInstructor || needsDescription) {
    course.instructorIds = nextInstructorIds;
    if (needsDescription) course.description = description;
    course.updatedAt = new Date();
    await course.save();
    console.log(`[seed] Updated course instructors/description: ${title} (${String(course._id)})`);
  } else {
    console.log(`[seed] Course already exists: ${title} (${String(course._id)})`);
  }

  return course;
}

async function ensureLesson({ courseId, title, description, sortOrder }) {
  let lesson = await Lesson.findOne({ courseId, title }).exec();

  if (!lesson) {
    lesson = await Lesson.create({
      courseId,
      title,
      description: description || '',
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[seed]  Created lesson: ${title} (${String(lesson._id)})`);
    return lesson;
  }

  let changed = false;
  if (lesson.description !== (description || '')) {
    lesson.description = description || '';
    changed = true;
  }
  if (lesson.sortOrder !== (Number.isFinite(sortOrder) ? sortOrder : lesson.sortOrder)) {
    lesson.sortOrder = Number.isFinite(sortOrder) ? sortOrder : lesson.sortOrder;
    changed = true;
  }

  if (changed) {
    lesson.updatedAt = new Date();
    await lesson.save();
    console.log(`[seed]  Updated lesson: ${title} (${String(lesson._id)})`);
  } else {
    console.log(`[seed]  Lesson already exists: ${title} (${String(lesson._id)})`);
  }

  return lesson;
}

async function ensureChapter({ courseId, lessonId, title, sortOrder, text }) {
  let chapter = await Chapter.findOne({ courseId, lessonId, title }).exec();

  if (!chapter) {
    chapter = await Chapter.create({
      courseId,
      lessonId,
      title,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      content: {
        text: text || '',
        assets: [],
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[seed]    Created chapter: ${title} (${String(chapter._id)})`);
    return chapter;
  }

  // Only fill in text if empty/missing to avoid overwriting edited content.
  const existingText = chapter.content && typeof chapter.content.text === 'string' ? chapter.content.text : '';
  let changed = false;

  if ((!existingText || !existingText.trim()) && text && text.trim()) {
    chapter.content = { ...(chapter.content || {}), text, assets: Array.isArray(chapter.content?.assets) ? chapter.content.assets : [] };
    changed = true;
  }

  if (chapter.sortOrder !== (Number.isFinite(sortOrder) ? sortOrder : chapter.sortOrder)) {
    chapter.sortOrder = Number.isFinite(sortOrder) ? sortOrder : chapter.sortOrder;
    changed = true;
  }

  if (changed) {
    chapter.updatedAt = new Date();
    await chapter.save();
    console.log(`[seed]    Updated chapter: ${title} (${String(chapter._id)})`);
  } else {
    console.log(`[seed]    Chapter already exists: ${title} (${String(chapter._id)})`);
  }

  return chapter;
}

async function main() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/userDB';
  console.log(`[seed] Connecting to ${mongoURI}`);

  await mongoose.connect(mongoURI);

  const instructor = await ensureInstructor({ username: 'instruct', password: 'local123' });
  const student = await ensureStudent({ username: 'student', password: 'local123' });

  const course = await ensureCourse({
    title: 'Essential Facts About Old Testament Prophets',
    description:
      'A short course introducing who the Old Testament prophets were, what they did, and the key themes of their messages.',
    instructorId: instructor._id,
  });

  await ensureEnrollment({ userId: student._id, courseId: course._id });

  const lesson1 = await ensureLesson({
    courseId: course._id,
    title: 'Lesson 1: The Prophetic Office',
    description: 'What a prophet is, and how prophets were called and formed.',
    sortOrder: 1,
  });

  const lesson1chapter1 = await ensureChapter({
    courseId: course._id,
    lessonId: lesson1._id,
    title: 'Chapter 1: What Is a Prophet?',
    sortOrder: 1,
    text:
      'In the Old Testament, prophets were God’s messengers who spoke His word to His people. They did more than predict the future; they called people back to covenant faithfulness.\n\nKey idea: prophecy is primarily about faithful proclamation—exposing sin, warning of consequences, and pointing to hope when people return to God.',
  });

  // Add a 3-page demo to one chapter (each page has text + a GIF).
  // Also includes an example embedded video via a direct MP4 URL.
  ensureSeedGif('seed_page.gif');
  const seedGifUrl = '/uploads/seed_page.gif';
  await ensureChapterPages({
    chapterId: lesson1chapter1._id,
    pages: [
      {
        text:
          'Page 1: Overview\n\nProphets speak God’s truth into real situations. Their message often includes correction, warning, and a call to return to faithful living.',
        assets: [
          {
            url: seedGifUrl,
            kind: 'image',
            originalName: 'seed_page.gif',
            mimetype: 'image/gif',
          },
        ],
      },
      {
        text:
          'Page 2: Common Patterns\n\nMany prophetic books follow a rhythm: sin → warning → consequence → hope. This helps learners see structure across different prophets.',
        assets: [
          {
            url: seedGifUrl,
            kind: 'image',
            originalName: 'seed_page.gif',
            mimetype: 'image/gif',
          },
          {
            // Direct MP4 URL example (works with the existing <video> renderer).
            // If you later store a YouTube URL here, the Chapter Viewer can embed it.
            url: 'https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4',
            kind: 'video',
            originalName: 'BigBuckBunny_320x180.mp4',
            mimetype: 'video/mp4',
          },
        ],
      },
      {
        text:
          'Page 3: Reflection\n\nThink about a time when a hard truth helped you grow. The prophets often delivered hard truths so people could return to what is right.',
        assets: [
          {
            url: seedGifUrl,
            kind: 'image',
            originalName: 'seed_page.gif',
            mimetype: 'image/gif',
          },
        ],
      },
    ],
  });

  await ensureChapter({
    courseId: course._id,
    lessonId: lesson1._id,
    title: 'Chapter 2: How God Called the Prophets',
    sortOrder: 2,
    text:
      'Prophets were often called through a clear encounter with God, which included a commissioning to speak and sometimes a sign of empowerment. Many prophets resisted at first, feeling unqualified.\n\nKey idea: God’s call does not depend on human strength—He equips those He calls and holds them accountable to speak truthfully.',
  });

  const lesson2 = await ensureLesson({
    courseId: course._id,
    title: 'Lesson 2: The Major Prophets',
    description: 'A high-level overview of the major prophets and their historical context.',
    sortOrder: 2,
  });

  await ensureChapter({
    courseId: course._id,
    lessonId: lesson2._id,
    title: 'Chapter 1: Isaiah, Jeremiah, Ezekiel, Daniel (Overview)',
    sortOrder: 1,
    text:
      'The Major Prophets addressed major turning points in Israel’s story: rebellion, exile, and hope for restoration.\n\nIsaiah emphasizes God’s holiness and the promise of redemption. Jeremiah speaks of covenant unfaithfulness and a coming new covenant. Ezekiel highlights God’s glory and renewal. Daniel shows God’s sovereignty over kingdoms and history.',
  });

  await ensureChapter({
    courseId: course._id,
    lessonId: lesson2._id,
    title: 'Chapter 2: Key Themes — Covenant, Judgment, Hope',
    sortOrder: 2,
    text:
      'Across the major prophets, a pattern repeats: (1) covenant broken, (2) judgment warned, (3) repentance invited, (4) hope promised.\n\nKey idea: judgment is never the final word—God’s goal is to restore people to faithful relationship and to renew hearts toward righteousness.',
  });

  const lesson3 = await ensureLesson({
    courseId: course._id,
    title: 'Lesson 3: The Minor Prophets',
    description: 'Core messages and themes across the twelve minor prophets.',
    sortOrder: 3,
  });

  await ensureChapter({
    courseId: course._id,
    lessonId: lesson3._id,
    title: 'Chapter 1: The Twelve Minor Prophets (Overview)',
    sortOrder: 1,
    text:
      'The Minor Prophets (from Hosea to Malachi) are “minor” by length, not importance. Together they address idolatry, injustice, empty worship, and the need for sincere repentance.\n\nKey idea: God cares about worship and ethics together—faithfulness is shown both in devotion to God and justice toward others.',
  });

  await ensureChapter({
    courseId: course._id,
    lessonId: lesson3._id,
    title: 'Chapter 2: Practical Takeaways',
    sortOrder: 2,
    text:
      'The prophets call us to examine our hearts, align our lives with truth, and pursue justice and mercy. They also remind us that God is patient and persistent—inviting restoration even after failure.\n\nKey idea: spiritual renewal is not only personal; it also reshapes how we treat others and how we live in community.',
  });

  console.log('[seed] Done. Summary:');
  console.log({
    instructorId: String(instructor._id),
    studentId: String(student._id),
    courseId: String(course._id),
    demoChapterId: String(lesson1chapter1._id),
  });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[seed] Failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
