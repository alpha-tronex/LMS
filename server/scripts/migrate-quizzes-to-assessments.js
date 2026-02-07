require('dotenv').config();
const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/userDB';

// Use a permissive schema so we can read legacy fields (quizzes)
// IMPORTANT: LMS uses a separate collection (`lms_users`).
// This migration intentionally targets LMS data only.
const userAnySchema = new mongoose.Schema({}, { strict: false, collection: 'lms_users' });
const User = mongoose.model('LmsUser', userAnySchema);

async function migrate() {
  await mongoose.connect(mongoURI);

  const cursor = User.find({ quizzes: { $exists: true } }).cursor();

  let scanned = 0;
  let migrated = 0;

  for await (const user of cursor) {
    scanned++;

    const quizzes = user.get('quizzes');
    const assessments = user.get('assessments');

    const hasAssessments = Array.isArray(assessments) && assessments.length > 0;
    const hasQuizzes = Array.isArray(quizzes) && quizzes.length > 0;

    const update = {
      $unset: { quizzes: '' },
      $set: { updatedAt: new Date() }
    };

    if (!hasAssessments) {
      update.$set.assessments = Array.isArray(quizzes) ? quizzes : [];
    }

    // If quizzes existed but were empty/invalid and assessments already existed, we just unset quizzes.
    await User.updateOne({ _id: user._id }, update);
    migrated++;

    if (migrated % 500 === 0) {
      // eslint-disable-next-line no-console
      console.log(`Migrated ${migrated} users...`);
    }

    // Avoid unused var warnings if logic changes
    void hasQuizzes;
  }

  // eslint-disable-next-line no-console
  console.log(`Done. Scanned ${scanned} users, migrated ${migrated} users.`);

  await mongoose.disconnect();
}

migrate().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
