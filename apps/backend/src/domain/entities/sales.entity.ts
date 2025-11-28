/**
 * Sales Entity
 * Represents a salesperson in the domain
 */
export class Sales {
  /**
   * Properties
   */
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  isActive: boolean
  workspaceId: string
  createdAt: Date
  updatedAt: Date

  constructor(props: Partial<Sales>) {
    Object.assign(this, props)
  }

  /**
   * Get full name
   */
  public getFullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  /**
   * Validate sales
   */
  public validate(): boolean {
    // Basic validation
    if (!this.firstName || this.firstName.trim() === "") {
      return false
    }

    if (!this.lastName || this.lastName.trim() === "") {
      return false
    }

    if (!this.email || this.email.trim() === "") {
      return false
    }

    if (!this.workspaceId) {
      return false
    }

    return true
  }

  /**
   * Check if sales is active
   */
  public isActiveSales(): boolean {
    return this.isActive
  }
}
