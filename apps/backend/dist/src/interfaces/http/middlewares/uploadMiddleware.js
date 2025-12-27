"use strict";
/**
 * Image Upload Middleware
 *
 * Handles file upload for products, services, and suppliers with validation:
 * - Max size: 4MB
 * - Accepted formats: PNG, JPG, JPEG, GIF, WEBP
 * - Filename: {code}.{extension}
 * - Storage: uploads/products/, uploads/services/, or uploads/suppliers/
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUploadError = exports.uploadImage = void 0;
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
// Get the backend root directory (go up from src/interfaces/http/middlewares to backend root)
const backendRoot = path_1.default.join(__dirname, "../../../../");
// Ensure upload directories exist
const uploadDirs = {
    products: path_1.default.join(backendRoot, "uploads/products"),
    services: path_1.default.join(backendRoot, "uploads/services"),
    suppliers: path_1.default.join(backendRoot, "uploads/suppliers"),
    users: path_1.default.join(backendRoot, "uploads/users"),
    channels: path_1.default.join(backendRoot, "uploads/channels"),
};
Object.values(uploadDirs).forEach((dir) => {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
});
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
// Configure multer storage
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        var _a, _b, _c, _d, _e, _f;
        // Determine upload directory based on route
        const isProduct = (_a = req.baseUrl) === null || _a === void 0 ? void 0 : _a.includes("/products");
        const isSupplier = (_b = req.baseUrl) === null || _b === void 0 ? void 0 : _b.includes("/suppliers");
        const isUser = ((_c = req.baseUrl) === null || _c === void 0 ? void 0 : _c.includes("/users")) || ((_d = req.path) === null || _d === void 0 ? void 0 : _d.includes("/profile"));
        const isChannel = ((_e = req.baseUrl) === null || _e === void 0 ? void 0 : _e.includes("/workspaces")) || ((_f = req.path) === null || _f === void 0 ? void 0 : _f.includes("/logo"));
        let uploadDir = uploadDirs.services; // default
        if (isProduct)
            uploadDir = uploadDirs.products;
        else if (isSupplier)
            uploadDir = uploadDirs.suppliers;
        else if (isUser)
            uploadDir = uploadDirs.users;
        else if (isChannel)
            uploadDir = uploadDirs.channels;
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Get code from body or params (ensure it's a string)
        const code = req.body.Sku ||
            req.body.code ||
            req.body.companyName || // For suppliers
            req.params.code ||
            `file_${Date.now()}`;
        // Sanitize code to prevent path traversal (ensure it's a string)
        const sanitizedCode = String(code).replace(/[^a-zA-Z0-9-_]/g, "_");
        // Get file extension
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        // Generate unique filename for multiple images: {code}_{timestamp}_{random}.{extension}
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const filename = `${sanitizedCode}_${timestamp}_${randomString}${ext}`;
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