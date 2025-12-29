"use strict";
/**
 * Image Upload Middleware
 *
 * Handles file upload with validation:
 * - Max size: 4MB
 * - Accepted formats: PNG, JPG, JPEG, GIF, WEBP
 * - Storage: Automatically uses local (dev) or Cloudinary (production)
 *
 * Files are temporarily stored with multer, then processed by StorageService
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUploadError = exports.uploadImage = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
// Use system temp directory for initial uploads
// Files will be moved to final destination by StorageService
const tempDir = os_1.default.tmpdir();
// Accepted MIME types
const ACCEPTED_MIME_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
];
// Max file size: 4MB
const MAX_FILE_SIZE = 4 * 1024 * 1024;
// Configure multer to use temp directory
// StorageService will handle final storage (local or Cloudinary)
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        // Generate temporary unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const filename = `temp_${timestamp}_${randomString}${ext}`;
        cb(null, filename);
    },
});
// File filter for validation
const fileFilter = (req, file, cb) => {
    // Check MIME type
    if (!ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error(`Invalid file type. Accepted formats: ${ACCEPTED_MIME_TYPES.join(", ")}`), false);
    }
    // Check file extension
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    const validExtensions = [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".svg",
        ".bmp",
    ];
    if (!validExtensions.includes(ext)) {
        return cb(new Error(`Invalid file extension. Accepted extensions: ${validExtensions.join(", ")}`), false);
    }
    cb(null, true);
};
// Create multer upload middleware
exports.uploadImage = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
});
// Error handler middleware for multer errors
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer_1.default.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                error: "File too large",
                message: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
            });
        }
        return res.status(400).json({
            error: "Upload error",
            message: err.message,
        });
    }
    if (err) {
        return res.status(400).json({
            error: "Upload error",
            message: err.message,
        });
    }
    next();
};
exports.handleUploadError = handleUploadError;
//# sourceMappingURL=uploadMiddleware.js.map