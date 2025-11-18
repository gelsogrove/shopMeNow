import { Router } from 'express';
import { UserService } from '../../../application/services/user.service';
import logger from '../../../utils/logger';
import { UserController } from '../controllers/user.controller';
import { asyncHandler } from '../middlewares/async.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';

/**
 * Create user router
 */
export const createUserRouter = (): Router => {
  const router = Router();
  const userService = new UserService();
  const userController = new UserController(userService);
  
  logger.info('Setting up user routes');

  router.use(authMiddleware);

  // Get current user
  router.get('/me', asyncHandler(userController.getCurrentUser));

  // Get current user's profile (alias for /me)
  router.get('/profile', asyncHandler(userController.getCurrentUser));

  // Update current user's profile
  router.put('/profile', asyncHandler(userController.updateProfile));

  // Change current user's password
  router.post('/change-password', asyncHandler(userController.changePassword));

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