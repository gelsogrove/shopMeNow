/**
 * Environment Variable Routes
 *
 * Protected endpoints for secure credential management
 *
 * Middleware Stack:
 * 1. authMiddleware        - Verify JWT token
 * 2. sessionValidationMiddleware - Validate x-session-id
 * 3. validateWorkspaceOperation - Verify x-workspace-id matches param
 */

import { Router } from 'express'
import { PrismaClient } from '@echatbot/database'
import { WorkspaceEnvironmentVariableController } from '../controllers/workspace-environment-variable.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { sessionValidationMiddleware } from '../middlewares/session-validation.middleware'
import { validateWorkspaceId } from '../middlewares/workspace-validation.middleware'

export function createEnvironmentVariableRoutes(prisma: PrismaClient): Router {
  const router = Router()
  const controller = new WorkspaceEnvironmentVariableController(prisma)

  // Middleware stack for all routes
  const middlewares = [
    authMiddleware,
    sessionValidationMiddleware,
    validateWorkspaceId,
  ]

  /**
   * List all environment variables
   * GET /workspaces/:workspaceId/env-vars
   */
  router.get(
    '/workspaces/:workspaceId/env-vars',
    ...middlewares,
    controller.listVariables.bind(controller)
  )

  /**
   * Create new environment variable
   * POST /workspaces/:workspaceId/env-vars
   */
  router.post(
    '/workspaces/:workspaceId/env-vars',
    ...middlewares,
    controller.createVariable.bind(controller)
  )

  /**
   * Update environment variable (credential rotation)
   * PATCH /workspaces/:workspaceId/env-vars/:variableName
   */
  router.patch(
    '/workspaces/:workspaceId/env-vars/:variableName',
    ...middlewares,
    controller.updateVariable.bind(controller)
  )

  /**
   * Delete environment variable
   * DELETE /workspaces/:workspaceId/env-vars/:variableName
   */
  router.delete(
    '/workspaces/:workspaceId/env-vars/:variableName',
    ...middlewares,
    controller.deleteVariable.bind(controller)
  )

  return router
}
