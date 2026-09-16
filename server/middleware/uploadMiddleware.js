const multer = require('multer');

// Files land in memory as a Buffer (not written to disk) since we're just
// streaming them straight through to Cloudinary - nothing to clean up
// afterwards.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, etc.) are allowed for receipts.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB - plenty for a phone photo of a receipt
});

module.exports = upload;