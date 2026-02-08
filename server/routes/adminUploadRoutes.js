const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { verifyToken, verifyAdminOrInstructor } = require('../middleware/authMiddleware');

function ensureUploadsDir() {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

function safeBaseName(filename) {
  const base = path.basename(filename || 'file');
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dir = ensureUploadsDir();
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '';
    const name = safeBaseName(path.basename(file.originalname || 'file', ext));
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    cb(null, `${name}_${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

module.exports = function adminUploadRoutes(app) {
  // Upload an asset (admin or instructor)
  app.post(
    '/api/admin/uploads',
    verifyToken,
    verifyAdminOrInstructor,
    upload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Missing file' });
        }

        const urlPath = `/uploads/${req.file.filename}`;

        res.status(201).json({
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: urlPath,
        });
      } catch (err) {
        console.log('upload err: ' + err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );
};
