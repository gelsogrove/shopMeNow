import { Request, Response } from "express";
import { CategoryService } from "../../../application/services/category.service";
import logger from "../../../utils/logger";

/**
 * Gets the workspace ID from request parameters or query
 */
const getWorkspaceId = (req: Request): string | undefined => {
  return req.params.workspaceId || req.query.workspaceId as string;
};

/**
 * CategoryController class
 * Handles HTTP requests related to categories
 */
export class CategoryController {
  private categoryService: CategoryService;
  
  constructor() {
    this.categoryService = new CategoryService();
  }
  
  /**
   * Get all categories for a workspace
   */
  async getAllCategories(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = getWorkspaceId(req);
      
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }
      
      const categories = await this.categoryService.getAllForWorkspace(workspaceId);
      return res.json(categories);
    } catch (error) {
      logger.error("Error getting categories:", error);
      return res.status(500).json({ error: 'Failed to get categories' });
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const workspaceId = getWorkspaceId(req);
      
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }
      
      const category = await this.categoryService.getById(id, workspaceId);
      
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
      
      return res.json(category);
    } catch (error) {
      logger.error(`Error getting category ${req.params.id}:`, error);
      return res.status(500).json({ error: 'Failed to get category' });
    }
  }

  /**
   * Create a new category
   */
  async createCategory(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = getWorkspaceId(req);
      
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }
      
      const { name, description, isActive } = req.body;
      const categoryData = { 
        name, 
        description, 
        isActive: isActive !== undefined ? isActive : true,
        workspaceId 
      };
      
      const category = await this.categoryService.create(categoryData);
      return res.status(201).json(category);
    } catch (error) {
      logger.error("Error creating category:", error);
      
      if (error.message === 'A category with this name already exists') {
        return res.status(409).json({ error: error.message });
      }
      
      if (error.message === 'Missing required fields' || error.message === 'Invalid category data') {
        return res.status(400).json({ error: error.message });
      }
      
      return res.status(500).json({ error: 'Failed to create category' });
    }
  }

  /**
   * Update a category
   */
  async updateCategory(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const workspaceId = getWorkspaceId(req);
      
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }
      
      const { name, description, isActive } = req.body;
      
      // Validate required fields for update
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Category name is required' });
      }
      
      const category = await this.categoryService.update(id, workspaceId, {
        name,
        description,
        isActive
      });
      
      return res.json(category);
    } catch (error) {
      logger.error(`Error updating category ${req.params.id}:`, error);
      
      if (error.message === 'Category not found') {
        return res.status(404).json({ error: 'Category not found' });
      }
      
      if (error.message === 'A category with this name already exists') {
        return res.status(409).json({ error: error.message });
      }
      
      if (error.message === 'Missing required fields' || error.message === 'Invalid category data') {
        return res.status(400).json({ error: error.message });
      }
      
      return res.status(500).json({ error: 'Failed to update category' });
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const workspaceId = getWorkspaceId(req);
      
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }
      
      try {
        const result = await this.categoryService.delete(id, workspaceId);
        return res.status(204).send();
      } catch (error) {
        if (error.message === 'Category not found') {
          return res.status(404).json({ error: 'Category not found' });
        }
        
        if (error.message === 'Cannot delete category that is used by products') {
          return res.status(409).json({ error: error.message });
        }
        
        throw error;
      }
    } catch (error) {
      logger.error(`Error deleting category ${req.params.id}:`, error);
      return res.status(500).json({ error: 'Failed to delete category' });
    }
  }
  
  /**
   * Check if a category has products
   */
  async hasProducts(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const workspaceId = getWorkspaceId(req);
      
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }
      
      const hasProducts = await this.categoryService.hasProducts(id, workspaceId);
      return res.json({ hasProducts });
    } catch (error) {
      logger.error(`Error checking products for category ${req.params.id}:`, error);
      return res.status(500).json({ error: 'Failed to check category products' });
    }
  }
} 