/**
 * MerchantService — the resale side of push campaigns (Andrea, 2026-08-31).
 *
 * WHAT these tests lock:
 * - creative content (text/description/photo/video) may only carry links in
 *   the workspace allow-list — rejected at SAVE time with an actionable 400
 *   naming the offending URLs (CLAUDE.md §16 iron rule 1: the guarantee
 *   against external content is deterministic code, not a prompt rule);
 * - a quota top-up must be a positive integer (the package the Pro Loco
 *   sells) and is delegated to the repository's atomic transaction;
 * - every read/write path carries workspaceId (multi-tenant, rule 2);
 * - stats aggregate the numbers the Pro Loco invoices on: balance, packages
 *   purchased, sent per month.
 *
 * WHY: sends are money the merchant already paid the Pro Loco for — wrong
 * links or wrong counts become invoicing disputes with a real business.
 */
import { MerchantService } from "../../../application/services/merchant.service"
import { AppError } from "../../../interfaces/http/middlewares/error.middleware"

const buildMockPrisma = () => ({
  merchant: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  merchantPush: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  merchantQuotaTopup: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
})

describe("MerchantService", () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: MerchantService

  const WS = "ws-1"
  const MERCHANT = {
    id: "merchant-1",
    workspaceId: WS,
    name: "Bar Centrale",
    isActive: true,
    quotaRemaining: 100,
    deletedAt: null,
  }

  beforeEach(() => {
    jest.resetAllMocks()
    prisma = buildMockPrisma()
    service = new MerchantService(prisma as any)
    // Workspace allow-list read dynamically from the DB on every validation.
    prisma.workspace.findUnique.mockResolvedValue({
      allowedExternalLinks: ["visitsappada.it"],
    })
  })

  describe("merchants", () => {
    it("create requires a non-empty name", async () => {
      await expect(
        service.create({ workspaceId: WS, name: "   " })
      ).rejects.toThrow(AppError)
      expect(prisma.merchant.create).not.toHaveBeenCalled()
    })

    it("getById filters by workspaceId and excludes soft-deleted rows (rule 2)", async () => {
      prisma.merchant.findFirst.mockResolvedValue(MERCHANT)
      await service.getById("merchant-1", WS)
      expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
        where: { id: "merchant-1", workspaceId: WS, deletedAt: null },
      })
    })

    it("getById throws 404 for a merchant of ANOTHER workspace", async () => {
      // The repository query already scopes by workspaceId, so a foreign id
      // simply comes back null — and must surface as not-found, never leak.
      prisma.merchant.findFirst.mockResolvedValue(null)
      await expect(service.getById("foreign-id", WS)).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  describe("quota top-up (the package the Pro Loco sells)", () => {
    it.each([0, -5, 2.5, NaN])("rejects invalid amount %p", async (amount) => {
      await expect(
        service.topUpQuota({ id: "merchant-1", workspaceId: WS, amount })
      ).rejects.toMatchObject({ statusCode: 400 })
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it("increments the balance AND writes the audit row in one transaction", async () => {
      // balance must always equal topups − debited sends: the two writes
      // committing together is what makes the invoice numbers trustworthy.
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma))
      prisma.merchant.updateMany.mockResolvedValue({ count: 1 })
      prisma.merchant.findFirst.mockResolvedValue({
        ...MERCHANT,
        quotaRemaining: 600,
      })

      const result = await service.topUpQuota({
        id: "merchant-1",
        workspaceId: WS,
        amount: 500,
        note: "Winter package",
        createdByUserId: "user-1",
      })

      expect(prisma.merchant.updateMany).toHaveBeenCalledWith({
        where: { id: "merchant-1", workspaceId: WS, deletedAt: null },
        data: { quotaRemaining: { increment: 500 } },
      })
      expect(prisma.merchantQuotaTopup.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WS,
          merchantId: "merchant-1",
          amount: 500,
          note: "Winter package",
          createdByUserId: "user-1",
        },
      })
      expect(result.quotaRemaining).toBe(600)
    })
  })

  describe("creatives — link guard at save time", () => {
    beforeEach(() => {
      prisma.merchant.findFirst.mockResolvedValue(MERCHANT)
    })

    it("🚨 rejects a push whose text carries a URL outside the allow-list, naming it", async () => {
      await expect(
        service.createPush({
          workspaceId: WS,
          merchantId: "merchant-1",
          title: "Aperitivo",
          text: "Prenota su https://truffa.example.com/pay entro stasera!",
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("https://truffa.example.com/pay"),
      })
      expect(prisma.merchantPush.create).not.toHaveBeenCalled()
    })

    it("accepts a push whose links are all in the allow-list (or platform-internal)", async () => {
      prisma.merchantPush.create.mockResolvedValue({ id: "push-1" })
      await service.createPush({
        workspaceId: WS,
        merchantId: "merchant-1",
        title: "Aperitivo",
        text: "Info su https://visitsappada.it/eventi",
        photoUrl: "https://visitsappada.it/foto/aperitivo.jpg",
      })
      expect(prisma.merchantPush.create).toHaveBeenCalled()
    })

    it("🚨 update validates the RESULTING content — new text checked together with the stored video URL", async () => {
      prisma.merchantPush.findFirst.mockResolvedValue({
        id: "push-1",
        workspaceId: WS,
        merchantId: "merchant-1",
        title: "Aperitivo",
        text: "Vecchio testo",
        photoUrl: null,
        videoUrl: "https://not-allowed.example.org/video.mp4", // stored earlier, list changed since
        description: null,
      })

      await expect(
        service.updatePush("push-1", WS, { text: "Nuovo testo pulito" })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("not-allowed.example.org"),
      })
      expect(prisma.merchantPush.updateMany).not.toHaveBeenCalled()
    })

    it("createPush 404s when the merchant belongs to another workspace", async () => {
      prisma.merchant.findFirst.mockResolvedValue(null)
      await expect(
        service.createPush({
          workspaceId: WS,
          merchantId: "foreign-merchant",
          title: "T",
          text: "x",
        })
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe("stats — the invoicing view", () => {
    it("aggregates balance, purchased packages and monthly sent counts", async () => {
      prisma.merchant.findFirst.mockResolvedValue(MERCHANT)
      prisma.merchantQuotaTopup.findMany.mockResolvedValue([
        { id: "t1", amount: 500, note: "Winter", createdAt: new Date() },
        { id: "t2", amount: 200, note: null, createdAt: new Date() },
      ])
      prisma.$queryRaw.mockResolvedValue([
        { month: new Date("2026-08-01T00:00:00Z"), sent: BigInt(87) },
        { month: new Date("2026-07-01T00:00:00Z"), sent: BigInt(141) },
      ])

      const stats = await service.stats("merchant-1", WS)

      expect(stats.quotaRemaining).toBe(100)
      expect(stats.totalPurchased).toBe(700)
      expect(stats.totalSent).toBe(228)
      // "Questo mese hai inviato X" — one row per month, newest first.
      expect(stats.monthlySent).toEqual([
        { month: "2026-08", sent: 87 },
        { month: "2026-07", sent: 141 },
      ])
    })
  })
})
