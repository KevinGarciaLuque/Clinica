const cloudinary = require("cloudinary").v2;

// Si existe CLOUDINARY_URL, el SDK la lee automáticamente.
// Si no, usa las variables individuales como fallback.
if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

module.exports = cloudinary;
