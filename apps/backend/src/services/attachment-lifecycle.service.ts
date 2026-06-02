/**
 * Attachment lifecycle
 *
 * Deletes the PHYSICAL binaries (Cloudinary / local) for chat attachments. The
 * DB rows are removed automatically by the `onDelete: Cascade` FK when their
 * parent Message is deleted — but the stored file is NOT, so it must be deleted
 * explicitly via its storageKey. This is the answer to "when chats or customers
 * are deleted, the files must be deleted too" (plan §9).
 *
 * Documents (PDF) were uploaded with Cloudinary resource_type 'raw', so they
 * must be destroyed as raw — handled here by mapping kind DOCUMENT → raw:true.
 *
 * Best-effort and never throws: a failed file deletion must not abort the
 * surrounding DB deletion transaction. Collect the refs BEFORE deleting the
 * messages (cascade wipes the rows), then call this to purge the binaries.
 */

export interface StorageRef {
  storageKey: string
  kind: "IMAGE" | "DOCUMENT"
}

export interface AttachmentLifecycleStorage {
  deleteByKey(key: string, options?: { raw?: boolean }): Promise<void>
}

export interface AttachmentLifecycleDeps {
  storage: AttachmentLifecycleStorage
  logger?: { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void }
}

export interface PurgeResult {
  deleted: number
  failed: number
}

/**
 * Delete the binaries for the given attachment refs. Best-effort: each failure
 * is counted and logged, never thrown.
 */
export async function purgeAttachmentBinaries(
  deps: AttachmentLifecycleDeps,
  refs: StorageRef[]
): Promise<PurgeResult> {
  const result: PurgeResult = { deleted: 0, failed: 0 }
  if (!Array.isArray(refs) || refs.length === 0) return result

  for (const ref of refs) {
    if (!ref?.storageKey) continue
    try {
      await deps.storage.deleteByKey(ref.storageKey, { raw: ref.kind === "DOCUMENT" })
      result.deleted += 1
    } catch (err) {
      result.failed += 1
      const msg = err instanceof Error ? err.message : String(err)
      deps.logger?.error?.(`[attachment-lifecycle] failed to delete ${ref.storageKey}: ${msg}`)
    }
  }

  deps.logger?.info?.(
    `[attachment-lifecycle] purged binaries: ${result.deleted} deleted, ${result.failed} failed`
  )
  return result
}
