/**
 * Service Entity
 * Represents a service offered by a workspace in the domain
 */
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

    if (typeof this.price !== "number" || this.price < 0) {
      return false
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

    if (!this.code || this.code.trim() === "") {
      return false
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
    const currencySymbol =
      this.currency === "EUR"
        ? "€"
        : this.currency === "USD"
          ? "$"
          : this.currency
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
