const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req) => ({
    folder:            'appartements',
    allowed_formats:   ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    transformation:    [{ quality: 'auto', fetch_format: 'auto' }],
    resource_type:     'image',
  }),
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok = /\.(jpe?g|png|webp|avif|gif)$/i.test(file.originalname);
    ok ? cb(null, true) : cb(new Error('Format non supporté (JPG, PNG, WebP)'));
  },
});

// Supprime une image Cloudinary à partir de son URL ou public_id
async function deleteCloudinaryImage(urlOrPublicId) {
  if (!urlOrPublicId) return;
  let publicId = urlOrPublicId;
  if (urlOrPublicId.startsWith('http')) {
    const match = urlOrPublicId.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) return;
    publicId = match[1].replace(/\.[^/.]+$/, '');
  }
  try { await cloudinary.uploader.destroy(publicId); } catch (_) {}
}

module.exports = { upload, deleteCloudinaryImage };
