import { Router } from 'express';
import { UserService } from '../../../application/services/user.service';
import { UserUnsubscribeService } from '../../../services/user-unsubscribe.service';
import { prisma } from '@echatbot/database';
import logger from '../../../utils/logger';
import { UserController } from '../controllers/user.controller';
import { asyncHandler } from '../middlewares/async.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { uploadImage, handleUploadError } from '../middlewares/uploadMiddleware';

/**
 * Create user router
 */
export const createUserRouter = (): Router => {
  const router = Router();
  const userService = new UserService();
  const userController = new UserController(userService);
  const unsubscribeService = new UserUnsubscribeService(prisma);
  
  logger.info('Setting up user routes');

  router.use(authMiddleware);

  // Get current user
  router.get('/me', asyncHandler(userController.getCurrentUser));

  // Get current user's profile (alias for /me)
  router.get('/profile', asyncHandler(userController.getCurrentUser));

  // Update current user's profile (with optional logo upload)
  router.put(
    '/profile',
    uploadImage.single('logo'),
    handleUploadError,
    asyncHandler(userController.updateProfile)
  );

  // Change current user's password
  router.post('/change-password', asyncHandler(userController.changePassword));

  /**
   * @swagger
   * /users/me/delete:
   *   post:
   *     summary: Delete current user account (soft-delete)
   *     description: |
   *       Soft-deletes the current user's account with 90-day retention.
   *       - Owner: Deletes workspace + all customers + orders (cascade)
   *       - Agent: Deletes only user account (isolated)
   *     tags: [Users]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reason:
   *                 type: string
   *                 default: "User requested deletion"
   *     responses:
   *       200:
   *         description: Account soft-deleted successfully
   */
  router.post('/me/delete', asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const { reason = "User requested deletion" } = req.body;
    
    try {
      const result = await unsubscribeService.unsubscribeUser(userId, reason);
      logger.info(`User ${userId} deleted their account`, { cascadeType: result.cascadeType });
      return res.json(result);
    } catch (error) {
      logger.error(`Failed to delete user account ${userId}`, error);
      return res.status(500).json({ 
        error: "Failed to delete account",
        message: (error as Error).message 
      });
    }
  }));

  // Get all users
  router.get('/', asyncHandler(userController.getAllUsers));

  // Get a specific user
  router.get('/:id', asyncHandler(userController.getUserById));

  // Create a new user (admin only)
  router.post('/', asyncHandler(userController.createUser));

  // Update a user
  router.put('/:id', asyncHandler(userController.updateUser));

  // Delete a user (admin only)
  router.delete('/:id', asyncHandler(userController.deleteUser));

  logger.info('User routes setup complete');
  return router;
}; 