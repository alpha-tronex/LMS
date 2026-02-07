const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const fs = require('fs');
const path = require('path');

function readAssessmentsFromDisk() {
  const assessmentsDir = path.join(__dirname, '../assessments');
  const legacyDir = path.join(__dirname, '../quizzes');

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
  scanDir(legacyDir, true);
  scanDir(assessmentsDir, false);

  return Array.from(resultsById.values()).sort((a, b) => a.id - b.id);
}

/**
 * Admin Assessment Routes
 * Handles assessment file operations (upload, delete) for administrators
 */
module.exports = function (app) {
  // Upload assessment (admin only)
  app
    .route('/api/assessment/upload')
    .post(verifyToken, verifyAdmin, async (req, res) => {
      try {
        const assessmentData = req.body;

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

        // Determine assessment ID
        let newId;
        if (assessmentData.id !== undefined) {
          // If ID is provided, use it (this is an update operation)
          newId = assessmentData.id;
        } else {
          // If no ID provided, auto-assign using lowest available ID (new assessment)
          existingIds.sort((a, b) => a - b);
          newId = 0;
          for (let i = 0; i < existingIds.length; i++) {
            if (existingIds[i] !== newId) {
              break;
            }
            newId++;
          }
        }

        assessmentData.id = newId;
        const filePath = path.join(assessmentsDir, `assessment_${newId}.json`);

        // Write assessment to file
        fs.writeFileSync(filePath, JSON.stringify(assessmentData, null, 2), 'utf8');

        console.log(`Assessment uploaded: ${assessmentData.title} (ID: ${newId})`);

        res.status(201).json({
          message: 'Assessment uploaded successfully',
          assessmentId: newId,
          title: assessmentData.title,
        });
      } catch (err) {
        console.log('Assessment upload error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

  // Get list of all uploaded assessments (admin only)
  app.route('/api/assessment/list').get(verifyToken, verifyAdmin, (req, res) => {
    try {
      const assessments = readAssessmentsFromDisk();
      res.status(200).json(assessments);
    } catch (err) {
      console.log('Error listing assessments:', err);
      res.status(500).json({ error: 'Failed to load assessment list' });
    }
  });

  // Delete a specific assessment file (admin only)
  app
    .route('/api/admin/assessment-file/:assessmentId')
    .delete(verifyToken, verifyAdmin, async (req, res) => {
      try {
        const assessmentId = req.params.assessmentId;
        const newPath = path.join(__dirname, '../assessments', `assessment_${assessmentId}.json`);
        const legacyPath = path.join(__dirname, '../quizzes', `quiz_${assessmentId}.json`);
        const assessmentFilePath = fs.existsSync(newPath) ? newPath : legacyPath;

        if (!fs.existsSync(assessmentFilePath)) {
          return res.status(404).json({ error: 'Assessment file not found' });
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

  // Delete all assessment files (admin only)
  app
    .route('/api/admin/assessment-files/all')
    .delete(verifyToken, verifyAdmin, async (req, res) => {
      try {
        const assessmentsDir = path.join(__dirname, '../assessments');
        const legacyDir = path.join(__dirname, '../quizzes');

        const dirsToScan = [assessmentsDir, legacyDir].filter((d) => fs.existsSync(d));
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

  // Delete assessment by ID (admin only) - Alternative endpoint
  app
    .route('/api/assessment/delete/:id')
    .delete(verifyToken, verifyAdmin, (req, res) => {
      try {
        const assessmentId = req.params.id;
        const newPath = path.join(__dirname, '../assessments', `assessment_${assessmentId}.json`);
        const legacyPath = path.join(__dirname, '../quizzes', `quiz_${assessmentId}.json`);
        const filePath = fs.existsSync(newPath) ? newPath : legacyPath;

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: 'Assessment not found' });
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
