/**
 * Category Entity
 * Represents a product category in the domain
 */
export class Category {
  /**
   * Properties
   */
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  
  constructor(props: Partial<Category>) {
    Object.assign(this, props);
  }
  
  /**
   * Generate a URL-friendly slug from the category name
   */
  public generateSlug(): string {
    return this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  
  /**
   * Validate category
   */
  public validate(): boolean {
    // Basic validation
    if (!this.name || this.name.trim() === '') {
      return false;
    }
    
    if (!this.workspaceId) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if category is active
   */
  public isActiveCategory(): boolean {
    return this.isActive;
  }
} 