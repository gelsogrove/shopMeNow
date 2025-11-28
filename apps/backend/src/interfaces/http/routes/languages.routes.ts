import { Router } from 'express';
import logger from '../../../utils/logger';
import { LanguageController } from '../controllers/language.controller';
import { asyncHandler } from '../middlewares/async.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';

/**
 * @swagger
 * components:
 *   schemas:
 *     Language:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the language
 *         code:
 *           type: string
 *           description: Language code (e.g., 'en', 'it')
 *         name:
 *           type: string
 *           description: Full name of the language
 *         isDefault:
 *           type: boolean
 *           description: Whether this is the default language
 */

export const createLanguagesRouter = (): Router => {
  const router = Router();
  const languageController = new LanguageController();
  
  logger.info('Setting up languages routes');

  /**
   * @swagger
   * /api/languages:
   *   get:
   *     summary: Get all active languages for a workspace
   *     tags: [Languages]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: header
   *         name: x-workspace-id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of languages
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 languages:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Language'
   *       400:
   *         description: Bad request, workspace ID is required
   *       500:
   *         description: Server error
   */
  router.get('/', authMiddleware, asyncHandler(languageController.getAllLanguages));

  logger.info('Languages routes setup complete');
  return router;
}; 