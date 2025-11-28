import { Request } from 'express';
import { WorkspaceContextDTO } from '../../../application/dtos/workspace-context.dto';

/**
 * Extension of Express Request interface to include workspace context
 */
export interface WorkspaceRequest extends Request {
  workspaceContext: WorkspaceContextDTO;
  files?: Express.Multer.File[];
} 