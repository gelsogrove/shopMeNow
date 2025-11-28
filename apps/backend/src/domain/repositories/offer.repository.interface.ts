/**
 * Interface for Offer Repository
 * Defines all data operations for Offer entity
 */
export interface IOfferRepository {
  /**
   * Find all offers in a workspace
   */
  findAll(workspaceId: string): Promise<any[]>;
  
  /**
   * Find active offers in a workspace, optionally filtered by category
   */
  findActive(workspaceId: string, categoryId?: string): Promise<any[]>;
  
  /**
   * Get active offers in a workspace, optionally filtered by category
   * This is an alias for findActive for backward compatibility
   */
  getActiveOffers(workspaceId: string, categoryId?: string): Promise<any[]>;
  
  /**
   * Find a single offer by ID and workspace
   */
  findById(id: string, workspaceId: string): Promise<any | null>;
  
  /**
   * Create a new offer
   */
  create(data: any): Promise<any>;
  
  /**
   * Update an existing offer
   */
  update(id: string, data: any): Promise<any>;
  
  /**
   * Delete an offer
   */
  delete(id: string): Promise<boolean>;
} 