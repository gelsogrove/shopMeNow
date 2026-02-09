import { CampaignTargetType } from "@echatbot/database"
import { PushCampaignService } from "../../src/application/services/push-campaign.service"
import { platformConfigService } from "../../src/services/platform-config.service"

jest.mock("../../src/services/platform-config.service", () => ({
  __esModule: true,
  platformConfigService: {
    getPrice: jest.fn(),
    getLimit: jest.fn(),
  },
}))

describe("PushCampaignService.create security checks", () => {
  const baseInput = {
    workspaceId: "w1",
    name: "Promo",
    targetingType: CampaignTargetType.ALL,
    message: "Hello",
  }

  beforeEach(() => {
    ;(platformConfigService.getPrice as jest.Mock).mockResolvedValue(1)
    ;(platformConfigService.getLimit as jest.Mock).mockResolvedValue(null)
  })

  it("rejects when WhatsApp is disabled", async () => {
    const prisma = {
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          enableWhatsapp: false,
          ownerId: "owner-1",
        }),
      },
    } as any

    const service = new PushCampaignService(prisma)

    await expect(service.create({ ...baseInput })).rejects.toThrow(
      "Push campaigns are available only for WhatsApp-enabled workspaces"
    )
  })

  it("rejects when workspace owner is missing", async () => {
    const prisma = {
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          enableWhatsapp: true,
          ownerId: null,
        }),
      },
    } as any

    const service = new PushCampaignService(prisma)

    await expect(service.create({ ...baseInput })).rejects.toThrow(
      "Workspace owner not found for credit check"
    )
  })

  it("rejects when no valid recipients are available", async () => {
    const prisma = {
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          enableWhatsapp: true,
          ownerId: "owner-1",
        }),
      },
      customers: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any

    const service = new PushCampaignService(prisma)

    await expect(service.create({ ...baseInput })).rejects.toThrow(
      "No valid recipients found for the selected targeting"
    )
  })

  it("rejects when owner credit is insufficient", async () => {
    const prisma = {
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          enableWhatsapp: true,
          ownerId: "owner-1",
        }),
      },
      customers: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: "c1" }])
          .mockResolvedValueOnce([
            {
              id: "c1",
              phone: "+391234567",
              isBlacklisted: false,
              activeChatbot: true,
              push_notifications_consent: true,
              push_notifications_consent_at: new Date(),
            },
          ]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          creditBalance: { lt: jest.fn().mockReturnValue(true) },
        }),
      },
    } as any

    const service = new PushCampaignService(prisma)

    await expect(service.create({ ...baseInput })).rejects.toThrow(
      "Insufficient credit for campaign"
    )
  })
})
