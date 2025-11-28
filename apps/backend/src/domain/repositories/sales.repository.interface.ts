import { Sales } from "../entities/sales.entity"

/**
 * Interface for Sales Repository
 * Defines all data operations for Sales entity
 */
export interface ISalesRepository {
  /**
   * Find all sales in a workspace
   */
  findAll(workspaceId: string): Promise<Sales[]>

  /**
   * Find a single sales by ID and workspace
   */
  findById(id: string, workspaceId: string): Promise<Sales | null>

  /**
   * Find a sales by email within a workspace
   */
  findByEmail(email: string, workspaceId: string): Promise<Sales | null>

  /**
   * Create a new sales
   */
  create(data: Partial<Sales>): Promise<Sales>

  /**
   * Update an existing sales
   */
  update(
    id: string,
    workspaceId: string,
    data: Partial<Sales>
  ): Promise<Sales | null>

  /**
   * Delete a sales
   */
  delete(id: string, workspaceId: string): Promise<boolean>

  /**
   * Check if a sales has associated customers
   */
  hasCustomers(id: string, workspaceId: string): Promise<boolean>
}
