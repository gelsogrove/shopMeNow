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
  challengeStatus: boolean
  description?: string | null
  messageLimit: number
  blocklist?: string | null
  url?: string | null
  assistantPhone?: string | null
  businessType: string
  welcomeMessages?: any
  wipMessages?: any
  afterRegistrationMessages?: any
  debugMode: boolean
  adminEmail?: string | null
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

  get challengeStatus(): boolean {
    return this.props.challengeStatus
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

  get businessType(): string {
    return this.props.businessType
  }

  get welcomeMessages(): any {
    return this.props.welcomeMessages
  }

  get wipMessages(): any {
    return this.props.wipMessages
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
