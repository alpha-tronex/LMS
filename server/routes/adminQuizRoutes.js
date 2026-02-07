const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const fs = require('fs');
const path = require('path');

/**
 * Admin Quiz Routes
 * Handles quiz file operations (upload, delete) for administrators
 */
module.exports = function(app) {

    // Upload assessment (admin only)
    app.route("/api/assessment/upload")
        .post(verifyToken, verifyAdmin, async (req, res) => {
            try {
                const quizData = req.body;
                
                // Validate required fields (ID will be auto-assigned)
                if (!quizData.title) {
                    return res.status(400).json({ error: 'Assessment must have a title field' });
                }
                if (!quizData.questions || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
                    return res.status(400).json({ error: 'Assessment must have a questions array with at least one question' });
                }
                
                // Validate each question
                for (let i = 0; i < quizData.questions.length; i++) {
                    const q = quizData.questions[i];
                    if (!q.question) {
                        return res.status(400).json({ error: `Question ${i + 1} is missing the question field` });
                    }
                    if (!q.instructions) {
                        return res.status(400).json({ error: `Question ${i + 1} is missing the instructions field` });
                    }
                    if (!q.correct || !Array.isArray(q.correct) || q.correct.length === 0) {
                        return res.status(400).json({ error: `Question ${i + 1} must have a correct answer array` });
                    }
                    // Check for at least 2 answers
                    if (!q.answers || !Array.isArray(q.answers)) {
                        return res.status(400).json({ error: `Question ${i + 1} must have an answers array` });
                    }
                    const answerCount = q.answers.filter(a => a && a.trim() !== '').length;
                    if (answerCount < 2) {
                        return res.status(400).json({ error: `Question ${i + 1} must have at least 2 answers` });
                    }
                }
                
                // Auto-assign quiz ID using lowest available ID
                const quizzesDir = path.join(__dirname, '../quizzes');
                
                // Create quizzes directory if it doesn't exist
                if (!fs.existsSync(quizzesDir)) {
                    fs.mkdirSync(quizzesDir, { recursive: true });
                }
                
                // Check for duplicate titles (excluding current quiz if editing)
                if (fs.existsSync(quizzesDir)) {
                    const quizFiles = fs.readdirSync(quizzesDir).filter(file => file.endsWith('.json'));
                    for (const file of quizFiles) {
                        const filePath = path.join(quizzesDir, file);
                        const existingQuiz = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        // Skip the current quiz being edited (if ID is provided in request)
                        if (quizData.id !== undefined && existingQuiz.id === quizData.id) {
                            continue;
                        }
                        if (existingQuiz.title && existingQuiz.title.toLowerCase() === quizData.title.toLowerCase()) {
                            return res.status(400).json({ 
                                error: `A quiz with the title "${quizData.title}" already exists (ID: ${existingQuiz.id})` 
                            });
                        }
                    }
                }
                
                // Get all existing quiz IDs
                const existingIds = [];
                if (fs.existsSync(quizzesDir)) {
                    const quizFiles = fs.readdirSync(quizzesDir).filter(file => file.endsWith('.json'));
                    quizFiles.forEach(file => {
                        const match = file.match(/quiz_(\d+)\.json/);
                        if (match) {
                            existingIds.push(parseInt(match[1], 10));
                        }
                    });
                }
                
                // Determine quiz ID
                let newId;
                if (quizData.id !== undefined) {
                    // If ID is provided, use it (this is an update operation)
                    newId = quizData.id;
                } else {
                    // If no ID provided, auto-assign using lowest available ID (new quiz)
                    // Sort IDs to find gaps
                    existingIds.sort((a, b) => a - b);
                    
                    // Find the lowest available ID (fills gaps first)
                    newId = 0;
                    for (let i = 0; i < existingIds.length; i++) {
                        if (existingIds[i] !== newId) {
                            // Found a gap, use this ID
                            break;
                        }
                        newId++;
                    }
                }
                
                // Assign the ID to quiz data
                quizData.id = newId;
                
                const filePath = path.join(quizzesDir, `quiz_${newId}.json`);
                
                // Write quiz to file
                fs.writeFileSync(filePath, JSON.stringify(quizData, null, 2), 'utf8');
                
                console.log(`Assessment uploaded: ${quizData.title} (ID: ${newId})`);
                
                res.status(201).json({ 
                    message: 'Assessment uploaded successfully', 
                    assessmentId: newId,
                    title: quizData.title
                });
            } catch (err) {
                console.log('Assessment upload error:', err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    // Get list of all uploaded assessments (admin only)
    app.route("/api/assessment/list")
        .get(verifyToken, verifyAdmin, (req, res) => {
            try {
                const quizzesDir = path.join(__dirname, '../quizzes');
                
                if (!fs.existsSync(quizzesDir)) {
                    return res.status(200).json([]);
                }
                
                const quizFiles = fs.readdirSync(quizzesDir).filter(file => file.endsWith('.json'));
                
                const quizzes = quizFiles.map(file => {
                    const data = JSON.parse(fs.readFileSync(path.join(quizzesDir, file), 'utf8'));
                    return {
                        id: data.id,
                        title: data.title,
                        description: data.description || '',
                        questionCount: data.questions?.length || 0
                    };
                });
                
                res.status(200).json(quizzes);
            } catch (err) {
                console.log('Error listing assessments:', err);
                res.status(500).json({ error: 'Failed to load assessment list' });
            }
        });

    // Delete a specific assessment file (admin only)
    app.route("/api/admin/assessment-file/:assessmentId")
        .delete(verifyToken, verifyAdmin, async (req, res) => {
            try {
                const assessmentId = req.params.assessmentId;
                const quizFilePath = path.join(__dirname, '../quizzes', `quiz_${assessmentId}.json`);

                if (!fs.existsSync(quizFilePath)) {
                    return res.status(404).json({ error: 'Assessment file not found' });
                }

                fs.unlinkSync(quizFilePath);

                res.status(200).json({ 
                    message: 'Assessment file deleted successfully',
                    assessmentId: assessmentId 
                });
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    // Delete all assessment files (admin only)
    app.route("/api/admin/assessment-files/all")
        .delete(verifyToken, verifyAdmin, async (req, res) => {
            try {
                const quizzesDir = path.join(__dirname, '../quizzes');

                const files = fs.readdirSync(quizzesDir);
                const quizFiles = files.filter(file => file.endsWith('.json') && file.startsWith('quiz_'));

                let deletedCount = 0;
                for (const file of quizFiles) {
                    const filePath = path.join(quizzesDir, file);
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }

                res.status(200).json({ 
                    message: 'All assessment files deleted successfully',
                    deletedCount: deletedCount 
                });
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    // Delete assessment by ID (admin only) - Alternative endpoint
    app.route("/api/assessment/delete/:id")
        .delete(verifyToken, verifyAdmin, (req, res) => {
            try {
                const quizId = req.params.id;
                const quizzesDir = path.join(__dirname, '../quizzes');
                const filePath = path.join(quizzesDir, `quiz_${quizId}.json`);
                
                if (!fs.existsSync(filePath)) {
                    return res.status(404).json({ error: 'Assessment not found' });
                }
                
                fs.unlinkSync(filePath);
                
                console.log(`Assessment deleted: ID ${quizId}`);
                
                res.status(200).json({ message: 'Assessment deleted successfully' });
            } catch (err) {
                console.log('Assessment delete error:', err);
                res.status(500).json({ error: 'Failed to delete assessment' });
            }
        });

};
