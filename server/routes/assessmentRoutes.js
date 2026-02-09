const fs = require('fs');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { verifyToken } = require('../middleware/authMiddleware');

function listAssessmentFiles() {
  const assessmentsDir = __dirname + '/../assessments';
  const legacyDir = __dirname + '/../quizzes';
  const disableLegacy =
    String(process.env.DISABLE_LEGACY_QUIZZES || '').toLowerCase() === '1' ||
    String(process.env.DISABLE_LEGACY_QUIZZES || '').toLowerCase() === 'true';

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
  if (!disableLegacy) {
    scanDir(legacyDir, true);
  }
  scanDir(assessmentsDir, false);

  return Array.from(resultsById.values()).sort((a, b) => a.id - b.id);
}

module.exports = function (app, User, ContentAssessment) {

  const disableLegacy =
    String(process.env.DISABLE_LEGACY_QUIZZES || '').toLowerCase() === '1' ||
    String(process.env.DISABLE_LEGACY_QUIZZES || '').toLowerCase() === 'true';

  function isValidObjectId(value) {
    return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
  }

  function computePercentScore(score, totalQuestions) {
    const s = Number(score);
    const t = Number(totalQuestions);
    if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return null;
    return Math.max(0, Math.min(100, (s / t) * 100));
  }

  function normalizeScopeFromRequest(req) {
    const scopeTypeRaw = req.query && req.query.scopeType;
    const scopeType = typeof scopeTypeRaw === 'string' ? scopeTypeRaw : '';
    if (scopeType !== 'chapter' && scopeType !== 'lesson' && scopeType !== 'course') return null;

    const courseIdRaw = req.query && req.query.courseId;
    const lessonIdRaw = req.query && req.query.lessonId;
    const chapterIdRaw = req.query && req.query.chapterId;

    const courseId = typeof courseIdRaw === 'string' ? courseIdRaw : '';
    const lessonId = typeof lessonIdRaw === 'string' ? lessonIdRaw : '';
    const chapterId = typeof chapterIdRaw === 'string' ? chapterIdRaw : '';

    if (!isValidObjectId(courseId)) return null;
    if (scopeType === 'lesson' && !isValidObjectId(lessonId)) return null;
    if (scopeType === 'chapter' && !isValidObjectId(chapterId)) return null;

    const scopeId =
      scopeType === 'course'
        ? courseId
        : scopeType === 'lesson'
          ? lessonId
          : chapterId;

    if (!isValidObjectId(scopeId)) return null;

    return { scopeType, courseId, lessonId: lessonId || null, chapterId: chapterId || null, scopeId };
  }

  function normalizeScopeFromAssessmentData(assessmentData) {
    if (!assessmentData || typeof assessmentData !== 'object') return null;
    const scopeType = typeof assessmentData.scopeType === 'string' ? assessmentData.scopeType : '';
    if (scopeType !== 'chapter' && scopeType !== 'lesson' && scopeType !== 'course') return null;

    const courseId = typeof assessmentData.courseId === 'string' ? assessmentData.courseId : '';
    const lessonId = typeof assessmentData.lessonId === 'string' ? assessmentData.lessonId : '';
    const chapterId = typeof assessmentData.chapterId === 'string' ? assessmentData.chapterId : '';

    if (!isValidObjectId(courseId)) return null;
    if (scopeType === 'lesson' && !isValidObjectId(lessonId)) return null;
    if (scopeType === 'chapter' && !isValidObjectId(chapterId)) return null;

    const scopeId =
      scopeType === 'course'
        ? courseId
        : scopeType === 'lesson'
          ? lessonId
          : chapterId;

    if (!isValidObjectId(scopeId)) return null;

    return { scopeType, courseId, lessonId: lessonId || null, chapterId: chapterId || null, scopeId };
  }

  function countAttemptsForScope(user, assessmentId, scopeType, courseId, lessonId, chapterId) {
    const list = user && Array.isArray(user.assessments) ? user.assessments : [];
    return list.filter((a) => {
      if (!a) return false;
      if (Number(a.id) !== Number(assessmentId)) return false;
      if (a.scopeType !== scopeType) return false;
      if (String(a.courseId || '') !== String(courseId || '')) return false;
      if (scopeType === 'lesson' && String(a.lessonId || '') !== String(lessonId || '')) return false;
      if (scopeType === 'chapter' && String(a.chapterId || '') !== String(chapterId || '')) return false;
      return true;
    }).length;
  }

  function attemptPassedForMapping(attempt, mapping) {
    if (!attempt || !mapping) return false;
    if (Number(attempt.id) !== Number(mapping.assessmentId)) return false;

    const passScore = mapping.passScore;
    if (attempt.passed === true) return true;
    if (!Number.isFinite(Number(passScore))) {
      // If no passScore is configured, treat any attempt as passing.
      return true;
    }

    const percent =
      Number.isFinite(Number(attempt.percentScore))
        ? Number(attempt.percentScore)
        : computePercentScore(attempt.score, attempt.totalQuestions);

    if (!Number.isFinite(Number(percent))) return false;
    return Number(percent) >= Number(passScore);
  }

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

      // Optional: enforce maxAttempts before the learner even starts (Milestone E).
      // This only applies when scope metadata is provided.
      if (ContentAssessment) {
        try {
          const scopeTypeParam = req.query && req.query.scopeType;
          const scopeRequested = typeof scopeTypeParam === 'string' && scopeTypeParam.length > 0;
          const scope = normalizeScopeFromRequest(req);

          if (scopeRequested && !scope) {
            return res.status(400).json({ error: 'Invalid scope parameters' });
          }

          if (scope && !ContentAssessment) {
            return res.status(500).json({ error: 'Assessment policy enforcement not configured' });
          }

          const assessmentIdNum = Number(assessmentId);
          if (scope && Number.isFinite(assessmentIdNum)) {
            Promise.resolve()
              .then(async () => {
                const mapping = await ContentAssessment.findOne({
                  status: 'active',
                  scopeType: scope.scopeType,
                  scopeId: scope.scopeId,
                  courseId: scope.courseId,
                  ...(scope.scopeType === 'lesson' && scope.lessonId ? { lessonId: scope.lessonId } : {}),
                  ...(scope.scopeType === 'chapter' && scope.chapterId ? { chapterId: scope.chapterId } : {}),
                  assessmentId: assessmentIdNum,
                }).lean();

                if (!mapping) {
                  return res.status(400).json({ error: 'Assessment is not attached to this content scope' });
                }

                const maxAttempts = mapping.maxAttempts;
                if (Number.isFinite(Number(maxAttempts))) {
                  const userId = req.user && req.user.id;
                  if (!userId || !isValidObjectId(String(userId))) {
                    return res.status(400).json({ error: 'Invalid user id' });
                  }

                  const user = await User.findById(new mongoose.Types.ObjectId(String(userId))).lean();
                  if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                  }

                  const used = countAttemptsForScope(
                    user,
                    assessmentIdNum,
                    scope.scopeType,
                    scope.courseId,
                    scope.lessonId,
                    scope.chapterId
                  );

                  if (used >= Number(maxAttempts)) {
                    return res.status(403).json({
                      error: 'No attempts remaining for this assessment',
                      maxAttempts: Number(maxAttempts),
                      attemptsUsed: used,
                    });
                  }
                }

                const assessmentPath = __dirname + `/../assessments/assessment_${assessmentId}.json`;
                const legacyPath = __dirname + `/../quizzes/quiz_${assessmentId}.json`;
                const filePath = fs.existsSync(assessmentPath)
                  ? assessmentPath
                  : (!disableLegacy && fs.existsSync(legacyPath) ? legacyPath : null);

                if (!filePath) {
                  return res.status(404).json({ error: 'Assessment file not found' });
                }

                const jsonData = fs.readFileSync(filePath);
                return res.send(jsonData);
              })
              .catch((err) => {
                console.error('Error enforcing assessment policy on GET:', err);
                return res.status(500).json({ error: 'Internal server error' });
              });
            return;
          }
        } catch (err) {
          console.error('Error parsing scope enforcement params:', err);
          return res.status(400).json({ error: 'Invalid scope parameters' });
        }
      }

      const assessmentPath = __dirname + `/../assessments/assessment_${assessmentId}.json`;
      const legacyPath = __dirname + `/../quizzes/quiz_${assessmentId}.json`;

      // Prefer new naming/location; fall back to legacy if needed.
      const filePath = fs.existsSync(assessmentPath)
        ? assessmentPath
        : (!disableLegacy && fs.existsSync(legacyPath) ? legacyPath : null);

      if (!filePath) {
        return res.status(404).json({ error: 'Assessment file not found' });
      }

      const jsonData = fs.readFileSync(filePath);
      return res.send(jsonData);
    })
    .post(verifyToken, bodyParser.json(), async (req, res) => {
      try {
        const { username, assessmentData } = req.body;

        const tokenUsername = req.user && req.user.username;
        const effectiveUsername = tokenUsername || username;

        if (!effectiveUsername || !assessmentData) {
          return res
            .status(400)
            .json({ error: 'Username and assessment data are required' });
        }

        // Prevent spoofing someone else's history by posting a different username.
        if (tokenUsername && username && String(username) !== String(tokenUsername)) {
          return res.status(403).json({ error: 'Cannot save assessment for a different user' });
        }

        const user = await User.findOne({ username: effectiveUsername });
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        const assessmentIdNum = Number(assessmentData && assessmentData.id);
        if (!Number.isFinite(assessmentIdNum)) {
          return res.status(400).json({ error: 'Invalid assessment id' });
        }

        const scopeRequested =
          assessmentData &&
          typeof assessmentData === 'object' &&
          typeof assessmentData.scopeType === 'string' &&
          assessmentData.scopeType.length > 0;

        const scope = normalizeScopeFromAssessmentData(assessmentData);
        if (scopeRequested && !scope) {
          return res.status(400).json({ error: 'Invalid scope parameters' });
        }

        if (scope && !ContentAssessment) {
          return res.status(500).json({ error: 'Assessment policy enforcement not configured' });
        }
        let mapping = null;
        if (scope && ContentAssessment) {
          mapping = await ContentAssessment.findOne({
            status: 'active',
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            courseId: scope.courseId,
            ...(scope.scopeType === 'lesson' && scope.lessonId ? { lessonId: scope.lessonId } : {}),
            ...(scope.scopeType === 'chapter' && scope.chapterId ? { chapterId: scope.chapterId } : {}),
            assessmentId: assessmentIdNum,
          }).lean();

          if (!mapping) {
            return res.status(400).json({ error: 'Assessment is not attached to this content scope' });
          }

          // Enforce maxAttempts BEFORE saving.
          const maxAttempts = mapping.maxAttempts;
          if (Number.isFinite(Number(maxAttempts))) {
            const used = countAttemptsForScope(
              user,
              assessmentIdNum,
              scope.scopeType,
              scope.courseId,
              scope.lessonId,
              scope.chapterId
            );
            if (used >= Number(maxAttempts)) {
              return res.status(409).json({
                error: 'Max attempts exceeded for this assessment',
                maxAttempts: Number(maxAttempts),
                attemptsUsed: used,
              });
            }
          }
        }

        // Compute pass/fail when a mapping provides passScore.
        const percentScore = computePercentScore(assessmentData.score, assessmentData.totalQuestions);
        let passed = null;
        if (mapping && Number.isFinite(Number(mapping.passScore))) {
          passed = Number.isFinite(Number(percentScore)) ? Number(percentScore) >= Number(mapping.passScore) : false;
        }

        // Add the completed assessment to user's assessments array
        if (!user.assessments) {
          user.assessments = [];
        }

        const toSave = {
          ...assessmentData,
          percentScore: Number.isFinite(Number(percentScore)) ? Number(percentScore) : undefined,
          passed: typeof passed === 'boolean' ? passed : undefined,
        };

        // Normalize IDs to ObjectId fields when scope is present.
        if (scope) {
          toSave.scopeType = scope.scopeType;
          toSave.courseId = new mongoose.Types.ObjectId(scope.courseId);
          if (scope.lessonId) toSave.lessonId = new mongoose.Types.ObjectId(scope.lessonId);
          if (scope.chapterId) toSave.chapterId = new mongoose.Types.ObjectId(scope.chapterId);
        }

        user.assessments.push(toSave);
        user.updatedAt = new Date();
        await user.save();

        console.log('Assessment saved for user:', effectiveUsername);
        res
          .status(200)
          .json({
            message: 'Assessment saved successfully',
            assessment: toSave,
            policy: mapping
              ? {
                  passScore: mapping.passScore ?? null,
                  maxAttempts: mapping.maxAttempts ?? null,
                  passed: typeof passed === 'boolean' ? passed : null,
                }
              : null,
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
