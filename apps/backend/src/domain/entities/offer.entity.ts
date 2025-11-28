/**
 * Offer Entity
 * Represents an offer in the domain
 */
export class Offer {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string;
  discountPercent: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  categoryId?: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  categoryName?: string;
  categoryIds?: string[];

  constructor(props: Partial<Offer>) {
    Object.assign(this, props);
  }

  /**
   * Check if the offer is currently active
   */
  public isCurrentlyActive(): boolean {
    const now = new Date();
    return (
      this.isActive &&
      this.startDate <= now &&
      this.endDate >= now
    );
  }

  /**
   * Calculate discounted price
   */
  public calculateDiscountedPrice(originalPrice: number): number {
    if (!this.isCurrentlyActive()) {
      return originalPrice;
    }
    
    const discount = originalPrice * (this.discountPercent / 100);
    return originalPrice - discount;
  }

  /**
   * Validate offer
   */
  public validate(): boolean {
    // Basic validation
    if (!this.name || this.name.trim() === '') {
      return false;
    }
    
    if (this.discountPercent < 0 || this.discountPercent > 100) {
      return false;
    }
    
    if (this.startDate > this.endDate) {
      return false;
    }
    
    return true;
  }

  /**
   * Get the status of the offer
   */
  getStatus(): 'active' | 'inactive' | 'scheduled' | 'expired' {
    const now = new Date();
    
    if (!this.isActive) {
      return 'inactive';
    }
    
    if (this.startDate <= now && this.endDate >= now) {
      return 'active';
    }
    
    if (this.startDate > now) {
      return 'scheduled';
    }
    
    return 'expired';
  }
} 