/**
 * Unit Tests — Attachment Lifecycle (binary purge)
 *
 * WHAT: Validates that physical attachment binaries are deleted via storageKey,
 *       that PDFs are deleted as Cloudinary 'raw' resources, and that the purge
 *       is best-effort (a single storage failure does not abort the rest, and
 *       the function never throws).
 *
 * WHY:  When a chat or customer is deleted, the DB rows cascade away but the
 *       stored files do NOT — they must be purged explicitly or they leak
 *       forever (cost + privacy/GDPR). This is the core of plan §9. The purge
 *       runs inside DB deletion flows, so it must never throw and abort them.
 */

import {
  AttachmentLifecycleStorage,
  StorageRef,
  purgeAttachmentBinaries,
} from "../../src/services/attachment-lifecycle.service"

function makeStorage(): jest.Mocked<AttachmentLifecycleStorage> {
  return {
    deleteByKey: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AttachmentLifecycleStorage>
}

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

describe("purgeAttachmentBinaries()", () => {
  it("deletes each binary by its storageKey", async () => {
    const storage = makeStorage()
    const refs: StorageRef[] = [
      { storageKey: "echatbot/chat/ws/sess/img1", kind: "IMAGE" },
      { storageKey: "echatbot/chat/ws/sess/img2", kind: "IMAGE" },
    ]

    const res = await purgeAttachmentBinaries({ storage, logger }, refs)

    expect(res).toEqual({ deleted: 2, failed: 0 })
    expect(storage.deleteByKey).toHaveBeenCalledTimes(2)
  })

  it("deletes PDFs as RAW resources (resource_type fix)", async () => {
    const storage = makeStorage()
    const refs: StorageRef[] = [{ storageKey: "echatbot/chat/ws/sess/doc1", kind: "DOCUMENT" }]

    await purgeAttachmentBinaries({ storage, logger }, refs)

    expect(storage.deleteByKey).toHaveBeenCalledWith("echatbot/chat/ws/sess/doc1", { raw: true })
  })

  it("deletes images as NON-raw resources", async () => {
    const storage = makeStorage()
    const refs: StorageRef[] = [{ storageKey: "img", kind: "IMAGE" }]

    await purgeAttachmentBinaries({ storage, logger }, refs)

    expect(storage.deleteByKey).toHaveBeenCalledWith("img", { raw: false })
  })

  it("is best-effort: counts failures and keeps going (never throws)", async () => {
    const storage = makeStorage()
    storage.deleteByKey
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("cloudinary down"))
      .mockResolvedValueOnce(undefined)

    const refs: StorageRef[] = [
      { storageKey: "a", kind: "IMAGE" },
      { storageKey: "b", kind: "IMAGE" },
      { storageKey: "c", kind: "DOCUMENT" },
    ]

    const res = await purgeAttachmentBinaries({ storage, logger }, refs)

    expect(res).toEqual({ deleted: 2, failed: 1 })
    expect(storage.deleteByKey).toHaveBeenCalledTimes(3)
  })

  it("skips refs with an empty storageKey", async () => {
    const storage = makeStorage()
    const refs: StorageRef[] = [{ storageKey: "", kind: "IMAGE" } as StorageRef]

    const res = await purgeAttachmentBinaries({ storage, logger }, refs)

    expect(res).toEqual({ deleted: 0, failed: 0 })
    expect(storage.deleteByKey).not.toHaveBeenCalled()
  })

  it("handles an empty list", async () => {
    const storage = makeStorage()
    const res = await purgeAttachmentBinaries({ storage, logger }, [])
    expect(res).toEqual({ deleted: 0, failed: 0 })
  })
})
