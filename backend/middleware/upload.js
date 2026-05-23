const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Dossier uploads dans la racine du projet (versionné avec Git)
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const subDir = req.params.roomId
      ? path.join(UPLOAD_DIR, 'rooms', String(req.params.roomId))
      : path.join(UPLOAD_DIR, 'properties');

    fs.mkdirSync(subDir, { recursive: true });
    cb(null, subDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, unique);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non supporté. Utilisez JPG, PNG ou WebP.'), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 Mo max
});

module.exports = { upload };
