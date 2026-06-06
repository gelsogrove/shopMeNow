/**
 * Audio transcription via OpenAI Whisper API (compatible endpoint on OpenRouter).
 *
 * Accepts either a direct audio URL (UltraMsg / Wasender) or a pre-downloaded
 * Buffer (Meta — media download requires provider auth token). Sends the audio
 * to the Whisper endpoint as multipart/form-data and returns the transcribed text.
 * Used by inbound WhatsApp pipelines to convert customer voice messages into text
 * before entering the LLM chat pipeline.
 */

import axios from "axios"
import FormData from "form-data"
import logger from "../utils/logger"

const WHISPER_URL = "https://openrouter.ai/api/v1/audio/transcriptions"
const WHISPER_MODEL = "openai/whisper-large-v3"
const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25 MB — Whisper hard limit

export interface TranscribeAudioInput {
  /** Pre-downloaded audio buffer (Meta path — download requires provider auth). */
  audioBuffer?: Buffer
  /** Direct download URL for the audio file (UltraMsg / Wasender path). */
  audioUrl?: string
  /** Declared MIME type from the provider (e.g. "audio/ogg; codecs=opus"). */
  declaredMime?: string
  /** Provider name for structured logging. */
  provider: "meta" | "ultramsg" | "wasender"
  workspaceId: string
}

export interface TranscribeAudioResult {
  text: string
  tokensUsed?: number
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

  const form = new FormData()
  form.append("file", buffer, { filename, contentType: declaredMime || "audio/ogg" })
  form.append("model", WHISPER_MODEL)

  logger.info("[AUDIO-TRANSCRIPTION] 🎤 Sending to Whisper", {
    model: WHISPER_MODEL,
    bytes: buffer.byteLength,
    ext,
    provider,
    workspaceId,
  })

  try {
    const res = await axios.post(WHISPER_URL, form, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      timeout: 30_000,
    })

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

    return { text, tokensUsed: res.data?.usage?.total_tokens }
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
