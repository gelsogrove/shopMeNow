import { Entity } from "./entity"

export interface WorkspaceProps {
  id: string
  name: string
  slug: string
  whatsappPhoneNumber?: string | null
  whatsappApiKey?: string | null
  whatsappApiToken?: string | null
  whatsappWebhookUrl?: string | null
  notificationEmail?: string | null
  webhookUrl?: string | null
  isActive: boolean
  language: string
  createdAt: Date
  updatedAt: Date
  isDelete: boolean
  currency: string
  channelStatus: boolean
  description?: string | null
  messageLimit: number
  blocklist?: string | null
  url?: string | null
  assistantPhone?: string | null
  welcomeMessage?: any
  wipMessage?: any
  afterRegistrationMessages?: any
  debugMode: boolean
  adminEmail?: string | null
  planType?: string | null
  trialEndsAt?: Date | null
  allowedExternalLinks?: string[]
  // 🆕 Channel Configuration (Feature 199)
  sellsProductsAndServices?: boolean
  hasSalesAgents?: boolean
  hasHumanSupport?: boolean
  humanSupportInstructions?: string | null
  frustrationEscalationInstructions?: string | null // 🆕 Feature 203: Custom escalation triggers
  operatorContactMethod?: string | null
  operatorWhatsappNumber?: string | null
  toneOfVoice?: string | null
  botIdentityResponse?: string | null
  // 🆕 Prompt Builder fields (Dynamic Prompt System)
  address?: string | null
  customAiRules?: string | null
  // 🆕 Logo
  logoUrl?: string | null
  logoKey?: string | null // 💾 S3 key for cleanup
  // 🆕 Translation Settings
  translateProductNames?: boolean
  translateCategoryNames?: boolean
  translateServiceNames?: boolean
  catalogBaseLanguage?: string
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

  get isActive(): boolean {
    return this.props.isActive
  }

  get isDelete(): boolean {
    return this.props.isDelete
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
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

  get whatsappWebhookUrl(): string | null | undefined {
    return this.props.whatsappWebhookUrl
  }

  get notificationEmail(): string | null | undefined {
    return this.props.notificationEmail
  }

  get webhookUrl(): string | null | undefined {
    return this.props.webhookUrl
  }

  get language(): string {
    return this.props.language
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

  get welcomeMessage(): any {
    return this.props.welcomeMessage
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
  get sellsProductsAndServices(): boolean {
    return this.props.sellsProductsAndServices ?? true
  }

  get hasSalesAgents(): boolean {
    return this.props.hasSalesAgents ?? false
  }

  get hasHumanSupport(): boolean {
    return this.props.hasHumanSupport ?? true
  }

  get humanSupportInstructions(): string | null | undefined {
    return this.props.humanSupportInstructions
  }

  get frustrationEscalationInstructions(): string | null | undefined {
    return this.props.frustrationEscalationInstructions
  }

  get operatorContactMethod(): string | null | undefined {
    return this.props.operatorContactMethod
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

  get logoUrl(): string | null | undefined {
    return this.props.logoUrl
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

  // Business methods
  activate(): void {
    this.props.isActive = true
    this.props.updatedAt = new Date()
  }

  deactivate(): void {
    this.props.isActive = false
    this.props.updatedAt = new Date()
  }

  softDelete(): void {
    this.props.isDelete = true
    this.props.isActive = false
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
