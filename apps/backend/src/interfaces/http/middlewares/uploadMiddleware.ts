/**
 * Image Upload Middleware
 *
 * Handles file upload with validation:
 * - Max size: 10MB (sufficient for high-quality product images)
 * - Accepted formats: PNG, JPG, JPEG, GIF, WEBP, SVG, BMP
 * - Storage: Automatically uses local (dev) or Cloudinary (production)
 * 
 * Files are temporarily stored with multer, then processed by StorageService
 */

import multer from "multer"
import path from "path"
import os from "os"

// Use system temp directory for initial uploads
// Files will be moved to final destination by StorageService
const tempDir = os.tmpdir()

// Accepted MIME types
// BUG#14 FIX: SVG removed — SVG files can embed <script> tags and JavaScript
// event handlers that execute when the browser renders the file from the same
// origin (Stored XSS).  Legitimate product images never need SVG.
const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/bmp",
]

// Max file size: 10MB (increased from 4MB for product/service images)
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Configure multer to use temp directory
// StorageService will handle final storage (local or Cloudinary)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir)
  },
  filename: (req, file, cb) => {
    // Generate temporary unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const ext = path.extname(file.originalname).toLowerCase()
    const filename = `temp_${timestamp}_${randomString}${ext}`
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
    ".bmp",
    // .svg intentionally excluded — BUG#14 (Stored XSS via embedded script)
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
