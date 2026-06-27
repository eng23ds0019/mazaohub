const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// Setup storage engine
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|svg|webp|pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, or documents are allowed!'));
    }
  }
});

// GET /api/media - list all media (public/admin)
router.get('/', async (req, res) => {
  try {
    const media = await db.query('SELECT * FROM media ORDER BY uploaded_at DESC');
    res.json({ success: true, media });
  } catch (err) {
    console.error('Error fetching media:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve media library' });
  }
});

// POST /api/media/upload - upload a single file (protected)
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const fileName = req.file.originalname;
  const fileType = req.file.mimetype;
  const fileSize = req.file.size;

  try {
    const sql = 'INSERT INTO media (file_name, file_url, file_type, file_size) VALUES ($1, $2, $3, $4)';
    const params = [fileName, fileUrl, fileType, fileSize];

    let insertedId;
    if (db.getDbType() === 'postgres') {
      const result = await db.run(sql + ' RETURNING id', params);
      insertedId = result.rows[0].id;
    } else {
      const result = await db.run(sql, params);
      insertedId = result.lastID;
    }

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      media: {
        id: insertedId,
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        file_size: fileSize
      }
    });
  } catch (err) {
    console.error('Error saving media record:', err);
    res.status(500).json({ success: false, error: 'Failed to record file in database' });
  }
});

// DELETE /api/media/:id - delete media (protected)
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const mediaItems = await db.query('SELECT * FROM media WHERE id = $1', [parseInt(id)]);
    if (mediaItems.length === 0) {
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }

    const item = mediaItems[0];
    const filename = path.basename(item.file_url);
    const filePath = path.join(uploadDir, filename);

    // Delete file from disk if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete database record
    await db.run('DELETE FROM media WHERE id = $1', [parseInt(id)]);

    res.json({ success: true, message: 'Media file deleted successfully' });
  } catch (err) {
    console.error('Error deleting media:', err);
    res.status(500).json({ success: false, error: 'Failed to delete media file' });
  }
});

module.exports = router;
