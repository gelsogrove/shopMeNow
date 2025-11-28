import { NextFunction, Request, Response } from "express";
import logger from "../../../utils/logger";
import { AppError } from "./error.middleware";

/**
 * Middleware to check if user has access to the requested workspace
 * This middleware should be used after the authMiddleware
 */
export const workspaceAuthMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    // Get workspace ID from URL params
    const workspaceId = req.params.workspaceId;
    
    // Check if workspaceId is empty or just whitespace
    if (!workspaceId || workspaceId.trim() === '') {
      logger.debug('Workspace ID is empty or missing');
      throw new AppError(400, "Workspace ID is required");
    }
    
    // Skip in test environment if test auth is enabled
    if (process.env.NODE_ENV === 'test' && 
        process.env.INTEGRATION_TEST === 'true' && 
        req.headers['x-test-auth'] === 'true') {
      // For test auth, we need to check if the workspace ID in the URL matches the one in the headers
      const headerWorkspaceId = req.headers['x-workspace-id'];
      
      if (headerWorkspaceId && workspaceId !== headerWorkspaceId) {
        logger.debug(`Test environment: Unauthorized workspace access. URL: ${workspaceId}, Header: ${headerWorkspaceId}`);
        throw new AppError(403, "You don't have access to this workspace");
      }
      
      return next();
    }
    
    // Ensure user is authenticated
    if (!req.user) {
      throw new AppError(401, "Authentication required");
    }
    
    // Check if user has access to the workspace
    const hasAccess = req.user.workspaces && 
                     Array.isArray(req.user.workspaces) && 
                     req.user.workspaces.some(ws => ws.id === workspaceId);
    
    if (!hasAccess) {
      logger.debug(`User ${req.user.id} attempted to access unauthorized workspace ${workspaceId}`);
      throw new AppError(403, "You don't have access to this workspace");
    }
    
    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(403, "Workspace authorization failed");
  }
}; 