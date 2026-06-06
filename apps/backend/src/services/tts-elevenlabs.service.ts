/**
 * Text-to-Speech via ElevenLabs API.
 *
 * Converts LLM reply text → MP3 buffer → uploads to Cloudinary → returns
 * a public URL that WhatsApp providers can send as an audio message.
 *
 * Voice: Rachel (en) — multilingual v2 model handles Italian, Spanish, etc.
 * Fallback: if TTS fails for any reason, caller sends text message instead.
 */

import axios from "axios"
import logger from "../utils/logger"
import { storageService } from "./storage.service"

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech"
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM" // Rachel — multilingual
const MODEL_ID = "eleven_multilingual_v2"
const MAX_CHARS = 5000 // ElevenLabs free tier safe limit

/** Strip markdown/emoji/URLs so TTS reads clean spoken text. */
function stripForAudio(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')                  // remove URLs
    .replace(/[*_~`#>|]/g, '')                        // remove markdown symbols
    .replace(/^\s*[-•]\s+/gm, '')                     // remove bullet points
    .replace(/\p{Emoji_Presentation}/gu, '')          // remove emoji
    .replace(/\p{Extended_Pictographic}/gu, '')       // remove pictographic emoji
    .replace(/\[SYSTEM:[^\]]*\]/g, '')                // remove injected system tags
    .replace(/\n{3,}/g, '\n\n')                       // collapse excess newlines
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
  workspaceId: string
): Promise<TTSResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    logger.warn("[TTS] ELEVENLABS_API_KEY not set — skipping audio reply", { workspaceId })
    return null
  }

  const trimmed = stripForAudio(text).slice(0, MAX_CHARS)

  logger.info("[TTS] 🗣️ Generating speech", {
    chars: trimmed.length,
    workspaceId,
    voiceId: DEFAULT_VOICE_ID,
  })

  let mp3Buffer: Buffer
  try {
    const res = await axios.post(
      `${ELEVENLABS_API_URL}/${DEFAULT_VOICE_ID}`,
      {
        text: trimmed,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
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
    logger.error("[TTS] ❌ ElevenLabs request failed", {
      error: err.message,
      status: err.response?.status,
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
