import { prisma, PrismaClient, ChannelType } from "@echatbot/database"

export interface ChecklistAction {
  path: string
  section?: string
  focusKey?: string
  action?: "paypal-connect"
}

export interface ChecklistItem {
  key: string
  label: string
  completed: boolean
  action?: ChecklistAction
}

export interface WorkspaceChecklist {
  workspaceId: string
  channelType: ChannelType
  sellsProductsAndServices: boolean
  completedCount: number
  totalCount: number
  percent: number
  items: ChecklistItem[]
}

export class WorkspaceChecklistService {
  constructor(private prismaClient: PrismaClient = prisma) {}

  private isFilled(value?: string | null): boolean {
    return !!value && value.trim().length > 0
  }

  private addItem(
    items: ChecklistItem[],
    item: ChecklistItem
  ): void {
    items.push(item)
  }

  async getChecklist(workspaceId: string): Promise<WorkspaceChecklist> {
    const workspace = await this.prismaClient.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        channelType: true,
        sellsProductsAndServices: true,
        enableWhatsapp: true,
        enableWidget: true,
        defaultLanguage: true,
        welcomeMessage: true,
        wipMessage: true,
        chatbotName: true,
        toneOfVoice: true,
        botIdentityResponse: true,
        hasHumanSupport: true,
        humanSupportInstructions: true,
        frustrationEscalationInstructions: true,
        operatorContactMethod: true,
        operatorEmail: true,
        operatorWhatsappNumber: true,
        whatsappPhoneNumber: true,
        whatsappApiKey: true,
        whatsappPhoneNumberId: true,
        whatsappVerifyToken: true,
        webhookUrl: true,
        channelStatus: true,
        widgetTitle: true,
        widgetPrimaryColor: true,
        widgetIcon: true,
        widgetLanguage: true,
        owner: {
          select: {
            isPaymentConnected: true,
            planType: true,
          },
        },
        whatsappSettings: {
          select: {
            phoneNumber: true,
            apiKey: true,
            webhookToken: true,
            webhookUrl: true,
            businessAccountId: true,
          },
        },
      },
    })

    if (!workspace) {
      throw new Error("Workspace not found")
    }

    const [
      faqCount,
      productsCount,
      servicesCount,
      salesCount,
      offersCount,
      pushCampaignsCount,
    ] = await Promise.all([
      this.prismaClient.fAQ.count({
        where: { workspaceId, isActive: true },
      }),
      this.prismaClient.products.count({
        where: { workspaceId, isActive: true },
      }),
      this.prismaClient.services.count({
        where: { workspaceId, isActive: true },
      }),
      this.prismaClient.sales.count({
        where: { workspaceId, isActive: true },
      }),
      this.prismaClient.offers.count({
        where: { workspaceId, isActive: true },
      }),
      this.prismaClient.pushCampaign.count({
        where: { workspaceId },
      }),
    ])

    const channelType = workspace.channelType ?? "WHATSAPP"
    const sellsProductsAndServices = workspace.sellsProductsAndServices ?? false
    const hasWhatsApp = workspace.enableWhatsapp === true
    const hasWidget = workspace.enableWidget === true

    const whatsappSettings = workspace.whatsappSettings
    const whatsappPhoneNumber =
      whatsappSettings?.phoneNumber ?? workspace.whatsappPhoneNumber
    const whatsappApiKey = whatsappSettings?.apiKey ?? workspace.whatsappApiKey
    const whatsappVerifyToken =
      whatsappSettings?.webhookToken ?? workspace.whatsappVerifyToken
    const whatsappWebhookUrl = whatsappSettings?.webhookUrl ?? workspace.webhookUrl
    const whatsappBusinessAccountId = whatsappSettings?.businessAccountId

    const hasHumanSupport = workspace.hasHumanSupport ?? false
    const operatorContactMethod = workspace.operatorContactMethod ?? "email"
    const operatorEmail = workspace.operatorEmail
    const operatorWhatsappNumber = workspace.operatorWhatsappNumber

    const items: ChecklistItem[] = []

    this.addItem(items, {
      key: "channel-active",
      label: "Channel is active",
      completed: workspace.channelStatus ?? true,
      action: { path: "/settings", section: "business", focusKey: "channelStatus" },
    })

    this.addItem(items, {
      key: "faqs",
      label: "At least 10 FAQs",
      completed: faqCount >= 10,
      action: { path: "/faq" },
    })

    this.addItem(items, {
      key: "bot-identity",
      label: "Bot Identity",
      completed: this.isFilled(workspace.botIdentityResponse),
      action: { path: "/settings", section: "ai-personality", focusKey: "botDescription" },
    })

    this.addItem(items, {
      key: "default-language",
      label: "Default Language",
      completed: this.isFilled(workspace.defaultLanguage),
      action: { path: "/settings", section: "business", focusKey: "defaultLanguage" },
    })

    this.addItem(items, {
      key: "welcome-message",
      label: "Welcome message",
      completed: this.isFilled(workspace.welcomeMessage),
      action: { path: "/settings", section: "ai-personality", focusKey: "welcomeMessage" },
    })

    this.addItem(items, {
      key: "wip-message",
      label: "WIP message",
      completed: this.isFilled(workspace.wipMessage),
      action: { path: "/settings", section: "ai-personality", focusKey: "maintenanceMessage" },
    })

    this.addItem(items, {
      key: "assistant-name",
      label: "Assistant Name",
      completed: this.isFilled(workspace.chatbotName),
      action: { path: "/settings", section: "ai-personality", focusKey: "botName" },
    })

    this.addItem(items, {
      key: "tone-of-voice",
      label: "Tone of Voice",
      completed: this.isFilled(workspace.toneOfVoice),
      action: { path: "/settings", section: "ai-personality", focusKey: "toneOfVoice" },
    })

    if (hasHumanSupport) {
      const humanSupportComplete =
        this.isFilled(workspace.humanSupportInstructions) &&
        this.isFilled(operatorContactMethod) &&
        (operatorContactMethod === "email"
          ? this.isFilled(operatorEmail)
          : this.isFilled(operatorWhatsappNumber))

      this.addItem(items, {
        key: "human-support",
        label: "Human Support",
        completed: humanSupportComplete,
        action: { path: "/settings", section: "widget-support", focusKey: "humanSupportToggle" },
      })

      this.addItem(items, {
        key: "frustration-triggers",
        label: "Frustration Triggers",
        completed: this.isFilled(workspace.frustrationEscalationInstructions),
        action: { path: "/settings", section: "widget-support", focusKey: "frustrationTriggers" },
      })
    }

    this.addItem(items, {
      key: "campaigns",
      label: "Campaign",
      completed: pushCampaignsCount > 0,
      action: { path: "/campaigns" },
    })

    const ownerPlanType = workspace.owner?.planType ?? "FREE_TRIAL"
    if (ownerPlanType !== "FREE_TRIAL") {
      this.addItem(items, {
        key: "paypal",
        label: "PayPal Account",
        completed: workspace.owner?.isPaymentConnected ?? false,
        action: { path: "/settings", section: "subscription", focusKey: "paypalConnect", action: "paypal-connect" },
      })
    }

    if (hasWhatsApp) {
      this.addItem(items, {
        key: "whatsapp-settings",
        label: "WhatsApp Access Settings",
        completed:
          this.isFilled(whatsappPhoneNumber) &&
          this.isFilled(whatsappApiKey) &&
          this.isFilled(workspace.whatsappPhoneNumberId) &&
          this.isFilled(whatsappBusinessAccountId) &&
          this.isFilled(whatsappVerifyToken) &&
          this.isFilled(whatsappWebhookUrl),
        action: { path: "/settings", section: "whatsapp", focusKey: "whatsappAccess" },
      })
    }

    if (hasWidget) {
      this.addItem(items, {
        key: "widget-settings",
        label: "Widget Access Settings",
        completed:
          this.isFilled(workspace.widgetTitle) &&
          this.isFilled(workspace.widgetPrimaryColor) &&
          this.isFilled(workspace.widgetIcon) &&
          this.isFilled(workspace.widgetLanguage),
        action: { path: "/settings", section: "widget", focusKey: "widgetTitle" },
      })
    }

    if (sellsProductsAndServices) {
      this.addItem(items, {
        key: "services",
        label: "Services",
        completed: servicesCount > 0,
        action: { path: "/services" },
      })

      this.addItem(items, {
        key: "products",
        label: "Products",
        completed: productsCount > 0,
        action: { path: "/products" },
      })

      this.addItem(items, {
        key: "sales-agents",
        label: "Sales Agent",
        completed: salesCount > 0,
        action: { path: "/sales" },
      })

      this.addItem(items, {
        key: "offers",
        label: "Offers",
        completed: offersCount > 0,
        action: { path: "/offers" },
      })
    }

    const completedCount = items.filter((item) => item.completed).length
    const totalCount = items.length
    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    return {
      workspaceId: workspace.id,
      channelType,
      sellsProductsAndServices,
      completedCount,
      totalCount,
      percent,
      items,
    }
  }
}
