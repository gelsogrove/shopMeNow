import { v2 as cloudinary } from 'cloudinary'
import logger from '../utils/logger'

const TTS_FOLDER = 'echatbot/tts'
const TTS_TTL_HOURS = 4

/**
 * TTS Audio Cleanup Job
 *
 * Deletes MP3 files older than TTS_TTL_HOURS from the Cloudinary tts/ folder.
 * TTS audio is ephemeral — generated per-reply, no longer needed after a few hours.
 * Run via Heroku Scheduler every hour: npx ts-node src/scripts/run-job.ts tts-audio-cleanup
 */
export async function ttsAudioCleanupJob(): Promise<void> {
  if (!process.env.CLOUDINARY_URL) {
    logger.info('[TTS-Cleanup] No CLOUDINARY_URL — skipping (local dev)')
    return
  }

  const cloudinaryUrl = process.env.CLOUDINARY_URL
  const match = cloudinaryUrl.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/)
  if (!match) {
    logger.error('[TTS-Cleanup] Invalid CLOUDINARY_URL format — aborting')
    return
  }
  const [, api_key, api_secret, cloud_name] = match
  cloudinary.config({ cloud_name, api_key, api_secret })

  logger.info(`[TTS-Cleanup] Starting — TTL ${TTS_TTL_HOURS}h, folder: ${TTS_FOLDER}`)

  const cutoff = new Date(Date.now() - TTS_TTL_HOURS * 60 * 60 * 1000)

  let result: any
  try {
    result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'raw',
      prefix: TTS_FOLDER,
      max_results: 500,
    })
  } catch (err) {
    logger.error('[TTS-Cleanup] Failed to list Cloudinary resources', err)
    return
  }

  const stale: string[] = (result.resources ?? [])
    .filter((r: any) => new Date(r.created_at) < cutoff)
    .map((r: any) => r.public_id as string)

  if (stale.length === 0) {
    logger.info('[TTS-Cleanup] No stale files found')
    return
  }

  let deleted = 0
  for (let i = 0; i < stale.length; i += 100) {
    const batch = stale.slice(i, i + 100)
    try {
      await cloudinary.api.delete_resources(batch, { resource_type: 'raw' })
      deleted += batch.length
    } catch (err) {
      logger.error('[TTS-Cleanup] Batch delete failed', { batch, err })
    }
  }

  logger.info(`[TTS-Cleanup] ✅ Deleted ${deleted} stale TTS audio files`)
}
