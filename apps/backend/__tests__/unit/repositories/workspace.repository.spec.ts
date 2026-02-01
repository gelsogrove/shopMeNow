import { describe, it, expect } from "@jest/globals"
import { PrismaClient } from "@prisma/client"
import { WorkspaceRepository } from "../../../src/repositories/workspace.repository"

const buildWorkspace = (overrides: Partial<any> = {}) => ({
  id: "ws-1",
  name: "Workspace 1",
  slug: "workspace-1",
  description: null,
  whatsappPhoneNumber: null,
  whatsappApiKey: null,
  whatsappWebhookUrl: null,
  webhookUrl: null,
  notificationEmail: null,
  language: "it",
  currency: "EUR",
  messageLimit: 0,
  blocklist: null,
  welcomeMessage: null,
  wipMessage: null,
  channelStatus: true,
  deletedAt: null,
  url: null,
  debugMode: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  afterRegistrationMessages: null,
  planType: null,
  trialEndsAt: null,
  allowedExternalLinks: [],
  sellsProductsAndServices: true,
  hasSalesAgents: false,
  hasHumanSupport: true,
  humanSupportInstructions: null,
  frustrationEscalationInstructions: null,
  operatorContactMethod: "email",
  operatorWhatsappNumber: null,
  toneOfVoice: "friendly",
  botIdentityResponse: null,
  address: null,
  customAiRules: null,
  logoUrl: null,
  translateProductNames: false,
  translateCategoryNames: false,
  translateServiceNames: true,
  catalogBaseLanguage: "it",
  whatsappSettings: null,
  agentConfigs: [],
  ...overrides,
})

describe("WorkspaceRepository", () => {
  it("should filter out deleted workspaces for a user", async () => {
    const activeWorkspace = buildWorkspace({ id: "ws-active", deletedAt: null })
    const deletedWorkspace = buildWorkspace({ id: "ws-deleted", deletedAt: new Date() })

    const mockPrisma = {
      workspace: {
        findMany: jest.fn().mockResolvedValue([activeWorkspace]),
      },
    } as unknown as PrismaClient

    const repository = new WorkspaceRepository(mockPrisma)
    const result = await repository.findByUserId("user-1")

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("ws-active")
    expect(mockPrisma.workspace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      })
    )
  })

  it("should prefer whatsappSettings for WhatsApp credentials", async () => {
    const settings = {
      phoneNumber: "+1234567890",
      apiKey: "settings-api-key",
      appSecret: "settings-secret",
      webhookId: "wh-id",
      webhookToken: "wh-token",
      webhookUrl: "https://example.com/webhook",
      adminEmail: "admin@example.com",
    }

    const workspace = buildWorkspace({
      id: "ws-1",
      whatsappPhoneNumber: "+9999999999",
      whatsappApiKey: "workspace-api-key",
      webhookUrl: "https://legacy.example.com/webhook",
      whatsappSettings: settings,
      agentConfigs: [],
    })

    const mockPrisma = {
      workspace: {
        findUnique: jest.fn().mockResolvedValue(workspace),
      },
    } as unknown as PrismaClient

    const repository = new WorkspaceRepository(mockPrisma)
    const result = await repository.findById("ws-1")

    expect(result?.whatsappPhoneNumber).toBe(settings.phoneNumber)
    expect(result?.whatsappApiKey).toBe(settings.apiKey)
    expect(result?.whatsappWebhookUrl).toBe(settings.webhookUrl)
    expect(result?.whatsappVerifyToken).toBe(settings.webhookToken)
    expect(result?.adminEmail).toBe(settings.adminEmail)
  })
})
