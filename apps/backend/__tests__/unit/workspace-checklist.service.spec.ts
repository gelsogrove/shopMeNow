import { WorkspaceChecklistService } from "../../src/application/services/workspace-checklist.service"

describe("WorkspaceChecklistService", () => {
  it("should build checklist for an info widget channel", async () => {
    const mockPrisma = {
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          id: "w1",
          channelType: "WIDGET",
          channelMode: 'INFORMATIONAL' as any,
          enableWhatsapp: false,
          enableWidget: true,
          defaultLanguage: "en",
          welcomeMessage: "Welcome",
          wipMessage: "WIP",
          chatbotName: "Sofia",
          toneOfVoice: "friendly",
          botIdentityResponse: "I am your assistant",
          hasHumanSupport: false,
          humanSupportInstructions: null,
          operatorContactMethod: "email",
          operatorEmail: "admin@example.com",
          operatorWhatsappNumber: null,
          whatsappPhoneNumber: null,
          whatsappApiKey: null,
          whatsappPhoneNumberId: null,
          whatsappBusinessAccountId: null,
          whatsappVerifyToken: null,
          webhookUrl: null,
          widgetTitle: "Chat with us",
          widgetPrimaryColor: "#22c55e",
          widgetIcon: "chat",
          widgetLanguage: "en",
          channelStatus: true,
          owner: { isPaymentConnected: true, planType: "BASIC" },
          whatsappSettings: null,
        }),
      },
      fAQ: { count: jest.fn().mockResolvedValue(10) },
      products: { count: jest.fn().mockResolvedValue(0) },
      services: { count: jest.fn().mockResolvedValue(0) },
      sales: { count: jest.fn().mockResolvedValue(0) },
      offers: { count: jest.fn().mockResolvedValue(0) },
      campaign: { count: jest.fn().mockResolvedValue(0) },
      pushCampaign: { count: jest.fn().mockResolvedValue(1) },
    }

    const service = new WorkspaceChecklistService(mockPrisma as any)
    const result = await service.getChecklist("w1")

    const keys = result.items.map((item) => item.key)

    expect(result.workspaceId).toBe("w1")
    expect(result.channelType).toBe("WIDGET")
    expect(result.channelMode).toBe('INFORMATIONAL')
    expect(result.percent).toBe(100)
      expect(keys).toEqual(
        expect.arrayContaining([
        "channel-active",
        "faqs",
        "bot-identity",
        "default-language",
        "welcome-message",
        "wip-message",
        "assistant-name",
        "tone-of-voice",
        "campaigns",
        "paypal",
        "widget-settings",
      ])
    )
    expect(keys).not.toEqual(
      expect.arrayContaining([
        "whatsapp-settings",
        "products",
        "services",
        "offers",
        "human-support",
        "frustration-triggers",
      ])
    )
  })
})
