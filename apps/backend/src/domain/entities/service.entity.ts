/**
 * Service Entity
 * Represents a service offered by a workspace in the domain
 */
import { getCurrencySymbol } from "../../utils/currency"

export class Service {
  /**
   * Properties
   */
  id: string
  name: string
  description?: string
  code: string
  price: number
  currency: string
  duration: number
  isActive: boolean
  workspaceId: string
  imageUrl: string[]
  createdAt: Date
  updatedAt: Date

  constructor(props: Partial<Service>) {
    Object.assign(this, props)
  }

  /**
   * Validate service
   */
  public validate(): boolean {
    // Basic validation
    if (!this.name || this.name.trim() === "") {
      return false
    }

    // Price is optional during creation (can be set to 0 or will be added during edit)
    if (this.price !== undefined && this.price !== null) {
      if (typeof this.price !== "number" || this.price < 0) {
        return false
      }
    } else {
      this.price = 0 // Default to 0 if not provided
    }

    // Description is required in the schema but might be missing in partial updates
    if (this.description === undefined || this.description === null) {
      this.description = "" // Provide default empty string
    }

    // Duration is optional with a default value of 60
    if (this.duration === undefined || this.duration === null) {
      this.duration = 60
    } else if (typeof this.duration !== "number" || this.duration < 0) {
      return false
    }

    if (!this.workspaceId) {
      return false
    }

    // Code is optional during creation (will be added during edit)
    if (
      this.code === undefined ||
      this.code === null ||
      this.code.trim() === ""
    ) {
      this.code = `SRV${Date.now().toString().slice(-6)}` // Generate temporary code
    }

    if (!this.currency) {
      this.currency = "EUR" // Default currency
    }

    return true
  }

  /**
   * Check if service is active
   */
  public isActiveService(): boolean {
    return this.isActive
  }

  /**
   * Format price with currency
   */
  public formattedPrice(): string {
    const currencySymbol = getCurrencySymbol(this.currency)
    return `${currencySymbol}${this.price.toFixed(2)}`
  }

  /**
   * Format duration in minutes and hours
   */
  public formattedDuration(): string {
    if (this.duration < 60) {
      return `${this.duration} min`
    }

    const hours = Math.floor(this.duration / 60)
    const minutes = this.duration % 60

    if (minutes === 0) {
      return `${hours}h`
    }

    return `${hours}h ${minutes}min`
  }
}
