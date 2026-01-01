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
  isActive: true,
  isDelete: false,
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
    const activeWorkspace = buildWorkspace({ id: "ws-active", isDelete: false })
    const deletedWorkspace = buildWorkspace({ id: "ws-deleted", isDelete: true })

    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          workspaces: [
            { workspace: activeWorkspace },
            { workspace: deletedWorkspace },
          ],
        }),
      },
    } as unknown as PrismaClient

    const repository = new WorkspaceRepository(mockPrisma)
    const result = await repository.findByUserId("user-1")

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("ws-active")
  })
})
