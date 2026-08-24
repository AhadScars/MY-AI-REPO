const path = require('path');
const multer = require('multer');
const fs = require('fs');

const dest = path.join(__dirname, '..', '..', 'public', 'uploads');
fs.mkdirSync(dest, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dest),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safe);
  },
});

function fileFilter(_req, file, cb) {
  const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
  cb(ok ? null : new Error('Only JPG, PNG, WEBP, or GIF images are allowed'), ok);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 },
});

module.exports = { upload };
