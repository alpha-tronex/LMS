const fs = require('fs');
const bodyParser = require('body-parser');
const { verifyToken } = require('../middleware/authMiddleware');

function listAssessmentFiles() {
  const assessmentsDir = __dirname + '/../assessments';
  const legacyDir = __dirname + '/../quizzes';

  const resultsById = new Map();

  const scanDir = (dirPath, preserveExisting) => {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath).filter((file) => file.endsWith('.json'));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(`${dirPath}/${file}`, 'utf8'));
        if (data && typeof data.id === 'number') {
          if (!preserveExisting || !resultsById.has(data.id)) {
            resultsById.set(data.id, { id: data.id, title: data.title });
          }
        }
      } catch (_) {
        // ignore unreadable files
      }
    }
  };

  // Scan legacy first, then new to prefer new files on ID collisions.
  scanDir(legacyDir, true);
  scanDir(assessmentsDir, false);

  return Array.from(resultsById.values()).sort((a, b) => a.id - b.id);
}

module.exports = function (app, User) {
  // Get list of all available assessments (protected route)
  app.get('/api/assessments', verifyToken, (req, res) => {
    console.log('loading available assessments');
    // Assessments are stored on disk in server/assessments as JSON files.
    // During rollout we may also have legacy files in server/quizzes; merge both and prefer new.
    const assessments = listAssessmentFiles();
    res.json(assessments);
  });

  // Get a specific assessment or default assessment (protected route)
  app
    .route('/api/assessment')
    .get(verifyToken, (req, res) => {
      console.log('loading assessment data');
      const assessmentId = req.query.id || 0;
      console.log('assessmentId: ' + assessmentId);

      const assessmentPath = __dirname + `/../assessments/assessment_${assessmentId}.json`;
      const legacyPath = __dirname + `/../quizzes/quiz_${assessmentId}.json`;

      // Prefer new naming/location; fall back to legacy if needed.
      const filePath = fs.existsSync(assessmentPath) ? assessmentPath : legacyPath;
      const jsonData = fs.readFileSync(filePath);
      res.send(jsonData);
    })
    .post(verifyToken, bodyParser.json(), async (req, res) => {
      try {
        const { username, assessmentData } = req.body;

        if (!username || !assessmentData) {
          return res
            .status(400)
            .json({ error: 'Username and assessment data are required' });
        }

        const user = await User.findOne({ username: username });
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Add the completed assessment to user's assessments array
        if (!user.assessments) {
          user.assessments = [];
        }
        user.assessments.push(assessmentData);
        user.updatedAt = new Date();
        await user.save();

        console.log('Assessment saved for user:', username);
        res
          .status(200)
          .json({
            message: 'Assessment saved successfully',
            assessment: assessmentData,
          });
      } catch (error) {
        console.error('Error saving assessment:', error);
        res.status(500).json({ error: 'Failed to save assessment' });
      }
    });

  // Get assessment history for a specific user (protected route)
  app.get('/api/assessment/history/:username', verifyToken, async (req, res) => {
    try {
      const username = req.params.username;

      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }

      const user = await User.findOne({ username: username });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('Assessment history retrieved for user:', username);
      res.status(200).json({ assessments: user.assessments || [] });
    } catch (error) {
      console.error('Error retrieving assessment history:', error);
      res.status(500).json({ error: 'Failed to retrieve assessment history' });
    }
  });
};
