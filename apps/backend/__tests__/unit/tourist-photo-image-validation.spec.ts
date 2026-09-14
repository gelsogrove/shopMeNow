/**
 * TouristPhotoService — gallery image validation (security)
 *
 * WHAT: every photo uploaded to a PRO_LOCO tourist item is stored as base64
 * in `tourist_photos` and served back by an UNAUTHENTICATED endpoint
 * (public-tourist-photos.routes.ts) that echoes the stored mime type into a
 * Content-Type header. These specs lock what the service is willing to store.
 *
 * WHY: before 2026-09-14 `validateImageBase64` accepted "any non-empty
 * string" by design. That meant a backoffice user could store
 * `data:text/html;base64,...` and have the backend serve attacker-controlled
 * HTML from its own origin — stored XSS — and that an arbitrarily large
 * payload would fail only as a bare 413 from the express body parser, with
 * no message naming the real problem. The allow-list, the base64 check and
 * the size cap close all three at the point of entry.
 *
 * The service is exercised through its public `create`, which is the only
 * path a photo can enter by; the repository is mocked so these stay unit
 * tests with no DB.
 */
import { TouristPhotoService } from "../../src/application/services/tourist-photo.service"

// A real 1x1 PNG, base64-encoded — small but genuinely decodable, so the
// "valid image" cases exercise the same code path a real upload takes.
const ONE_PX_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

describe("TouristPhotoService — image validation", () => {
  let service: TouristPhotoService
  let created: any[]

  beforeEach(() => {
    service = new TouristPhotoService()
    created = []
    // Mock the repository: these specs are about what validation ACCEPTS,
    // not about persistence. A call reaching the repo means it passed.
    ;(service as any).touristPhotoRepository = {
      create: jest.fn(async (data: any) => {
        created.push(data)
        return { id: "photo-1", ...data }
      }),
    }
  })

  const upload = (imageBase64: string, contentType = "CHURCH") =>
    service.create({
      workspaceId: "ws-1",
      contentType,
      contentId: "item-1",
      imageBase64,
    })

  describe("accepts genuine images", () => {
    it("accepts a PNG data URI", async () => {
      await expect(upload(`data:image/png;base64,${ONE_PX_PNG}`)).resolves.toBeTruthy()
      expect(created).toHaveLength(1)
    })

    it("accepts raw base64 with no data-URI prefix (legacy rows send this)", async () => {
      await expect(upload(ONE_PX_PNG)).resolves.toBeTruthy()
      expect(created).toHaveLength(1)
    })

    it.each(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"])(
      "accepts %s",
      async (mime) => {
        await expect(upload(`data:${mime};base64,${ONE_PX_PNG}`)).resolves.toBeTruthy()
      }
    )
  })

  describe("rejects payloads that are not images", () => {
    it("rejects an HTML data URI (stored-XSS vector via the public route)", async () => {
      // The public endpoint echoes the stored mime type, so accepting this
      // would let the backend serve attacker HTML from its own origin.
      await expect(
        upload("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")
      ).rejects.toThrow(/Unsupported image type/)
    })

    it("rejects SVG — an image format that can carry <script>", async () => {
      await expect(
        upload(`data:image/svg+xml;base64,${ONE_PX_PNG}`)
      ).rejects.toThrow(/Unsupported image type/)
    })

    it("rejects a payload that is not valid base64", async () => {
      await expect(upload("data:image/png;base64,not!valid!base64!")).rejects.toThrow(
        /not valid base64/
      )
    })

    it("rejects an empty string", async () => {
      await expect(upload("")).rejects.toThrow(/required/)
    })
  })

  describe("enforces the size cap", () => {
    it("rejects an image larger than 4MB", async () => {
      // 5MB of decoded bytes: 'A' repeated produces valid base64 characters,
      // so this fails on SIZE, not on decodability.
      const fiveMbOfBase64 = "A".repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3))
      await expect(upload(`data:image/jpeg;base64,${fiveMbOfBase64}`)).rejects.toThrow(
        /too large/i
      )
    })
  })

  describe("content type allow-list covers the new categories", () => {
    // Andrea, 2026-09-14: churches, castles, viewpoints and venues must be
    // able to hold photos exactly like the original eight categories.
    it.each(["CHURCH", "CASTLE", "VIEWPOINT", "VENUE"])(
      "accepts contentType %s",
      async (contentType) => {
        await expect(
          upload(`data:image/png;base64,${ONE_PX_PNG}`, contentType)
        ).resolves.toBeTruthy()
      }
    )

    it("still rejects an unknown contentType", async () => {
      await expect(
        upload(`data:image/png;base64,${ONE_PX_PNG}`, "MUSEUM")
      ).rejects.toThrow(/Invalid contentType/)
    })
  })
})
