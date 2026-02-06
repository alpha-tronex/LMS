const fs = require('fs');
const bodyParser = require("body-parser");
const { verifyToken } = require('../middleware/authMiddleware');

module.exports = function(app, User) {
    // Get list of all available quizzes (protected route)
    app.get("/api/quizzes", verifyToken, (req, res) => {
        console.log('loading available quizzes');
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

    // Get a specific quiz or default quiz (protected route)
    app.route("/api/quiz")
        .get(verifyToken, (req, res) => {
            console.log('loading quiz data');
            const quizId = req.query.id || 0;
            console.log('quizId: ' + quizId);
            const jsonData = fs.readFileSync(__dirname + `/../quizzes/quiz_${quizId}.json`);
            res.send(jsonData);
        })
        .post(verifyToken, bodyParser.json(), async (req, res) => {
            try {
                const { username, quizData } = req.body;
                
                if (!username || !quizData) {
                    return res.status(400).json({ error: 'Username and quiz data are required' });
                }
                
                const user = await User.findOne({ username: username });
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }
                
                // Add the completed quiz to user's quizzes array
                user.quizzes.push(quizData);
                user.updatedAt = new Date();
                await user.save();
                
                console.log('Quiz saved for user:', username);
                res.status(200).json({ message: 'Quiz saved successfully', quiz: quizData });
            } catch (error) {
                console.error('Error saving quiz:', error);
                res.status(500).json({ error: 'Failed to save quiz' });
            }
        });

    // Get quiz history for a specific user (protected route)
    app.get("/api/quiz/history/:username", verifyToken, async (req, res) => {
        try {
            const username = req.params.username;
            
            if (!username) {
                return res.status(400).json({ error: 'Username is required' });
            }
            
            const user = await User.findOne({ username: username });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            console.log('Quiz history retrieved for user:', username);
            res.status(200).json({ quizzes: user.quizzes || [] });
        } catch (error) {
            console.error('Error retrieving quiz history:', error);
            res.status(500).json({ error: 'Failed to retrieve quiz history' });
        }
    });
};
