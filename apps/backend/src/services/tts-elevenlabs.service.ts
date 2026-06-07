/**
 * Text-to-Speech via Kokoro-82M (through OpenRouter).
 *
 * Converts LLM reply text → MP3 buffer → uploads to Cloudinary → returns
 * a public URL that WhatsApp providers can send as an audio message.
 *
 * Uses hexgrad/kokoro-82m via OpenRouter (same OPENROUTER_API_KEY as chat).
 * Kokoro is multilingual through language-specific voice prefixes — the voice
 * is selected from the customer language (see LANG_VOICE). Output: mp3 direct.
 */

import axios from "axios"
import logger from "../utils/logger"
import { storageService } from "./storage.service"

const TTS_URL = "https://openrouter.ai/api/v1/audio/speech"
const TTS_MODEL = "hexgrad/kokoro-82m"
const MAX_CHARS = 4096

/**
 * Kokoro voices are language-specific (prefix = language).
 * Female voices chosen for a consistent warm tone across languages.
 * Catalan (ca) has no native Kokoro voice → falls back to Spanish.
 */
const LANG_VOICE: Record<string, string> = {
  it: "if_sara",
  es: "ef_dora",
  en: "af_bella",
  pt: "pf_dora",
  fr: "ff_siwis",
  ca: "ef_dora", // no Catalan voice → Spanish fallback
}
const DEFAULT_VOICE = "if_sara" // Italian is the tenant base language

function voiceForLanguage(lang?: string): string {
  if (!lang) return DEFAULT_VOICE
  return LANG_VOICE[lang.slice(0, 2).toLowerCase()] || DEFAULT_VOICE
}

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
  const voice = voiceForLanguage(customerLanguage)

  logger.info("[TTS] 🗣️ Generating speech", {
    chars: trimmed.length,
    workspaceId,
    voice,
    language: customerLanguage,
  })

  let mp3Buffer: Buffer
  try {
    const res = await axios.post(
      TTS_URL,
      {
        model: TTS_MODEL,
        input: trimmed,
        voice,
        response_format: "mp3",
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
