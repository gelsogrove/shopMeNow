/**
 * DATABASE BACKUP/RESTORE ROUTES
 *
 * Workspace-specific database operations
 * CRITICAL: All operations MUST be workspace-isolated
 *
 * Security:
 * - Admin-only access
 * - Session validation required
 * - Workspace ID validation required
 * - Prevents cross-workspace contamination
 */

import { execSync } from "child_process"
import { Request, Response, Router } from "express"
import fs from "fs"
import path from "path"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { validateWorkspaceOperation } from "../../middlewares/workspace-validation.middleware"
import logger from "../../utils/logger"

const router = Router()

/**
 * 📦 EXPORT DATABASE (WORKSPACE-SPECIFIC)
 *
 * POST /api/admin/workspaces/:workspaceId/database/export
 *
 * Security: Admin + Workspace validation
 * Creates timestamped backup in prisma/backups/{workspaceId}/
 */
router.post(
  "/workspaces/:workspaceId/database/export",
  authMiddleware,
  validateWorkspaceOperation,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user
      const workspaceId = req.params.workspaceId

      // Check if user is admin
      if (user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          error: "Only admins can export database",
        })
      }

      logger.info(`📦 Starting database export for workspace: ${workspaceId}`)

      // Execute workspace-specific export script
      const scriptPath = path.resolve(
        __dirname,
        "../../../scripts/export-workspace-backup.ts"
      )
      const command = `npx ts-node "${scriptPath}" ${workspaceId}`

      logger.info(`🔧 Executing: ${command}`)
      const output = execSync(command, {
        encoding: "utf-8",
        cwd: path.resolve(__dirname, "../../.."),
      })

      logger.info(`✅ Database export completed for workspace: ${workspaceId}`)
      logger.info(`Output: ${output}`)

      res.json({
        success: true,
        message: "Database exported successfully",
        workspaceId,
        timestamp: new Date().toISOString(),
        output: output.trim(),
      })
    } catch (error) {
      logger.error("❌ Database export failed:", error)
      res.status(500).json({
        error: "Database export failed",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
)

/**
 * 📥 IMPORT DATABASE (WORKSPACE-SPECIFIC)
 *
 * POST /api/admin/workspaces/:workspaceId/database/import
 *
 * Security: Admin + Session + Workspace validation
 * Restores latest backup from prisma/backups/{workspaceId}/latest/
 *
 * ⚠️ CRITICAL: Validates backup workspaceId matches request
 */
router.post(
  "/workspaces/:workspaceId/database/import",
  authMiddleware,
  validateWorkspaceOperation,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user
      const workspaceId = req.params.workspaceId

      // Check if user is admin
      if (user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          error: "Only admins can import database",
        })
      }

      logger.info(`📥 Starting database import for workspace: ${workspaceId}`)

      // Verify backup exists
      const backupDir = path.resolve(
        __dirname,
        `../../../prisma/backups/${workspaceId}/latest`
      )
      if (!fs.existsSync(backupDir)) {
        logger.error(`❌ No backup found for workspace: ${workspaceId}`)
        return res.status(404).json({
          error: "No backup found",
          message: `No backup directory found for workspace ${workspaceId}`,
        })
      }

      // Execute workspace-specific restore script
      const scriptPath = path.resolve(
        __dirname,
        "../../../scripts/restore-workspace-backup.ts"
      )
      const command = `npx ts-node "${scriptPath}" ${workspaceId}`

      logger.info(`🔧 Executing: ${command}`)
      const output = execSync(command, {
        encoding: "utf-8",
        cwd: path.resolve(__dirname, "../../.."),
      })

      logger.info(`✅ Database import completed for workspace: ${workspaceId}`)
      logger.info(`Output: ${output}`)

      res.json({
        success: true,
        message: "Database imported successfully",
        workspaceId,
        timestamp: new Date().toISOString(),
        output: output.trim(),
      })
    } catch (error) {
      logger.error("❌ Database import failed:", error)
      res.status(500).json({
        error: "Database import failed",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
)

export default router
