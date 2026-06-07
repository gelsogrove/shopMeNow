/**
 * Text-to-Speech via ElevenLabs.
 *
 * Converts LLM reply text → MP3 buffer → uploads to Cloudinary → returns
 * a public URL that WhatsApp providers can send as an audio message.
 *
 * Uses the eleven_turbo_v2_5 model: a single voice handles all customer
 * languages with natural, fluid prosody — no per-language voice mapping needed.
 * Turbo v2.5 is ~half the credit cost of multilingual_v2 and lower latency.
 *
 * Config (env, no hardcoded secrets):
 *   ELEVENLABS_API_KEY   — required, Creator plan or above (API access)
 *   ELEVENLABS_VOICE_ID  — optional, defaults to a warm multilingual female voice
 */

import axios from "axios"
import logger from "../utils/logger"
import { storageService } from "./storage.service"

const TTS_BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech"
const TTS_MODEL = "eleven_turbo_v2_5"
// Default voice "Rachel" — warm, neutral, works across all supported languages.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
const MAX_CHARS = 4096

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
  customerLanguage?: string,
  /** Explicit voice ID (resolved by caller from settings.json per language).
   *  Takes precedence over the ELEVENLABS_VOICE_ID env and the built-in default. */
  voiceIdOverride?: string
): Promise<TTSResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    logger.warn("[TTS] ELEVENLABS_API_KEY not set — skipping audio reply", { workspaceId })
    return null
  }

  const voiceId = voiceIdOverride || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID
  const trimmed = stripForAudio(text).slice(0, MAX_CHARS)

  logger.info("[TTS] 🗣️ Generating speech", {
    chars: trimmed.length,
    workspaceId,
    voiceId,
    model: TTS_MODEL,
    language: customerLanguage,
  })

  let mp3Buffer: Buffer
  try {
    const res = await axios.post(
      `${TTS_BASE_URL}/${voiceId}`,
      {
        text: trimmed,
        model_id: TTS_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      },
      {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        responseType: "arraybuffer",
        timeout: 30_000,
      }
    )
    mp3Buffer = Buffer.from(res.data)
  } catch (err: any) {
    // ElevenLabs error bodies arrive as arraybuffer — decode to text for the log.
    let body: string | undefined
    try {
      body = err.response?.data ? Buffer.from(err.response.data).toString("utf8") : undefined
    } catch {
      body = undefined
    }
    logger.error("[TTS] ❌ ElevenLabs TTS request failed", {
      error: err.message,
      status: err.response?.status,
      body: body?.substring(0, 300),
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
