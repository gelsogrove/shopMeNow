import { v4 as uuidv4 } from "uuid"

/**
 * InvoiceAddress interface
 * Defines structure for customer invoice address
 */
export interface InvoiceAddress {
  firstName?: string
  lastName?: string
  company?: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
  vatNumber?: string
  phone?: string
}

/**
 * CustomerProps interface
 * Defines properties for Customer entity
 */
export interface CustomerProps {
  id?: string
  name: string
  email: string
  phone?: string
  address?: string
  company?: string
  discount?: number
  language?: string
  currency?: string
  notes?: string
  serviceIds?: string[]
  isBlacklisted?: boolean
  isActive?: boolean
  workspaceId: string
  last_privacy_version_accepted?: string
  privacy_accepted_at?: Date
  push_notifications_consent?: boolean
  push_notifications_consent_at?: Date
  createdAt?: Date
  updatedAt?: Date
  activeChatbot?: boolean
  invoiceAddress?: InvoiceAddress
  salesId?: string
  feedbacks?: any[]
}

/**
 * Customer Entity
 * Represents a customer in the domain
 */
export class Customer {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly phone?: string
  readonly address?: string
  readonly company?: string
  readonly discount: number
  readonly language: string
  readonly currency: string
  readonly notes?: string
  readonly serviceIds: string[]
  readonly isBlacklisted: boolean
  readonly isActive: boolean
  readonly workspaceId: string
  readonly last_privacy_version_accepted?: string
  readonly privacy_accepted_at?: Date
  readonly push_notifications_consent: boolean
  readonly push_notifications_consent_at?: Date
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly activeChatbot: boolean
  readonly invoiceAddress?: InvoiceAddress
  readonly salesId?: string
  readonly feedbacks?: any[]

  constructor(props: CustomerProps) {
    this.id = props.id || uuidv4()
    this.name = props.name
    this.email = props.email
    this.phone = props.phone
    this.address = props.address
    this.company = props.company
    this.discount = props.discount || 0
    this.language = props.language || "ENG"
    this.currency = props.currency || "USD"
    this.notes = props.notes
    this.serviceIds = props.serviceIds || []
    this.isBlacklisted = props.isBlacklisted || false
    this.isActive = props.isActive !== undefined ? props.isActive : true
    this.workspaceId = props.workspaceId
    this.last_privacy_version_accepted = props.last_privacy_version_accepted
    this.privacy_accepted_at = props.privacy_accepted_at
    this.push_notifications_consent = props.push_notifications_consent || false
    this.push_notifications_consent_at = props.push_notifications_consent_at
    this.createdAt = props.createdAt || new Date()
    this.updatedAt = props.updatedAt || new Date()
    this.activeChatbot =
      props.activeChatbot !== undefined ? props.activeChatbot : true
    this.invoiceAddress = props.invoiceAddress
    this.salesId = props.salesId
    this.feedbacks = props.feedbacks || []
  }

  /**
   * Validate customer data
   */
  public validate(): boolean {
    if (!this.name || this.name.trim() === "") {
      return false
    }

    if (!this.email || !this.isValidEmail(this.email)) {
      return false
    }

    if (!this.workspaceId) {
      return false
    }

    return true
  }

  /**
   * Check if customer is active
   */
  public isActiveCustomer(): boolean {
    return this.isActive
  }

  /**
   * Check if customer has active chatbot
   */
  public hasChatbotEnabled(): boolean {
    return this.activeChatbot
  }

  /**
   * Check if customer has accepted privacy policy
   */
  public hasAcceptedPrivacy(): boolean {
    return !!this.last_privacy_version_accepted && !!this.privacy_accepted_at
  }

  /**
   * Check if email is valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}
