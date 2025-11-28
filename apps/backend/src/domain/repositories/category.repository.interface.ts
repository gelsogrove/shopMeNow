import { Category } from "../entities/category.entity";

/**
 * Interface for Category Repository
 * Defines all data operations for Category entity
 */
export interface ICategoryRepository {
  /**
   * Find all categories in a workspace
   */
  findAll(workspaceId: string): Promise<Category[]>;
  
  /**
   * Find a single category by ID and workspace
   */
  findById(id: string, workspaceId: string): Promise<Category | null>;
  
  /**
   * Find a category by slug within a workspace
   */
  findBySlug(slug: string, workspaceId: string): Promise<Category | null>;
  
  /**
   * Create a new category
   */
  create(data: Partial<Category>): Promise<Category>;
  
  /**
   * Update an existing category
   */
  update(id: string, workspaceId: string, data: Partial<Category>): Promise<Category | null>;
  
  /**
   * Delete a category
   */
  delete(id: string, workspaceId: string): Promise<boolean>;
  
  /**
   * Check if a category has associated products
   */
  hasProducts(id: string, workspaceId: string): Promise<boolean>;
} 