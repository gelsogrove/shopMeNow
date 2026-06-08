/**
 * Chat Audio Upload Middleware
 *
 * Dedicated to the playground voice-note recorder (browser MediaRecorder → blob).
 * Kept SEPARATE from `chatAttachmentUpload.ts` (image/PDF) on purpose: that one is
 * working and operator-scoped, and we do not want operators forwarding audio.
 * This accepts a SINGLE audio file under the "audio" field.
 *
 * The real MIME + size are re-validated downstream by `chat-attachment.validation.ts`
 * (magic-byte sniff + 16MB audio cap) once the buffer is known. The fileFilter here
 * is the first, coarse gate.
 */

import multer from "multer"
import os from "os"
import path from "path"
import {
  ACCEPTED_AUDIO_MIME,
  MAX_AUDIO_BYTES,
} from "../../../services/chat-attachment.validation"

const tempDir = os.tmpdir()

// Browser MediaRecorder emits webm/ogg/mp4 depending on the engine; we also
// accept the WhatsApp codecs so the same endpoint is reusable.
const VALID_EXTENSIONS = [".webm", ".ogg", ".oga", ".mp3", ".m4a", ".mp4", ".aac", ".amr", ""]

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tempDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `audio_${timestamp}_${randomString}${ext}`)
  },
})

const fileFilter = (_req: any, file: any, cb: any) => {
  // Strip any "; codecs=opus" suffix before matching the whitelist.
  const baseMime = (file.mimetype || "").split(";")[0].trim().toLowerCase()
  if (!(ACCEPTED_AUDIO_MIME as readonly string[]).includes(baseMime)) {
    return cb(
      new Error(`Invalid audio type "${file.mimetype}".`),
      false
    )
  }
  const ext = path.extname(file.originalname).toLowerCase()
  if (!VALID_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid audio extension "${ext}".`), false)
  }
  cb(null, true)
}

// Single audio file under the "audio" field.
export const uploadChatAudio = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
}).single("audio")

export const handleChatAudioUploadError = (
  err: any,
  _req: any,
  res: any,
  next: any
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "Audio too large",
        message: `Maximum audio size is ${MAX_AUDIO_BYTES / (1024 * 1024)}MB`,
      })
    }
    return res.status(400).json({ error: "Upload error", message: err.message })
  }
  if (err) {
    return res.status(400).json({ error: "Upload error", message: err.message })
  }
  next()
}
