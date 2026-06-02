/**
 * Chat Attachment Upload Middleware
 *
 * Separate from `uploadMiddleware.ts` (product/service images) on purpose — that
 * one is working and image-only; we do not touch it. This middleware accepts the
 * chat attachment set (JPEG, PNG, PDF), allows multiple files (a WhatsApp
 * multi-file "bundle"), and applies a global size cap. Per-type size limits and
 * magic-byte sniffing are enforced afterwards by `chat-attachment.validation.ts`
 * once the buffers/sizes are known.
 *
 * Files land in the system temp dir; StorageService moves them to their final
 * destination (local in dev, Cloudinary in prod).
 *
 * See docs/media-attachments-plan.md.
 */

import multer from "multer"
import os from "os"
import path from "path"
import {
  ACCEPTED_CHAT_MIME,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_DOCUMENT_BYTES,
} from "../../../services/chat-attachment.validation"

const tempDir = os.tmpdir()

// Global multer cap = the largest per-type cap (documents). The stricter
// image cap (5MB) is enforced downstream by validateAttachment(), because
// multer's fileFilter cannot know the final size per MIME type.
const GLOBAL_MAX_FILE_SIZE = MAX_DOCUMENT_BYTES

const VALID_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"]

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tempDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `chat_${timestamp}_${randomString}${ext}`)
  },
})

const fileFilter = (_req: any, file: any, cb: any) => {
  if (!ACCEPTED_CHAT_MIME.includes(file.mimetype)) {
    return cb(
      new Error(
        `Invalid file type "${file.mimetype}". Allowed: JPEG, PNG, PDF.`
      ),
      false
    )
  }
  const ext = path.extname(file.originalname).toLowerCase()
  if (!VALID_EXTENSIONS.includes(ext)) {
    return cb(
      new Error(
        `Invalid file extension "${ext}". Allowed: ${VALID_EXTENSIONS.join(", ")}.`
      ),
      false
    )
  }
  cb(null, true)
}

// Multiple files under the "files" field, capped at MAX_ATTACHMENTS_PER_MESSAGE.
export const uploadChatAttachments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: GLOBAL_MAX_FILE_SIZE,
    files: MAX_ATTACHMENTS_PER_MESSAGE,
  },
}).array("files", MAX_ATTACHMENTS_PER_MESSAGE)

// Error handler for multer-specific errors on chat uploads.
export const handleChatUploadError = (
  err: any,
  _req: any,
  res: any,
  next: any
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large",
        message: `Maximum file size is ${GLOBAL_MAX_FILE_SIZE / (1024 * 1024)}MB`,
      })
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Too many files",
        message: `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} files per message`,
      })
    }
    return res.status(400).json({ error: "Upload error", message: err.message })
  }
  if (err) {
    return res.status(400).json({ error: "Upload error", message: err.message })
  }
  next()
}
