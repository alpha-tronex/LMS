require('dotenv').config();
const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/userDB';

const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');

async function run() {
  await mongoose.connect(mongoURI);

  const col = mongoose.connection.db.collection('lms_users');

  const match = { type: { $exists: true } };

  const matchingCount = await col.countDocuments(match);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ dryRun: isDryRun, matchingCount }, null, 2));

  if (isDryRun) {
    await mongoose.disconnect();
    return;
  }

  const result = await col.updateMany(match, { $unset: { type: '' } });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        acknowledged: result.acknowledged,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('Cleanup failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
