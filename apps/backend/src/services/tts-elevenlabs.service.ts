/**
 * Text-to-Speech via OpenAI TTS API (through OpenRouter).
 *
 * Converts LLM reply text → MP3 buffer → uploads to Cloudinary → returns
 * a public URL that WhatsApp providers can send as an audio message.
 *
 * Uses openai/tts-1 model via OpenRouter (same API key as chat completions).
 * Voice: nova (warm female, multilingual). Fallback: shimmer.
 */

import axios from "axios"
import logger from "../utils/logger"
import { storageService } from "./storage.service"

const TTS_URL = "https://openrouter.ai/api/v1/audio/speech"
const TTS_MODEL = "openai/tts-1"
const TTS_VOICE = "nova" // warm female, works well in all languages
const MAX_CHARS = 4096 // OpenAI TTS limit

/** Strip markdown/emoji/URLs so TTS reads clean spoken text. */
function stripForAudio(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_~`#>|]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\p{Emoji_Presentation}/gu, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\[SYSTEM:[^\]]*\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export interface TTSResult {
  audioUrl: string
}

/**
 * Generate audio from text and return a public Cloudinary URL.
 * Returns null on any failure — caller must fall back to text.
 */
export async function generateSpeech(
  text: string,
  workspaceId: string,
  customerLanguage?: string
): Promise<TTSResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    logger.warn("[TTS] OPENROUTER_API_KEY not set — skipping audio reply", { workspaceId })
    return null
  }

  const trimmed = stripForAudio(text).slice(0, MAX_CHARS)

  logger.info("[TTS] 🗣️ Generating speech", {
    chars: trimmed.length,
    workspaceId,
    voice: TTS_VOICE,
    language: customerLanguage,
  })

  let mp3Buffer: Buffer
  try {
    const res = await axios.post(
      TTS_URL,
      {
        model: TTS_MODEL,
        input: trimmed,
        voice: TTS_VOICE,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
        timeout: 30_000,
      }
    )
    mp3Buffer = Buffer.from(res.data)
  } catch (err: any) {
    logger.error("[TTS] ❌ OpenAI TTS request failed", {
      error: err.message,
      status: err.response?.status,
      body: JSON.stringify(err.response?.data)?.substring(0, 300),
      workspaceId,
    })
    return null
  }

  logger.info("[TTS] ⬆️ Uploading MP3 to storage", { bytes: mp3Buffer.byteLength, workspaceId })

  try {
    const filename = `tts-${workspaceId}-${Date.now()}.mp3`
    const { url } = await storageService.upload(mp3Buffer, {
      filename,
      folder: `tts/${workspaceId}`,
      contentType: "audio/mpeg",
      isPublic: true,
    })

    logger.info("[TTS] ✅ Audio ready", { url: url.substring(0, 80), workspaceId })
    return { audioUrl: url }
  } catch (err) {
    logger.error("[TTS] ❌ Storage upload failed", { error: err, workspaceId })
    return null
  }
}
