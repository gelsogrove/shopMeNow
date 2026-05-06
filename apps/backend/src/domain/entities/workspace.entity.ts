import { Entity } from "./entity"

export interface WorkspaceProps {
  id: string
  name: string
  slug: string
  whatsappPhoneNumber?: string | null
  whatsappApiKey?: string | null
  whatsappApiToken?: string | null
  whatsappAppName?: string | null
  whatsappAppSecret?: string | null
  whatsappPhoneNumberId?: string | null
  whatsappVerifyToken?: string | null
  whatsappWebhookToken?: string | null
  whatsappWebhookUrl?: string | null
  whatsappBusinessAccountId?: string | null
  // 🆕 Multi-Provider WhatsApp Support
  whatsappProvider?: string | null // "meta" | "ultramsg"
  metaPhoneNumberId?: string | null
  metaAccessToken?: string | null
  webhookVerifyToken?: string | null
  ultraMsgInstanceId?: string | null
  ultraMsgToken?: string | null
  ultraMsgApiUrl?: string | null
  // 🆕 WasenderAPI fields
  wasenderSessionId?: string | null
  wasenderApiKey?: string | null
  wasenderSessionStatus?: string | null
  wasenderPhoneNumber?: string | null
  wasenderQrString?: string | null
  wasenderQrGeneratedAt?: Date | null
  wasenderIsActive?: boolean | null
  notificationEmail?: string | null
  webhookUrl?: string | null
  webhookTimeout?: number | null
  language: string
  defaultLanguage?: string | null // 🌍 ISO-2 language code for customer-facing default language
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date | null
  currency: string
  channelStatus: boolean
  description?: string | null
  messageLimit: number
  blocklist?: string | null
  url?: string | null
  websiteUrl?: string | null
  assistantPhone?: string | null
  welcomeMessage?: any
  enableWelcomeMessage?: boolean // E0a
  sessionResetTimeout?: number // E0b
  wipMessage?: any
  afterRegistrationMessages?: any
  debugMode: boolean
  adminEmail?: string | null
  planType?: string | null
  trialEndsAt?: Date | null
  allowedExternalLinks?: string[]
  // 🆕 Channel Configuration (Feature 199)
  channelType?: "WHATSAPP" | "WIDGET" | null
  enableWhatsapp?: boolean
  enableWidget?: boolean
  channelMode?: import("@echatbot/database").ChannelMode
  hasSalesAgents?: boolean
  hasHumanSupport?: boolean
  hasProductCatalog?: boolean
  hasCart?: boolean
  hasOrderTracking?: boolean
  needRegistration?: boolean
  humanSupportInstructions?: string | null
  operatorContactMethod?: string | null
  operatorEmail?: string | null
  operatorWhatsappNumber?: string | null
  toneOfVoice?: string | null
  botIdentityResponse?: string | null
  // 🆕 Prompt Builder fields (Dynamic Prompt System)
  address?: string | null
  customAiRules?: string | null
  customChatbotId?: string | null  // Custom chatbot module for FLOW workspaces (e.g. "ecolaundry")
  registrationPage?: string | null
  requireManualApproval?: boolean
  // 🆕 Chatbot Personalization
  chatbotName?: string | null
  businessType?: string | null
  // 🆕 Logo
  logoUrl?: string | null
  logoKey?: string | null // 💾 Storage key for cleanup
  // 🆕 Widget Settings
  widgetLogoUrl?: string | null
  widgetLogoKey?: string | null
  widgetTitle?: string | null
  widgetLanguage?: string | null
  widgetPrimaryColor?: string | null
  widgetIcon?: string | null
  widgetUseChannelLogo?: boolean | null
  widgetAutoSuggestionsEnabled?: boolean | null
  widgetQuickReplies?: string[] | null
  widgetSuggestionsModel?: string | null
  // 🆕 Translation Settings
  translateProductNames?: boolean
  translateCategoryNames?: boolean
  translateServiceNames?: boolean
  catalogBaseLanguage?: string
  // 📅 Calendar & Appointment Settings
  enableCalendarBooking?: boolean
  timezone?: string | null
  appointmentReminder24hEnabled?: boolean
  appointmentReminder24hMessage?: string | null
  appointmentReminder1hEnabled?: boolean
  appointmentReminder1hMessage?: string | null
  appointmentReminder30mEnabled?: boolean
  appointmentReminder30mMessage?: string | null
  appointmentReminderHours?: number[]
  appointmentReminderChannel?: string
  minBookingBufferHours?: number | null
}

export class Workspace extends Entity<WorkspaceProps> {
  constructor(props: WorkspaceProps) {
    super(props)
  }

  static create(props: WorkspaceProps): Workspace {
    return new Workspace(props)
  }

  get name(): string {
    return this.props.name
  }

  get description(): string | null | undefined {
    return this.props.description
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  get deletedAt(): Date | null | undefined {
    return this.props.deletedAt
  }

  get id(): string {
    return this.props.id
  }

  get slug(): string {
    return this.props.slug
  }

  get whatsappPhoneNumber(): string | null | undefined {
    return this.props.whatsappPhoneNumber
  }

  get whatsappApiKey(): string | null | undefined {
    return this.props.whatsappApiKey
  }

  get whatsappApiToken(): string | null | undefined {
    return this.props.whatsappApiToken
  }

  get whatsappAppName(): string | null | undefined {
    return this.props.whatsappAppName
  }

  get whatsappAppSecret(): string | null | undefined {
    return this.props.whatsappAppSecret
  }

  get whatsappPhoneNumberId(): string | null | undefined {
    return this.props.whatsappPhoneNumberId
  }

  get whatsappVerifyToken(): string | null | undefined {
    return this.props.whatsappVerifyToken
  }

  get whatsappWebhookToken(): string | null | undefined {
    return this.props.whatsappWebhookToken
  }

  get whatsappWebhookUrl(): string | null | undefined {
    return this.props.whatsappWebhookUrl
  }

  get whatsappBusinessAccountId(): string | null | undefined {
    return this.props.whatsappBusinessAccountId
  }

  get notificationEmail(): string | null | undefined {
    return this.props.notificationEmail
  }

  get webhookUrl(): string | null | undefined {
    return this.props.webhookUrl
  }

  get webhookTimeout(): number | null | undefined {
    return this.props.webhookTimeout
  }

  get whatsappProvider(): string | null | undefined {
    return this.props.whatsappProvider
  }

  get metaPhoneNumberId(): string | null | undefined {
    return this.props.metaPhoneNumberId
  }

  get metaAccessToken(): string | null | undefined {
    return this.props.metaAccessToken
  }

  get ultraMsgInstanceId(): string | null | undefined {
    return this.props.ultraMsgInstanceId
  }

  get ultraMsgToken(): string | null | undefined {
    return this.props.ultraMsgToken
  }

  get ultraMsgApiUrl(): string | null | undefined {
    return this.props.ultraMsgApiUrl
  }

  get wasenderSessionId(): string | null | undefined {
    return this.props.wasenderSessionId
  }

  get wasenderApiKey(): string | null | undefined {
    return this.props.wasenderApiKey
  }

  get wasenderSessionStatus(): string | null | undefined {
    return this.props.wasenderSessionStatus
  }

  get wasenderPhoneNumber(): string | null | undefined {
    return this.props.wasenderPhoneNumber
  }

  get wasenderQrString(): string | null | undefined {
    return this.props.wasenderQrString
  }

  get wasenderQrGeneratedAt(): Date | null | undefined {
    return this.props.wasenderQrGeneratedAt
  }

  get wasenderIsActive(): boolean | null | undefined {
    return this.props.wasenderIsActive
  }

  get webhookVerifyToken(): string | null | undefined {
    return this.props.webhookVerifyToken
  }

  get language(): string {
    return this.props.language
  }

  get defaultLanguage(): string | null | undefined {
    return this.props.defaultLanguage
  }

  get currency(): string {
    return this.props.currency
  }

  get channelStatus(): boolean {
    return this.props.channelStatus
  }

  get messageLimit(): number {
    return this.props.messageLimit
  }

  get blocklist(): string | null | undefined {
    return this.props.blocklist
  }

  get url(): string | null | undefined {
    return this.props.url
  }

  get websiteUrl(): string | null | undefined {
    return this.props.websiteUrl
  }

  get welcomeMessage(): any {
    return this.props.welcomeMessage
  }

  get enableWelcomeMessage(): boolean | undefined {
    return this.props.enableWelcomeMessage
  }

  get sessionResetTimeout(): number | undefined {
    return this.props.sessionResetTimeout
  }

  get wipMessage(): any {
    return this.props.wipMessage
  }

  get afterRegistrationMessages(): any {
    return this.props.afterRegistrationMessages
  }

  get debugMode(): boolean {
    return this.props.debugMode
  }

  get adminEmail(): string | null | undefined {
    return this.props.adminEmail
  }

  get planType(): string | null | undefined {
    return this.props.planType
  }

  get trialEndsAt(): Date | null | undefined {
    return this.props.trialEndsAt
  }

  get allowedExternalLinks(): string[] | undefined {
    return this.props.allowedExternalLinks
  }

  // 🆕 Channel Configuration getters (Feature 199)
  get channelType(): "WHATSAPP" | "WIDGET" | null | undefined {
    return this.props.channelType
  }

  get enableWhatsapp(): boolean {
    return this.props.enableWhatsapp ?? true
  }

  get enableWidget(): boolean {
    return this.props.enableWidget ?? false
  }

  get channelMode(): import("@echatbot/database").ChannelMode {
    return this.props.channelMode ?? "ECOMMERCE"
  }

  get hasSalesAgents(): boolean {
    return this.props.hasSalesAgents ?? false
  }

  get hasHumanSupport(): boolean {
    return this.props.hasHumanSupport ?? true
  }

  get hasProductCatalog(): boolean {
    return this.props.hasProductCatalog ?? true
  }

  get hasCart(): boolean {
    return this.props.hasCart ?? true
  }

  get hasOrderTracking(): boolean {
    return this.props.hasOrderTracking ?? true
  }

  get needRegistration(): boolean {
    return this.props.needRegistration ?? true
  }

  get humanSupportInstructions(): string | null | undefined {
    return this.props.humanSupportInstructions
  }

  get operatorContactMethod(): string | null | undefined {
    return this.props.operatorContactMethod
  }

  get operatorEmail(): string | null | undefined {
    return this.props.operatorEmail
  }

  get operatorWhatsappNumber(): string | null | undefined {
    return this.props.operatorWhatsappNumber
  }

  get toneOfVoice(): string | null | undefined {
    return this.props.toneOfVoice
  }

  get botIdentityResponse(): string | null | undefined {
    return this.props.botIdentityResponse
  }

  get address(): string | null | undefined {
    return this.props.address
  }

  get customAiRules(): string | null | undefined {
    return this.props.customAiRules
  }

  get customChatbotId(): string | null | undefined {
    return this.props.customChatbotId
  }

  get registrationPage(): string | null | undefined {
    return this.props.registrationPage
  }

  get requireManualApproval(): boolean | undefined {
    return this.props.requireManualApproval
  }

  get chatbotName(): string | null | undefined {
    return this.props.chatbotName
  }

  get businessType(): string | null | undefined {
    return this.props.businessType
  }

  get logoUrl(): string | null | undefined {
    return this.props.logoUrl
  }

  get widgetLogoUrl(): string | null | undefined {
    return this.props.widgetLogoUrl
  }

  get widgetLogoKey(): string | null | undefined {
    return this.props.widgetLogoKey
  }

  get widgetTitle(): string | null | undefined {
    return this.props.widgetTitle
  }

  get widgetLanguage(): string | null | undefined {
    return this.props.widgetLanguage
  }

  get widgetPrimaryColor(): string | null | undefined {
    return this.props.widgetPrimaryColor
  }

  get widgetIcon(): string | null | undefined {
    return this.props.widgetIcon
  }

  get widgetUseChannelLogo(): boolean | null | undefined {
    return this.props.widgetUseChannelLogo
  }

  get widgetAutoSuggestionsEnabled(): boolean | null | undefined {
    return this.props.widgetAutoSuggestionsEnabled
  }

  get widgetQuickReplies(): string[] | null | undefined {
    return this.props.widgetQuickReplies
  }

  get widgetSuggestionsModel(): string | null | undefined {
    return this.props.widgetSuggestionsModel
  }

  // 🆕 Translation Settings getters
  get translateProductNames(): boolean {
    return this.props.translateProductNames ?? false
  }

  get translateCategoryNames(): boolean {
    return this.props.translateCategoryNames ?? false
  }

  get translateServiceNames(): boolean {
    return this.props.translateServiceNames ?? true
  }

  get catalogBaseLanguage(): string {
    return this.props.catalogBaseLanguage ?? "it"
  }

  // 📅 Calendar & Appointment Settings getters
  get enableCalendarBooking(): boolean {
    return this.props.enableCalendarBooking ?? false
  }

  get timezone(): string | null | undefined {
    return this.props.timezone
  }

  get appointmentReminder24hEnabled(): boolean {
    return this.props.appointmentReminder24hEnabled ?? true
  }
  get appointmentReminder24hMessage(): string | null | undefined {
    return this.props.appointmentReminder24hMessage
  }
  get appointmentReminder1hEnabled(): boolean {
    return this.props.appointmentReminder1hEnabled ?? true
  }
  get appointmentReminder1hMessage(): string | null | undefined {
    return this.props.appointmentReminder1hMessage
  }
  get appointmentReminder30mEnabled(): boolean {
    return this.props.appointmentReminder30mEnabled ?? false
  }
  get appointmentReminder30mMessage(): string | null | undefined {
    return this.props.appointmentReminder30mMessage
  }

  get appointmentReminderHours(): number[] {
    return this.props.appointmentReminderHours ?? [24, 1]
  }

  get appointmentReminderChannel(): string {
    return this.props.appointmentReminderChannel ?? "whatsapp"
  }

  get minBookingBufferHours(): number {
    return this.props.minBookingBufferHours ?? 12
  }

  // Business methods
  softDelete(): void {
    this.props.deletedAt = new Date()
    this.props.updatedAt = new Date()
  }

  restore(): void {
    this.props.deletedAt = null
    this.props.updatedAt = new Date()
  }

  updateName(name: string): void {
    this.props.name = name
    this.props.updatedAt = new Date()
  }

  updateDescription(description: string | null): void {
    this.props.description = description
    this.props.updatedAt = new Date()
  }
}
