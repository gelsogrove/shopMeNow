/**
 * Image Upload Middleware
 *
 * Handles file upload for products, services, and suppliers with validation:
 * - Max size: 4MB
 * - Accepted formats: PNG, JPG, JPEG, GIF, WEBP
 * - Filename: {code}.{extension}
 * - Storage: uploads/products/, uploads/services/, or uploads/suppliers/
 */

import fs from "fs"
import multer from "multer"
import path from "path"

// Get the backend root directory (go up from src/interfaces/http/middlewares to backend root)
const backendRoot = path.join(__dirname, "../../../../")

// Ensure upload directories exist
const uploadDirs = {
  products: path.join(backendRoot, "uploads/products"),
  services: path.join(backendRoot, "uploads/services"),
  suppliers: path.join(backendRoot, "uploads/suppliers"),
}

Object.values(uploadDirs).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// Accepted MIME types
const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
]

// Max file size: 4MB
const MAX_FILE_SIZE = 4 * 1024 * 1024

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine upload directory based on route
    const isProduct = req.baseUrl?.includes("/products")
    const isSupplier = req.baseUrl?.includes("/suppliers")

    let uploadDir = uploadDirs.services // default
    if (isProduct) uploadDir = uploadDirs.products
    else if (isSupplier) uploadDir = uploadDirs.suppliers

    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Get code from body or params (ensure it's a string)
    const code =
      req.body.ProductCode ||
      req.body.code ||
      req.body.companyName || // For suppliers
      req.params.code ||
      `file_${Date.now()}`

    // Sanitize code to prevent path traversal (ensure it's a string)
    const sanitizedCode = String(code).replace(/[^a-zA-Z0-9-_]/g, "_")

    // Get file extension
    const ext = path.extname(file.originalname).toLowerCase()

    // Generate unique filename for multiple images: {code}_{timestamp}_{random}.{extension}
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const filename = `${sanitizedCode}_${timestamp}_${randomString}${ext}`

    cb(null, filename)
  },
})

// File filter for validation
const fileFilter = (req: any, file: any, cb: any) => {
  // Check MIME type
  if (!ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        `Invalid file type. Accepted formats: ${ACCEPTED_MIME_TYPES.join(", ")}`
      ),
      false
    )
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase()
  const validExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".bmp",
  ]

  if (!validExtensions.includes(ext)) {
    return cb(
      new Error(
        `Invalid file extension. Accepted extensions: ${validExtensions.join(", ")}`
      ),
      false
    )
  }

  cb(null, true)
}

// Create multer upload middleware
export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
})

// Error handler middleware for multer errors
export const handleUploadError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large",
        message: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      })
    }
    return res.status(400).json({
      error: "Upload error",
      message: err.message,
    })
  }

  if (err) {
    return res.status(400).json({
      error: "Upload error",
      message: err.message,
    })
  }

  next()
}
