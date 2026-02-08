const jwt = require('jsonwebtoken');

// Secret key for JWT (should be in environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

/**
 * Middleware to verify JWT token
 */
function verifyToken(req, res, next) {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Add user info to request object
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please login again.' });
        }
        return res.status(403).json({ error: 'Invalid token.' });
    }
}

/**
 * Middleware to verify admin role
 */
function verifyAdmin(req, res, next) {
    const role = req.user && (req.user.role || req.user.type);
    if (!req.user || role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    next();
}

/**
 * Middleware to verify admin OR instructor role
 */
function verifyAdminOrInstructor(req, res, next) {
    const role = req.user && (req.user.role || req.user.type);
    if (!req.user || (role !== 'admin' && role !== 'instructor')) {
        return res
            .status(403)
            .json({ error: 'Access denied. Admin or instructor privileges required.' });
    }
    next();
}

/**
 * Generate JWT token
 */
function generateToken(user) {
    const role = user.role;
    const payload = {
        id: user._id || user.id,
        username: user.username || user.uname,
        role: role,
        // keep legacy claim for existing consumers
        type: role,
        email: user.email
    };

    // Token expires in 24 hours
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

module.exports = {
    verifyToken,
    verifyAdmin,
    verifyAdminOrInstructor,
    generateToken,
    JWT_SECRET
};
