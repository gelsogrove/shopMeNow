import { NextFunction, Request, Response } from 'express';
import { WorkspaceContextDTO } from '../../../application/dtos/workspace-context.dto';
import logger from '../../../utils/logger';

// Extend Express Request interface to include workspaceContext
declare global {
  namespace Express {
    interface Request {
      workspaceContext?: WorkspaceContextDTO;
    }
  }
}

/**
 * Middleware to extract and validate workspace context from request
 * This middleware checks for workspace ID in request parameters, query, body, or headers
 */
export const workspaceContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info('Middleware - Before extracting workspace context');
    
    // Extract workspace context from request using the DTO factory method
    const workspaceContext = WorkspaceContextDTO.fromRequest(req);
    
    logger.info('Middleware - After extracting workspace context:', workspaceContext);

    // Check if workspaceContext exists and is valid
    if (!workspaceContext) {
      logger.info('Middleware - workspaceContext is null');
      // Safely log parameters without accessing potentially undefined properties
      const paramsStr = req.params ? JSON.stringify(req.params) : 'undefined';
      const headerId = req.headers ? req.headers["x-workspace-id"] : 'undefined';
      logger.warn(`No workspace context found in request: ${paramsStr} or ${headerId}`);
      return res.status(400).json({ error: "Invalid workspace ID format" });
    }

    // Check if workspaceContext is valid
    if (!workspaceContext.isValid()) {
      logger.info('Middleware - workspaceContext is invalid');
      logger.warn(`Invalid workspace context: ${JSON.stringify(workspaceContext)}`);
      return res.status(400).json({ error: "Invalid workspace ID format" });
    }

    logger.info('Middleware - workspaceContext is valid');
    
    // Attach workspace context to request for downstream use
    req.workspaceContext = workspaceContext;
    next();
  } catch (error) {
    logger.info('Middleware - Error caught:', error);
    logger.error(`Error in workspace context middleware: ${error}`);
    return res.status(500).json({ error: "Internal server error" });
  }
}; 