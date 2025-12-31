/**
 * Files Routes - Serve private files with authentication
 * 
 * SECURITY (TASK06):
 * - All routes require JWT authentication + workspace validation
 * - Private files served via /api/v1/files/private/:category/:folder/:filename
 * - Public files served directly via Express static at /uploads/public/*
 */

import { Router } from 'express'
import { filesController } from '../controllers/files.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { workspaceValidationMiddleware } from '../middlewares/workspace-validation.middleware'

const router = Router()

/**
 * @swagger
 * /api/v1/files/private/{category}/{folder}/{filename}:
 *   get:
 *     summary: Serve private file (authenticated)
 *     description: |
 *       Serves private files from /uploads/private/* with authentication.
 *       Requires JWT token and workspace validation.
 *       Public files are served directly via /uploads/public/* (no auth required).
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-workspace-id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [private]
 *         description: Storage category (must be 'private')
 *       - in: path
 *         name: folder
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder name (e.g., documents, invoices)
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: File name
 *     responses:
 *       200:
 *         description: File content
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       403:
 *         description: Forbidden - Invalid workspace or attempting to access public file via authenticated endpoint
 *       404:
 *         description: File not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/private/:category/:folder/:filename',
  authMiddleware,
  workspaceValidationMiddleware,
  filesController.servePrivateFile.bind(filesController)
)

/**
 * @swagger
 * /api/v1/files/private/{category}/{folder}/{filename}:
 *   head:
 *     summary: Check if private file exists (authenticated)
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-workspace-id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [private]
 *       - in: path
 *         name: folder
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File exists
 *       404:
 *         description: File not found
 */
router.head(
  '/private/:category/:folder/:filename',
  authMiddleware,
  workspaceValidationMiddleware,
  filesController.checkPrivateFile.bind(filesController)
)

export default router
