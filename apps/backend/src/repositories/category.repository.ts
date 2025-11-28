import { Category } from "../domain/entities/category.entity";
import { ICategoryRepository } from "../domain/repositories/category.repository.interface";
import { prisma } from "../lib/prisma";
import logger from "../utils/logger";

/**
 * Implementation of Category Repository using Prisma
 */
export class CategoryRepository implements ICategoryRepository {
  /**
   * Find all categories in a workspace
   */
  async findAll(workspaceId: string): Promise<Category[]> {
    try {
      const categories = await prisma.categories.findMany({
        where: {
          workspaceId,
          isActive: true
        },
        orderBy: {
          name: 'asc'
        }
      });
      
      return categories ? categories.map(category => new Category(category)) : [];
    } catch (error) {
      logger.error("Error finding categories:", error);
      return [];
    }
  }
  
  /**
   * Find a single category by ID and workspace
   */
  async findById(id: string, workspaceId: string): Promise<Category | null> {
    try {
      const category = await prisma.categories.findFirst({
        where: {
          id,
          workspaceId
        }
      });
      
      return category ? new Category(category) : null;
    } catch (error) {
      logger.error(`Error finding category ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Find a category by slug within a workspace
   */
  async findBySlug(slug: string, workspaceId: string): Promise<Category | null> {
    try {
      const category = await prisma.categories.findFirst({
        where: {
          slug,
          workspaceId
        }
      });
      
      return category ? new Category(category) : null;
    } catch (error) {
      logger.error(`Error finding category by slug ${slug}:`, error);
      return null;
    }
  }
  
  /**
   * Create a new category
   */
  async create(data: Partial<Category>): Promise<Category> {
    try {
      const category = await prisma.categories.create({
        data: data as any
      });
      
      return new Category(category);
    } catch (error) {
      logger.error("Error creating category:", error);
      throw error;
    }
  }
  
  /**
   * Update an existing category
   */
  async update(id: string, workspaceId: string, data: Partial<Category>): Promise<Category | null> {
    try {
      await prisma.categories.updateMany({
        where: {
          id,
          workspaceId
        },
        data: data as any
      });
      
      // Get updated category
      return this.findById(id, workspaceId);
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
      const result = await prisma.categories.deleteMany({
        where: {
          id,
          workspaceId
        }
      });
      
      return result && result.count > 0;
    } catch (error) {
      logger.error(`Error deleting category ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Check if a category has associated products
   */
  async hasProducts(id: string, workspaceId: string): Promise<boolean> {
    try {
      const products = await prisma.products.findMany({
        where: {
          categoryId: id,
          workspaceId
        },
        take: 1
      });
      
      return products.length > 0;
    } catch (error) {
      logger.error(`Error checking products for category ${id}:`, error);
      return false;
    }
  }
} 