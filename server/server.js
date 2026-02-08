require("dotenv").config();
const express = require("express");
const https = require("https");
const bodyParser = require("body-parser");
const fs = require('fs');
const authRoutes = require(`${__dirname}/routes/authRoutes.js`);
const assessmentRoutes = require(`${__dirname}/routes/assessmentRoutes.js`);
const adminUserRoutes = require(`${__dirname}/routes/adminUserRoutes.js`);
const adminAssessmentRoutes = require(`${__dirname}/routes/adminAssessmentRoutes.js`);
const courseRoutes = require(`${__dirname}/routes/courseRoutes.js`);
const adminCourseRoutes = require(`${__dirname}/routes/adminCourseRoutes.js`);
const adminLessonChapterRoutes = require(`${__dirname}/routes/adminLessonChapterRoutes.js`);
const adminUploadRoutes = require(`${__dirname}/routes/adminUploadRoutes.js`);
const utilRoutes = require(`${__dirname}/routes/utilRoutes.js`);
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const saltRounds = 10;


const app = express();
const port = process.env.PORT || 3000;


const path = require("path");
const { type } = require("os"); //his function returns a string representing the operating system name (e.g., 'Linux', 'Darwin' for macOS,

// Serve Angular app (support multiple dev/prod layouts)
const distBrowserPath = path.join(__dirname, "../dist/browser");
const distPath = path.join(__dirname, "../dist");
const srcPath = path.join(__dirname, "../src");

if (fs.existsSync(distBrowserPath)) {
    app.use(express.static(distBrowserPath));
} else if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
} else {
    // fallback to serving the source index during development
    app.use(express.static(srcPath));
}

// Serve uploaded assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Models
const User = require(`${__dirname}/models/User.js`);

// Additional models
const Course = require(`${__dirname}/models/Course.js`);
const Enrollment = require(`${__dirname}/models/Enrollment.js`);
const Lesson = require(`${__dirname}/models/Lesson.js`);
const Chapter = require(`${__dirname}/models/Chapter.js`);

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/userDB";
mongoose.connect(mongoURI);

// Backfill `role` for legacy user documents that only had `type`
mongoose.connection.once('open', async () => {
    try {
        const col = mongoose.connection.db.collection('lms_users');
        const cursor = col.find({ role: { $exists: false } }, { projection: { type: 1 } });

        let migrated = 0;
        for await (const doc of cursor) {
            const role = doc.type || 'student';
            await col.updateOne({ _id: doc._id }, { $set: { role: role } });
            migrated++;
        }

        if (migrated > 0) {
            console.log(`[migration] Backfilled role for ${migrated} users`);
        }
    } catch (err) {
        console.log('[migration] Failed to backfill role:', err);
    }
});

// Setup authentication routes
authRoutes(app, User);

// Setup assessment routes (student-facing)
assessmentRoutes(app, User);

// Setup course routes (student-facing)
courseRoutes(app, Course, Enrollment, Lesson, Chapter);

// Setup admin routes
adminUserRoutes(app, User);
adminAssessmentRoutes(app);
adminCourseRoutes(app, Course);
adminLessonChapterRoutes(app, Course, Lesson, Chapter);
adminUploadRoutes(app);

// Setup utility routes
utilRoutes(app);

// Serve Angular app for any other GET request (must be after API routes)
app.use((req, res, next) => {
    // If the request is for API, skip
    if (req.path && req.path.startsWith('/api/')) {
        return next();
    }
    
    let indexFile = null;
    if (fs.existsSync(path.join(distBrowserPath, 'index.html'))) {
        indexFile = path.join(distBrowserPath, 'index.html');
    } else if (fs.existsSync(path.join(distPath, 'index.html'))) {
        indexFile = path.join(distPath, 'index.html');
    } else {
        indexFile = path.join(srcPath, 'index.html');
    }
    
    // Set cache control headers for Safari compatibility
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(indexFile);
});

app.listen(port, () => console.log(`Server is running on port ${port}.`));
