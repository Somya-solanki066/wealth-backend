import multer from "multer";
import path from "path";

const imageFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);
  if (extName && mimeType) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, JPG, PNG and WEBP image files are allowed."));
  }
};

/** Memory storage — works on Vercel; persist via persistPublicUpload. */
export const memoryImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});
