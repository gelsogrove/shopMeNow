/**
 * Files Controller - Serve private files with authentication
 * 
 * SECURITY (TASK06):
 * - Private files in /uploads/private/* require JWT authentication
 * - Workspace isolation enforced (users can only access files from their workspace)
 * - Public files in /uploads/public/* served directly by Express static middleware
 */

import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import logger from '../../../utils/logger'

export class FilesController {
  /**
   * Serve private file with authentication
   * GET /api/v1/files/private/:category/:folder/:filename
   * 
   * @example
   * GET /api/v1/files/private/documents/invoices/INV-001.pdf
   * Authorization: Bearer <jwt_token>
   * x-workspace-id: <workspace_id>
   */
  async servePrivateFile(req: Request, res: Response): Promise<void> {
    try {
      const { category, folder, filename } = req.params
      const workspaceId = (req as any).workspaceId // Set by workspaceValidationMiddleware

      // Security: Only allow 'private' category
      if (category !== 'private') {
        res.status(403).json({ 
          error: 'Forbidden', 
          message: 'Only private files can be accessed via this endpoint. Public files are served via /uploads/public' 
        })
        return
      }

      // Construct file path
      const backendRoot = process.cwd()
      const filePath = path.join(backendRoot, 'apps/backend/uploads', category, folder, filename)

      // Security: Prevent path traversal attacks
      const normalizedPath = path.normalize(filePath)
      const uploadsDir = path.join(backendRoot, 'apps/backend/uploads', category)
      if (!normalizedPath.startsWith(uploadsDir)) {
        logger.warn(`🚨 Path traversal attempt blocked: ${filePath}`)
        res.status(403).json({ error: 'Forbidden', message: 'Invalid file path' })
        return
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        logger.warn(`📁 File not found: ${filePath}`)
        res.status(404).json({ error: 'Not Found', message: 'File not found' })
        return
      }

      // BUG#13 FIX: Enforce workspace isolation.
      // Without this check any authenticated user can download private files from
      // any other workspace by knowing or guessing the folder path.
      // Convention: private files are stored under a folder that starts with the
      // workspaceId, e.g. /private/<workspaceId>/invoices/INV-001.pdf
      if (!folder.startsWith(workspaceId)) {
        logger.warn(`🚨 Workspace isolation violation blocked: workspace ${workspaceId} attempted to access folder '${folder}'`)
        res.status(403).json({ error: 'Forbidden', message: "Access denied to this workspace's files" })
        return
      }

      // Determine content type
      const ext = path.extname(filename).toLowerCase()
      const contentTypeMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.txt': 'text/plain',
        '.json': 'application/json',
        '.xml': 'application/xml',
      }
      const contentType = contentTypeMap[ext] || 'application/octet-stream'

      // Serve file
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
      
      const fileStream = fs.createReadStream(filePath)
      fileStream.pipe(res)

      logger.info(`📄 Served private file: ${category}/${folder}/${filename} to workspace ${workspaceId}`)
    } catch (error) {
      logger.error('❌ Error serving private file:', error)
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to serve file' 
      })
    }
  }

  /**
   * Check if private file exists (HEAD request)
   * HEAD /api/v1/files/private/:category/:folder/:filename
   */
  async checkPrivateFile(req: Request, res: Response): Promise<void> {
    try {
      const { category, folder, filename } = req.params
      const workspaceId = (req as any).workspaceId // Set by workspaceValidationMiddleware

      if (category !== 'private') {
        res.status(403).end()
        return
      }

      const backendRoot = process.cwd()
      const filePath = path.join(backendRoot, 'apps/backend/uploads', category, folder, filename)
      
      // Security: Prevent path traversal
      const normalizedPath = path.normalize(filePath)
      const uploadsDir = path.join(backendRoot, 'apps/backend/uploads', category)
      if (!normalizedPath.startsWith(uploadsDir)) {
        res.status(403).end()
        return
      }

      // BUG#13 FIX: Enforce workspace isolation on HEAD requests too
      if (workspaceId && !folder.startsWith(workspaceId)) {
        logger.warn(`🚨 Workspace isolation violation (HEAD) blocked: workspace ${workspaceId} attempted folder '${folder}'`)
        res.status(403).end()
        return
      }

      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        res.setHeader('Content-Length', stats.size.toString())
        res.status(200).end()
      } else {
        res.status(404).end()
      }
    } catch (error) {
      logger.error('❌ Error checking private file:', error)
      res.status(500).end()
    }
  }
}

export const filesController = new FilesController()
