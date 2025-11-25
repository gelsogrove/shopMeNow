import { Router } from 'express';
import logger from '../../../utils/logger';
import { WorkspaceController } from '../controllers/workspace.controller';
import { asyncHandler } from '../middlewares/async.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../../../middlewares/workspace-role.middleware';
import { validateWorkspaceOperation } from '../../../middlewares/workspace-validation.middleware';

export const workspaceRouter = (): Router => {
  const router = Router();
  const workspaceController = new WorkspaceController();
  
  logger.info('Setting up workspace routes');

  // Apply auth middleware to all routes
  router.use(authMiddleware);
  
  // Get all workspaces
  router.get('/', asyncHandler(workspaceController.getAllWorkspaces));
  
  // Get a specific workspace
  router.get('/:id', asyncHandler(workspaceController.getWorkspaceById));
  
  // Create a new workspace (protection in controller - checks canUserCreateWorkspace)
  router.post('/', asyncHandler(workspaceController.createWorkspace));
  
  // Update a workspace - ONLY SUPER_ADMIN (Owner)
  router.put('/:id', validateWorkspaceOperation, requireSuperAdmin, asyncHandler(workspaceController.updateWorkspace));
  
  // Delete a workspace - ONLY SUPER_ADMIN (Owner) (additional protection in controller)
  router.delete('/:id', validateWorkspaceOperation, requireSuperAdmin, asyncHandler(workspaceController.deleteWorkspace));
  
  logger.info('Workspace routes setup complete');
  return router;
};

// Exporting for compatibility with existing code
export const workspaceRoutes = workspaceRouter();
