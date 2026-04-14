import { Router } from 'express';
import logger from '../../../utils/logger';
import { WorkspaceController } from '../controllers/workspace.controller';
import { asyncHandler } from '../middlewares/async.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../../../middlewares/workspace-role.middleware';
import { validateWorkspaceOperation } from '../../../middlewares/workspace-validation.middleware';
import { uploadImage, handleUploadError } from '../middlewares/uploadMiddleware';

export const workspaceRouter = (): Router => {
  const router = Router();
  const workspaceController = new WorkspaceController();

  logger.info('Setting up workspace routes');

  // Apply auth middleware to all routes
  router.use(authMiddleware);

  // Get badge stats for all user's workspaces (unread messages, pending orders, etc.)
  // MUST be before /:id to avoid matching "badge-stats" as an ID
  router.get('/badge-stats', asyncHandler(workspaceController.getWorkspaceBadgeStats));
  // Get workspace configuration checklist
  router.get('/:id/checklist', validateWorkspaceOperation, asyncHandler(workspaceController.getWorkspaceChecklist));

  // Get all workspaces
  router.get('/', asyncHandler(workspaceController.getAllWorkspaces));

  // Get a specific workspace
  router.get('/:id', asyncHandler(workspaceController.getWorkspaceById));

  // Create a new workspace (protection in controller - checks canUserCreateWorkspace)
  router.post('/', asyncHandler(workspaceController.createWorkspace));

  // Upload workspace logo - ONLY SUPER_ADMIN (Owner)
  router.post(
    '/:id/logo',
    validateWorkspaceOperation,
    requireSuperAdmin,
    uploadImage.single('logo'),
    handleUploadError,
    asyncHandler(workspaceController.uploadWorkspaceLogo)
  );

  // Update a workspace - ONLY SUPER_ADMIN (Owner)
  router.put('/:id', validateWorkspaceOperation, requireSuperAdmin, asyncHandler(workspaceController.updateWorkspace));
  router.patch('/:id', validateWorkspaceOperation, requireSuperAdmin, asyncHandler(workspaceController.updateWorkspace));

  // WhatsApp provider configuration - ONLY SUPER_ADMIN (Owner)
  router.get('/:id/whatsapp-config', validateWorkspaceOperation, asyncHandler(workspaceController.getWhatsAppConfig));
  router.post('/:id/whatsapp-config', validateWorkspaceOperation, requireSuperAdmin, asyncHandler(workspaceController.updateWhatsAppConfig));

  // Delete a workspace - ONLY SUPER_ADMIN (Owner) (additional protection in controller)
  router.delete('/:id', validateWorkspaceOperation, requireSuperAdmin, asyncHandler(workspaceController.deleteWorkspace));

  logger.info('Workspace routes setup complete');
  return router;
};

// Exporting for compatibility with existing code
export const workspaceRoutes = workspaceRouter();
