const cloudinary = require('cloudinary').v2;

// Reads CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
// from the environment. If they're not set, config() just no-ops here and
// any actual upload attempt fails with a clear error from Cloudinary's SDK
// rather than crashing the whole server on startup.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;