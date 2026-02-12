const { verifyToken, verifyAdmin, verifyAdminOrInstructor } = require('../middleware/authMiddleware');
const fs = require('fs');
const path = require('path');
const { getRole, getUserId } = require('../utils/courseAccess');

function readAssessmentsFromDisk() {
  const assessmentsDir = path.join(__dirname, '../assessments');
  const legacyDir = path.join(__dirname, '../quizzes');
  const disableLegacy =
    String(process.env.DISABLE_LEGACY_QUIZZES || '').toLowerCase() === '1' ||
    String(process.env.DISABLE_LEGACY_QUIZZES || '').toLowerCase() === 'true';

  const resultsById = new Map();

  const scanDir = (dirPath, preserveExisting) => {
    if (!fs.existsSync(dirPath)) return;
    const jsonFiles = fs.readdirSync(dirPath).filter((file) => file.endsWith('.json'));
    for (const file of jsonFiles) {
      try {
        const raw = fs.readFileSync(path.join(dirPath, file), 'utf8');
        const data = JSON.parse(raw);

        let id = data?.id;
        if (typeof id !== 'number') {
          const match = file.match(/(?:assessment|quiz)_(\d+)\.json/);
          if (match) id = parseInt(match[1], 10);
        }
        if (typeof id !== 'number' || Number.isNaN(id)) continue;

        if (!preserveExisting || !resultsById.has(id)) {
          resultsById.set(id, {
            id,
            title: data?.title,
            description: data?.description || '',
            questionCount: data?.questions?.length || 0,
          });
        }
      } catch (_) {
        // ignore unreadable files
      }
    }
  };

  // Load legacy first, then new to prefer new files on collisions.
  if (!disableLegacy) {
    scanDir(legacyDir, true);
  }
  scanDir(assessmentsDir, false);

  return Array.from(resultsById.values()).sort((a, b) => a.id - b.id);
}

/**
 * Admin Assessment Routes
 * Handles assessment file operations (upload, delete) for administrators
 */
module.exports = function (app, ContentAssessment) {
  const disableLegacy =
    String(process.env.DISABLE_LEGACY_QUIZZES || '').toLowerCase() === '1' ||
    String(process.env.DISABLE_LEGACY_QUIZZES || '').toLowerCase() === 'true';

  function resolveAssessmentFilePath(assessmentId) {
    const id = String(assessmentId);
    const newPath = path.join(__dirname, '../assessments', `assessment_${id}.json`);
    const legacyPath = path.join(__dirname, '../quizzes', `quiz_${id}.json`);
    if (fs.existsSync(newPath)) return newPath;
    if (!disableLegacy && fs.existsSync(legacyPath)) return legacyPath;
    return null;
  }

  function readAssessmentOwner(filePath) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const ownerId = parsed && parsed.ownerId ? String(parsed.ownerId) : '';
      const ownerRole = parsed && parsed.ownerRole ? String(parsed.ownerRole) : '';
      return { ownerId: ownerId || null, ownerRole: ownerRole || null, parsed };
    } catch (_) {
      return { ownerId: null, ownerRole: null, parsed: null };
    }
  }

  async function assessmentHasAnyMappings(assessmentId) {
    if (!ContentAssessment) return false;
    const id = Number(assessmentId);
    if (!Number.isFinite(id)) return false;
    const exists = await ContentAssessment.exists({ assessmentId: id });
    return !!exists;
  }

  function generateVersionedTitle(baseTitle, existingAssessments) {
    const base = String(baseTitle || '').trim() || 'Untitled Assessment';
    const existing = new Set(
      (Array.isArray(existingAssessments) ? existingAssessments : [])
        .map((a) => (a && a.title ? String(a.title).toLowerCase() : ''))
        .filter((t) => t.length > 0)
    );

    if (!existing.has(base.toLowerCase())) return base;

    for (let v = 2; v <= 50; v++) {
      const candidate = `${base} (v${v})`;
      if (!existing.has(candidate.toLowerCase())) return candidate;
    }

    // Fallback (extremely unlikely)
    return `${base} (${Date.now()})`;
  }

  // Upload assessment (admin or instructor)
  app
    .route('/api/assessment/upload')
    .post(verifyToken, verifyAdminOrInstructor, async (req, res) => {
      try {
        const assessmentData = req.body;

        const requesterRole = getRole(req);
        const requesterId = getUserId(req);

        // Validate required fields (ID will be auto-assigned)
        if (!assessmentData.title) {
          return res
            .status(400)
            .json({ error: 'Assessment must have a title field' });
        }
        if (
          !assessmentData.questions ||
          !Array.isArray(assessmentData.questions) ||
          assessmentData.questions.length === 0
        ) {
          return res.status(400).json({
            error: 'Assessment must have a questions array with at least one question',
          });
        }

        // Validate each question
        for (let i = 0; i < assessmentData.questions.length; i++) {
          const q = assessmentData.questions[i];
          if (!q.question) {
            return res
              .status(400)
              .json({ error: `Question ${i + 1} is missing the question field` });
          }
          if (!q.instructions) {
            return res.status(400).json({
              error: `Question ${i + 1} is missing the instructions field`,
            });
          }
          if (!q.correct || !Array.isArray(q.correct) || q.correct.length === 0) {
            return res.status(400).json({
              error: `Question ${i + 1} must have a correct answer array`,
            });
          }
          // Check for at least 2 answers
          if (!q.answers || !Array.isArray(q.answers)) {
            return res.status(400).json({
              error: `Question ${i + 1} must have an answers array`,
            });
          }
          const answerCount = q.answers.filter((a) => a && a.trim() !== '').length;
          if (answerCount < 2) {
            return res.status(400).json({
              error: `Question ${i + 1} must have at least 2 answers`,
            });
          }
        }

        // Auto-assign assessment ID using lowest available ID.
        // For reads, merge both new and legacy folders; for writes, always write to new folder.
        const assessmentsDir = path.join(__dirname, '../assessments');
        if (!fs.existsSync(assessmentsDir)) {
          fs.mkdirSync(assessmentsDir, { recursive: true });
        }

        const existingAssessments = readAssessmentsFromDisk();

        // Check for duplicate titles (excluding current assessment if editing)
        for (const existingAssessment of existingAssessments) {
          if (
            assessmentData.id !== undefined &&
            existingAssessment.id === assessmentData.id
          ) {
            continue;
          }

          if (
            existingAssessment.title &&
            existingAssessment.title.toLowerCase() === assessmentData.title.toLowerCase()
          ) {
            return res.status(400).json({
              error: `An assessment with the title "${assessmentData.title}" already exists (ID: ${existingAssessment.id})`,
            });
          }
        }

        const existingIds = existingAssessments.map((a) => a.id);

        const nowIso = new Date().toISOString();

        const isUpdateRequest = assessmentData.id !== undefined && assessmentData.id !== null;
        const requestedId = isUpdateRequest ? Number(assessmentData.id) : null;

        // Determine assessment ID / behavior
        let newId;
        let createdNewVersion = false;
        let previousAssessmentId = null;

        if (isUpdateRequest) {
          if (!Number.isFinite(requestedId) || requestedId < 0) {
            return res.status(400).json({ error: 'Invalid assessment id' });
          }

          const existingPath = resolveAssessmentFilePath(String(requestedId));

          if (!existingPath) {
            // Do not allow instructors to "claim" arbitrary IDs.
            if (requesterRole !== 'admin') {
              return res.status(404).json({ error: 'Assessment not found' });
            }
          }

          if (existingPath) {
            const { ownerId } = readAssessmentOwner(existingPath);

            // Legacy/shared assessments without an owner are admin-owned.
            if (!ownerId && requesterRole !== 'admin') {
              return res.status(403).json({ error: 'Access denied. Only admins can edit shared assessments.' });
            }

            if (requesterRole !== 'admin') {
              if (!requesterId) {
                return res.status(403).json({ error: 'Access denied.' });
              }
              if (String(ownerId) !== String(requesterId)) {
                return res.status(403).json({ error: 'Access denied. You can only edit your own assessments.' });
              }
            }

            const attached = await assessmentHasAnyMappings(requestedId);
            if (attached && requesterRole === 'instructor') {
              // Versioning: do not mutate an attached assessment. Create a new one.
              existingIds.sort((a, b) => a - b);
              newId = 0;
              for (let i = 0; i < existingIds.length; i++) {
                if (existingIds[i] !== newId) break;
                newId++;
              }

              createdNewVersion = true;
              previousAssessmentId = requestedId;
              assessmentData.id = newId;
              assessmentData.basedOnAssessmentId = previousAssessmentId;
              assessmentData.ownerId = requesterId || null;
              assessmentData.ownerRole = requesterRole || null;
              assessmentData.createdAt = nowIso;
              assessmentData.updatedAt = nowIso;

              // Ensure title is unique (original title will collide).
              assessmentData.title = generateVersionedTitle(assessmentData.title, existingAssessments);

              const versionPath = path.join(assessmentsDir, `assessment_${newId}.json`);
              fs.writeFileSync(versionPath, JSON.stringify(assessmentData, null, 2), 'utf8');

              console.log(
                `Assessment version created: ${assessmentData.title} (ID: ${newId}, based on ${previousAssessmentId})`
              );

              return res.status(201).json({
                message:
                  'Assessment is attached to course content and cannot be modified in place. A new version was created.',
                assessmentId: newId,
                previousAssessmentId,
                createdNewVersion: true,
                title: assessmentData.title,
              });
            }
          }

          // Safe to overwrite (not attached, or admin override).
          newId = requestedId;
        } else {
          // New assessment
          existingIds.sort((a, b) => a - b);
          newId = 0;
          for (let i = 0; i < existingIds.length; i++) {
            if (existingIds[i] !== newId) {
              break;
            }
            newId++;
          }
        }

        // Ownership metadata
        if (requesterId) {
          assessmentData.ownerId = assessmentData.ownerId || String(requesterId);
        }
        if (requesterRole) {
          assessmentData.ownerRole = assessmentData.ownerRole || String(requesterRole);
        }

        // Timestamp metadata (harmless for student runtime)
        if (!assessmentData.createdAt) {
          assessmentData.createdAt = nowIso;
        }
        assessmentData.updatedAt = nowIso;

        assessmentData.id = newId;
        const filePath = path.join(assessmentsDir, `assessment_${newId}.json`);

        // Write assessment to file
        fs.writeFileSync(filePath, JSON.stringify(assessmentData, null, 2), 'utf8');

        console.log(`Assessment uploaded: ${assessmentData.title} (ID: ${newId})`);

        res.status(201).json({
          message: 'Assessment uploaded successfully',
          assessmentId: newId,
          title: assessmentData.title,
          createdNewVersion: !!createdNewVersion,
          previousAssessmentId,
        });
      } catch (err) {
        console.log('Assessment upload error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

  // Get list of all uploaded assessments (admin or instructor)
  app.route('/api/assessment/list').get(verifyToken, verifyAdminOrInstructor, (req, res) => {
    try {
      const assessments = readAssessmentsFromDisk();
      res.status(200).json(assessments);
    } catch (err) {
      console.log('Error listing assessments:', err);
      res.status(500).json({ error: 'Failed to load assessment list' });
    }
  });

  // Delete a specific assessment file (admin or instructor)
  app
    .route('/api/admin/assessment-file/:assessmentId')
    .delete(verifyToken, verifyAdminOrInstructor, async (req, res) => {
      try {
        const assessmentId = req.params.assessmentId;
        const assessmentFilePath = resolveAssessmentFilePath(assessmentId);

        if (!assessmentFilePath) {
          return res.status(404).json({ error: 'Assessment file not found' });
        }

        const role = getRole(req);
        const userId = getUserId(req);

        const attached = await assessmentHasAnyMappings(assessmentId);
        if (attached && role !== 'admin') {
          return res.status(409).json({ error: 'Cannot delete: assessment is attached to course content.' });
        }

        if (role !== 'admin') {
          const { ownerId } = readAssessmentOwner(assessmentFilePath);
          if (!ownerId) {
            return res.status(403).json({ error: 'Access denied. Only admins can delete shared assessments.' });
          }
          if (!userId || String(ownerId) !== String(userId)) {
            return res.status(403).json({ error: 'Access denied. You can only delete your own assessments.' });
          }
          if (attached) {
            return res.status(409).json({ error: 'Cannot delete: assessment is attached to course content.' });
          }
        } else {
          const force = String(req.query && req.query.force || '').toLowerCase();
          if (attached && force !== '1' && force !== 'true') {
            return res.status(409).json({
              error: 'Cannot delete: assessment is attached to course content. Detach it first, or retry with ?force=true.',
            });
          }
        }

        fs.unlinkSync(assessmentFilePath);

        res.status(200).json({
          message: 'Assessment file deleted successfully',
          assessmentId: assessmentId,
        });
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

  // Delete all assessment files (admin or instructor)
  app
    .route('/api/admin/assessment-files/all')
    .delete(verifyToken, verifyAdmin, async (req, res) => {
      try {
        const force = String(req.query && req.query.force || '').toLowerCase();
        const anyMappings = ContentAssessment ? await ContentAssessment.exists({}) : false;
        if (anyMappings && force !== '1' && force !== 'true') {
          return res.status(409).json({
            error: 'Cannot delete all assessment files while content-assessment mappings exist. Detach/cleanup mappings first, or retry with ?force=true.',
          });
        }

        const assessmentsDir = path.join(__dirname, '../assessments');
        const legacyDir = path.join(__dirname, '../quizzes');

        const dirsToScan = [assessmentsDir, ...(disableLegacy ? [] : [legacyDir])].filter((d) => fs.existsSync(d));
        if (dirsToScan.length === 0) {
          return res.status(200).json({
            message: 'All assessment files deleted successfully',
            deletedCount: 0,
          });
        }

        let deletedCount = 0;
        for (const dir of dirsToScan) {
          const files = fs.readdirSync(dir);
          const assessmentFiles = files.filter(
            (file) =>
              file.endsWith('.json') &&
              (file.startsWith('assessment_') || file.startsWith('quiz_'))
          );

          for (const file of assessmentFiles) {
            fs.unlinkSync(path.join(dir, file));
            deletedCount++;
          }
        }

        res.status(200).json({
          message: 'All assessment files deleted successfully',
          deletedCount: deletedCount,
        });
      } catch (err) {
        console.log('err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

  // Delete assessment by ID (admin or instructor) - Alternative endpoint
  app
    .route('/api/assessment/delete/:id')
    .delete(verifyToken, verifyAdminOrInstructor, async (req, res) => {
      try {
        const assessmentId = req.params.id;
        const filePath = resolveAssessmentFilePath(assessmentId);

        if (!filePath) {
          return res.status(404).json({ error: 'Assessment not found' });
        }

        const role = getRole(req);
        const userId = getUserId(req);

        const attached = await assessmentHasAnyMappings(assessmentId);

        if (role !== 'admin') {
          const { ownerId } = readAssessmentOwner(filePath);
          if (!ownerId) {
            return res.status(403).json({ error: 'Access denied. Only admins can delete shared assessments.' });
          }
          if (!userId || String(ownerId) !== String(userId)) {
            return res.status(403).json({ error: 'Access denied. You can only delete your own assessments.' });
          }
          if (attached) {
            return res.status(409).json({ error: 'Cannot delete: assessment is attached to course content.' });
          }
        } else {
          const force = String(req.query && req.query.force || '').toLowerCase();
          if (attached && force !== '1' && force !== 'true') {
            return res.status(409).json({
              error: 'Cannot delete: assessment is attached to course content. Detach it first, or retry with ?force=true.',
            });
          }
        }

        fs.unlinkSync(filePath);
        console.log(`Assessment deleted: ID ${assessmentId}`);

        res.status(200).json({ message: 'Assessment deleted successfully' });
      } catch (err) {
        console.log('Assessment delete error:', err);
        res.status(500).json({ error: 'Failed to delete assessment' });
      }
    });
};
