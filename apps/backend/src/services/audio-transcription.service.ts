/**
 * Audio transcription via OpenAI Whisper API (compatible endpoint on OpenRouter).
 *
 * Accepts either a direct audio URL (UltraMsg / Wasender) or a pre-downloaded
 * Buffer (Meta — media download requires provider auth token). Manually builds
 * multipart/form-data with a simple alphanumeric boundary — OpenRouter rejects
 * boundaries with leading dashes (form-data/openai-sdk default).
 * Used by inbound WhatsApp pipelines to convert customer voice messages into text
 * before entering the LLM chat pipeline.
 */

import axios from "axios"
import logger from "../utils/logger"

const WHISPER_URL = "https://openrouter.ai/api/v1/audio/transcriptions"
const WHISPER_MODEL = "openai/whisper-1"
const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25 MB — Whisper hard limit

export interface TranscribeAudioInput {
  /** Pre-downloaded audio buffer (Meta path — download requires provider auth). */
  audioBuffer?: Buffer
  /** Direct download URL for the audio file (UltraMsg / Wasender path). */
  audioUrl?: string
  /** Declared MIME type from the provider (e.g. "audio/ogg; codecs=opus"). */
  declaredMime?: string
  /** Provider name for structured logging. */
  provider: "meta" | "ultramsg" | "wasender" | "playground"
  workspaceId: string
}

export interface TranscribeAudioResult {
  text: string
}

/**
 * Transcribe a WhatsApp audio message.
 * Returns null if transcription fails — caller should fall back to a placeholder.
 */
export async function transcribeAudio(
  input: TranscribeAudioInput
): Promise<TranscribeAudioResult | null> {
  const { audioBuffer, audioUrl, declaredMime, provider, workspaceId } = input

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    logger.error("[AUDIO-TRANSCRIPTION] ❌ OPENROUTER_API_KEY not set", { workspaceId })
    return null
  }

  let buffer: Buffer

  if (audioBuffer) {
    buffer = audioBuffer
  } else if (audioUrl) {
    logger.info("[AUDIO-TRANSCRIPTION] ⬇️ Downloading audio", {
      provider,
      workspaceId,
      url: audioUrl.substring(0, 80),
    })
    try {
      const dlRes = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 15_000 })
      buffer = Buffer.from(dlRes.data)
    } catch (err) {
      logger.error("[AUDIO-TRANSCRIPTION] ❌ Download error", { error: err, provider, workspaceId })
      return null
    }
  } else {
    logger.error("[AUDIO-TRANSCRIPTION] ❌ Neither audioBuffer nor audioUrl provided", { provider, workspaceId })
    return null
  }

  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    logger.warn("[AUDIO-TRANSCRIPTION] ⚠️ Audio too large, skipping", {
      bytes: buffer.byteLength,
      provider,
      workspaceId,
    })
    return null
  }

  const ext = mimeToExt(declaredMime)
  const filename = `audio.${ext}`
  const mimeType = declaredMime || "audio/ogg"

  logger.info("[AUDIO-TRANSCRIPTION] 🎤 Sending to Whisper", {
    model: WHISPER_MODEL,
    bytes: buffer.byteLength,
    ext,
    format: mimeToOpenRouterFormat(declaredMime),
    declaredMime,
    provider,
    workspaceId,
  })

  // OpenRouter audio transcription uses JSON + base64, NOT multipart/form-data.
  const base64Audio = buffer.toString("base64")
  // WhatsApp sends audio/ogg;codecs=opus — OpenRouter accepts "ogg" as format
  const format = mimeToOpenRouterFormat(declaredMime)

  try {
    const res = await axios.post(
      WHISPER_URL,
      {
        model: WHISPER_MODEL,
        input_audio: {
          data: base64Audio,
          format,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30_000,
      }
    )

    const text = res.data?.text?.trim()
    if (!text) {
      logger.warn("[AUDIO-TRANSCRIPTION] ⚠️ Whisper returned empty text", { provider, workspaceId })
      return null
    }

    logger.info("[AUDIO-TRANSCRIPTION] ✅ Transcription complete", {
      chars: text.length,
      provider,
      workspaceId,
    })

    return { text }
  } catch (err: any) {
    logger.error("[AUDIO-TRANSCRIPTION] ❌ Whisper request error", {
      error: err.message,
      status: err.response?.status,
      body: JSON.stringify(err.response?.data)?.substring(0, 300),
      provider,
      workspaceId,
    })
    return null
  }
}

/** Map MIME type to OpenRouter-accepted format string. */
function mimeToOpenRouterFormat(mime?: string): string {
  if (!mime) return "ogg"
  if (mime.includes("ogg")) return "ogg"
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3"
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a"
  if (mime.includes("wav")) return "wav"
  if (mime.includes("aac")) return "aac"
  if (mime.includes("webm")) return "webm"
  if (mime.includes("flac")) return "flac"
  return "ogg"
}

function mimeToExt(mime?: string): string {
  if (!mime) return "ogg"
  if (mime.includes("ogg")) return "ogg"
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3"
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a"
  if (mime.includes("wav")) return "wav"
  if (mime.includes("amr")) return "amr"
  if (mime.includes("aac")) return "aac"
  if (mime.includes("webm")) return "webm"
  return "ogg"
}
