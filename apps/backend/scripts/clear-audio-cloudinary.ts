/**
 * Delete all TTS audio files from Cloudinary.
 *
 * TTS replies are uploaded under `echatbot/tts/<workspaceId>/` as `video`
 * resources (Cloudinary serves audio under the video resource_type). WhatsApp
 * downloads the audio at send time, so the stored copy is disposable once
 * delivered. This script wipes every TTS audio asset in one shot.
 *
 * Run:  npm run clear:audio:cloudinary   (from apps/backend)
 *
 * Reads CLOUDINARY_URL from the root .env (same as the storage service).
 */

import { v2 as cloudinary } from "cloudinary"

const PREFIX = "echatbot/tts"
// Cloudinary stores TTS audio as the 'video' resource_type (see storage.service).
const RESOURCE_TYPE = "video"

async function main(): Promise<void> {
  const cloudinaryUrl = process.env.CLOUDINARY_URL
  if (!cloudinaryUrl) {
    console.error("❌ CLOUDINARY_URL not set — cannot connect to Cloudinary.")
    process.exit(1)
  }

  // Parse cloudinary://api_key:api_secret@cloud_name (same as storage.service).
  const match = cloudinaryUrl.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/)
  if (!match) {
    console.error("❌ Invalid CLOUDINARY_URL format.")
    process.exit(1)
  }
  const [, api_key, api_secret, cloud_name] = match
  cloudinary.config({ cloud_name, api_key, api_secret })

  console.log(`🧹 Deleting all TTS audio under "${PREFIX}/" (resource_type=${RESOURCE_TYPE})…`)

  let totalDeleted = 0
  // delete_resources_by_prefix removes up to 1000 per call; loop until the
  // prefix is empty (each call reports what it deleted).
  // We page by repeatedly calling until no resources remain.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res: any = await cloudinary.api.delete_resources_by_prefix(PREFIX, {
      resource_type: RESOURCE_TYPE,
    })

    const deletedKeys = Object.keys(res?.deleted || {})
    if (deletedKeys.length === 0) break

    totalDeleted += deletedKeys.length
    console.log(`   • removed ${deletedKeys.length} (running total ${totalDeleted})`)

    // When fewer than the page cap come back, we're done.
    if (deletedKeys.length < 1000) break
  }

  // Drop the now-empty folders so the Media Library stays tidy.
  try {
    await cloudinary.api.delete_folder(PREFIX)
  } catch {
    // Folder may still hold per-workspace subfolders or already be gone — ignore.
  }

  console.log(`✅ Done. Deleted ${totalDeleted} TTS audio file(s).`)
}

main().catch((err) => {
  console.error("❌ clear-audio-cloudinary failed:", err)
  process.exit(1)
})
