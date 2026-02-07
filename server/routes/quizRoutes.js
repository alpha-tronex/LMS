const fs = require('fs');
const bodyParser = require("body-parser");
const { verifyToken } = require('../middleware/authMiddleware');

module.exports = function(app, User) {
    // Get list of all available assessments (protected route)
    app.get("/api/assessments", verifyToken, (req, res) => {
        console.log('loading available assessments');
        const quizzesDir = __dirname + '/../quizzes';
        console.log('quizzesDir: ' + quizzesDir);
        const quizFiles = fs.readdirSync(quizzesDir).filter(file => file.endsWith('.json'));
        
        const quizzes = quizFiles.map(file => {
            const data = JSON.parse(fs.readFileSync(`${quizzesDir}/${file}`, 'utf8'));
            return {
                id: data.id,
                title: data.title
            };
        });
        
        res.json(quizzes);
    });

    // Get a specific assessment or default assessment (protected route)
    app.route("/api/assessment")
        .get(verifyToken, (req, res) => {
            console.log('loading assessment data');
            const assessmentId = req.query.id || 0;
            console.log('assessmentId: ' + assessmentId);
            const jsonData = fs.readFileSync(__dirname + `/../quizzes/quiz_${assessmentId}.json`);
            res.send(jsonData);
        })
        .post(verifyToken, bodyParser.json(), async (req, res) => {
            try {
                const { username, assessmentData } = req.body;
                
                if (!username || !assessmentData) {
                    return res.status(400).json({ error: 'Username and assessment data are required' });
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
                res.status(200).json({ message: 'Assessment saved successfully', assessment: assessmentData });
            } catch (error) {
                console.error('Error saving assessment:', error);
                res.status(500).json({ error: 'Failed to save assessment' });
            }
        });

    // Get assessment history for a specific user (protected route)
    app.get("/api/assessment/history/:username", verifyToken, async (req, res) => {
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
