require("dotenv").config();
const express = require("express");
const https = require("https");
const bodyParser = require("body-parser");
const fs = require('fs');
const authRoutes = require(`${__dirname}/routes/authRoutes.js`);
const quizRoutes = require(`${__dirname}/routes/quizRoutes.js`);
const adminUserRoutes = require(`${__dirname}/routes/adminUserRoutes.js`);
const adminQuizRoutes = require(`${__dirname}/routes/adminQuizRoutes.js`);
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
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Define the User schema
const userSchema = new mongoose.Schema ({
    fname: String,
    lname: String,
    username: String,
    email: String,
    password: String,
    phone: String,
    address: {
        street1: String,
        street2: String,
        street3: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    type: String,
    createdAt: Date,
    updatedAt: Date,
    assessments: [{
        id: Number,
        title: String,
        completedAt: Date,
        questions: [{
            questionNum: Number,
            question: String,
            answers: [String],
            selection: [Number],
            correct: [Number],
            isCorrect: Boolean
        }],
        score: Number,
        totalQuestions: Number,
        duration: Number,
        createdAt: Date,
        updatedAt: Date
    }]
});

// Define the User model
const User = mongoose.model("User", userSchema);

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/userDB";
mongoose.connect(mongoURI);

// Setup authentication routes
authRoutes(app, User);

// Setup quiz routes (student-facing)
quizRoutes(app, User);

// Setup admin routes
adminUserRoutes(app, User);
adminQuizRoutes(app);

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
