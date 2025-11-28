import { Category } from "../../domain/entities/category.entity";
import { ICategoryRepository } from "../../domain/repositories/category.repository.interface";
import { CategoryRepository } from "../../repositories/category.repository";
import logger from "../../utils/logger";

/**
 * Service layer for Category
 * Handles business logic for categories
 */
export class CategoryService {
  private categoryRepository: ICategoryRepository;

  constructor() {
    this.categoryRepository = new CategoryRepository();
  }

  /**
   * Get all categories for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<Category[]> {
    try {
      return await this.categoryRepository.findAll(workspaceId);
    } catch (error) {
      logger.error("Error getting all categories:", error);
      throw error;
    }
  }

  /**
   * Get category by ID
   */
  async getById(id: string, workspaceId: string): Promise<Category | null> {
    try {
      return await this.categoryRepository.findById(id, workspaceId);
    } catch (error) {
      logger.error(`Error getting category ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new category
   */
  async create(data: Partial<Category>): Promise<Category> {
    try {
      // Validate required fields
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields");
      }
      
      // Create a category entity for validation and slug generation
      const categoryToCreate = new Category(data);
      categoryToCreate.slug = categoryToCreate.generateSlug();
      
      // Validate the category
      if (!categoryToCreate.validate()) {
        throw new Error("Invalid category data");
      }
      
      // Check if a category with the same slug already exists
      const existingCategory = await this.categoryRepository.findBySlug(
        categoryToCreate.slug, 
        categoryToCreate.workspaceId
      );
      
      if (existingCategory) {
        throw new Error("A category with this name already exists");
      }
      
      // Create the category
      return await this.categoryRepository.create(categoryToCreate);
    } catch (error) {
      logger.error("Error creating category:", error);
      throw error;
    }
  }

  /**
   * Update a category
   */
  async update(id: string, workspaceId: string, data: Partial<Category>): Promise<Category | null> {
    try {
      // Check if category exists
      const existingCategory = await this.categoryRepository.findById(id, workspaceId);
      if (!existingCategory) {
        throw new Error("Category not found");
      }
      
      // Create merged category for validation and slug generation
      const categoryToUpdate = new Category({
        ...existingCategory,
        ...data
      });
      
      // If name is changed, update the slug
      if (data.name && data.name !== existingCategory.name) {
        categoryToUpdate.slug = categoryToUpdate.generateSlug();
        
        // Check if a category with the new slug already exists (excluding the current one)
        const categoryWithSlug = await this.categoryRepository.findBySlug(categoryToUpdate.slug, workspaceId);
        if (categoryWithSlug && categoryWithSlug.id !== id) {
          throw new Error("A category with this name already exists");
        }
      }
      
      // Update the category
      return await this.categoryRepository.update(id, workspaceId, categoryToUpdate);
    } catch (error) {
      logger.error(`Error updating category ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a category
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      // Check if category exists
      const category = await this.categoryRepository.findById(id, workspaceId);
      if (!category) {
        throw new Error("Category not found");
      }
      
      // Check if category has products
      const hasProducts = await this.categoryRepository.hasProducts(id, workspaceId);
      if (hasProducts) {
        throw new Error("Cannot delete category that is used by products");
      }
      
      // Delete the category
      return await this.categoryRepository.delete(id, workspaceId);
    } catch (error) {
      logger.error(`Error deleting category ${id}:`, error);
      throw error;
    }
  }

  /**
   * Check if a category has products
   */
  async hasProducts(id: string, workspaceId: string): Promise<boolean> {
    try {
      return await this.categoryRepository.hasProducts(id, workspaceId);
    } catch (error) {
      logger.error(`Error checking if category ${id} has products:`, error);
      throw error;
    }
  }
} 