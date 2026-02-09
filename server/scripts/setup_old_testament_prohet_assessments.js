/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Chapter = require('../models/Chapter');
const ContentAssessment = require('../models/ContentAssessment');

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractAssessmentIdFromFilename(file) {
  const m = String(file).match(/^assessment_(\d+)\.json$/);
  return m ? Number(m[1]) : null;
}

function getNextAssessmentId(assessmentsDir, startingAt) {
  let maxId = startingAt;
  const files = fs.existsSync(assessmentsDir) ? fs.readdirSync(assessmentsDir) : [];
  for (const file of files) {
    const id = extractAssessmentIdFromFilename(file);
    if (Number.isFinite(id)) maxId = Math.max(maxId, id);
  }
  return maxId + 1;
}

function buildChapterQuiz({ id, courseTitle, chapterTitle }) {
  return {
    id,
    title: `${courseTitle} — ${chapterTitle} (Checkpoint Quiz)`,
    questions: [
      {
        questionNum: 0,
        questionType: 'SingleAnswer',
        instructions: 'Select the correct answer',
        question: 'This checkpoint quiz is for which chapter?',
        answers: [chapterTitle, 'Genesis Overview', 'Kings Summary', 'New Testament'],
        correct: [1],
      },
      {
        questionNum: 1,
        questionType: 'TrueFalse',
        instructions: 'Select the correct answer (True or False)',
        question: 'You are taking a checkpoint quiz at the end of a chapter.',
        answers: ['True', 'False'],
        correct: [1],
      },
      {
        questionNum: 2,
        questionType: 'MultipleChoice',
        instructions: 'Select all correct answers',
        question: 'Which actions can appear on the last page of a chapter in this LMS?',
        answers: ['Mark Complete', 'Take Checkpoint Quiz', 'Take Lesson Assessment', 'Teleport to Mars'],
        correct: [1, 2, 3],
      },
    ],
  };
}

function buildCourseFinal({ id, courseTitle }) {
  return {
    id,
    title: `${courseTitle} — End of Course Assessment`,
    questions: [
      {
        questionNum: 0,
        questionType: 'TrueFalse',
        instructions: 'Select the correct answer (True or False)',
        question: 'This assessment is meant to run at the end of a course.',
        answers: ['True', 'False'],
        correct: [1],
      },
      {
        questionNum: 1,
        questionType: 'SingleAnswer',
        instructions: 'Select the correct answer',
        question: 'If the pass threshold is 80% and there are 5 questions, how many must be correct to pass?',
        answers: ['3', '4', '5', '2'],
        correct: [2],
      },
      {
        questionNum: 2,
        questionType: 'MultipleChoice',
        instructions: 'Select all correct answers',
        question: 'Which scopes can assessments attach to in this LMS?',
        answers: ['Chapter', 'Lesson', 'Course', 'Only User Profile'],
        correct: [1, 2, 3],
      },
      {
        questionNum: 3,
        questionType: 'SingleAnswer',
        instructions: 'Select the correct answer',
        question: 'What does CTA stand for?',
        answers: ['Course Test Artifact', 'Call To Action', 'Chapter Total Average', 'Client Token Auth'],
        correct: [2],
      },
      {
        questionNum: 4,
        questionType: 'TrueFalse',
        instructions: 'Select the correct answer (True or False)',
        question: 'The “Accept Results” button saves your attempt to history.',
        answers: ['True', 'False'],
        correct: [1],
      },
    ],
  };
}

async function upsertActiveMapping({ scopeType, scopeId, courseId, lessonId, chapterId, assessmentId, passScore, maxAttempts }) {
  const now = new Date();
  const doc = await ContentAssessment.findOneAndUpdate(
    { scopeType, scopeId: new mongoose.Types.ObjectId(String(scopeId)), status: 'active' },
    {
      $set: {
        scopeType,
        scopeId: new mongoose.Types.ObjectId(String(scopeId)),
        courseId: new mongoose.Types.ObjectId(String(courseId)),
        lessonId: lessonId ? new mongoose.Types.ObjectId(String(lessonId)) : null,
        chapterId: chapterId ? new mongoose.Types.ObjectId(String(chapterId)) : null,
        assessmentId,
        isRequired: true,
        passScore,
        maxAttempts,
        status: 'active',
        archivedAt: null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return doc;
}

async function main() {
  const desiredTitle = process.env.LMS_COURSE_TITLE || 'Old Testament Prohet';
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/userDB';

  const assessmentsDir = path.join(__dirname, '..', 'assessments');

  await mongoose.connect(uri);

  try {
    const wantedNorm = normalizeTitle(desiredTitle);

    const activeCourses = await Course.find({ status: 'active' }).lean();
    if (!Array.isArray(activeCourses) || activeCourses.length === 0) {
      throw new Error('No active courses found in DB.');
    }

    let course = activeCourses.find((c) => normalizeTitle(c.title) === wantedNorm) || null;

    if (!course) {
      // Fuzzy match: all tokens must appear in title.
      const tokens = wantedNorm.split(' ').filter(Boolean);
      course =
        activeCourses.find((c) => {
          const t = normalizeTitle(c.title);
          return tokens.every((tok) => t.includes(tok));
        }) || null;
    }

    if (!course) {
      // Best-effort match: score by token overlap (handles minor typos like prohet/prophet(s)).
      const tokens = wantedNorm.split(' ').filter(Boolean);
      const scored = activeCourses
        .map((c) => {
          const t = normalizeTitle(c.title);
          const score = tokens.reduce((acc, tok) => (t.includes(tok) ? acc + 1 : acc), 0);
          return { c, score };
        })
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      const second = scored[1];

      // Pick the best match if it's clearly better than the next option.
      if (best && best.score >= 2 && (!second || best.score > second.score)) {
        course = best.c;
      }
    }

    if (!course) {
      const suggestions = activeCourses
        .map((c) => c.title)
        .filter((t) => normalizeTitle(t).includes('old') || normalizeTitle(t).includes('testament'))
        .slice(0, 10);
      throw new Error(
        `Could not find course matching “${desiredTitle}”.` +
          (suggestions.length ? ` Suggestions: ${suggestions.join(' | ')}` : '')
      );
    }

    const courseId = course._id;

    const lessons = await Lesson.find({ courseId, status: 'active' }).sort({ sortOrder: 1 }).lean();
    const chapters = await Chapter.find({ courseId, status: 'active' }).sort({ lessonId: 1, sortOrder: 1 }).lean();

    if (!chapters.length) {
      throw new Error(`Course “${course.title}” has no active chapters.`);
    }

    // Allocate IDs and write files.
    let nextId = getNextAssessmentId(assessmentsDir, 0);
    const created = [];

    const chapterAssessments = [];

    for (const chapter of chapters) {
      const chapterTitle = chapter.title || 'Chapter';
      const id = nextId++;

      const quiz = buildChapterQuiz({ id, courseTitle: course.title, chapterTitle });
      const filePath = path.join(assessmentsDir, `assessment_${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(quiz, null, 2) + '\n', 'utf8');

      chapterAssessments.push({ chapterId: chapter._id, lessonId: chapter.lessonId, assessmentId: id, chapterTitle });
      created.push({ id, kind: 'chapter', title: quiz.title, file: filePath });
    }

    const finalId = nextId++;
    const final = buildCourseFinal({ id: finalId, courseTitle: course.title });
    const finalPath = path.join(assessmentsDir, `assessment_${finalId}.json`);
    fs.writeFileSync(finalPath, JSON.stringify(final, null, 2) + '\n', 'utf8');
    created.push({ id: finalId, kind: 'course', title: final.title, file: finalPath });

    // Upsert mappings.
    let mappingsUpserted = 0;

    for (const item of chapterAssessments) {
      await upsertActiveMapping({
        scopeType: 'chapter',
        scopeId: item.chapterId,
        courseId,
        lessonId: item.lessonId,
        chapterId: item.chapterId,
        assessmentId: item.assessmentId,
        passScore: 100,
        maxAttempts: undefined,
      });
      mappingsUpserted += 1;
    }

    await upsertActiveMapping({
      scopeType: 'course',
      scopeId: courseId,
      courseId,
      lessonId: null,
      chapterId: null,
      assessmentId: finalId,
      passScore: 80,
      maxAttempts: 2,
    });
    mappingsUpserted += 1;

    console.log(
      JSON.stringify(
        {
          ok: true,
          course: { id: String(courseId), title: course.title },
          lessons: lessons.length,
          chapters: chapters.length,
          createdAssessments: created.map((c) => ({ id: c.id, kind: c.kind, title: c.title })),
          mappingsUpserted,
          nextSteps:
            'Open the course as a student: chapter last page shows checkpoint; course detail shows final (unlocked after chapters completed).',
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(String(err && err.stack ? err.stack : err));
  process.exit(1);
});
