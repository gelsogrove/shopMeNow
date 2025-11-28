import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import logger from '../../../utils/logger';

export class LanguageController {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Get all active languages for a workspace
   */
  getAllLanguages = async (req: Request, res: Response): Promise<Response> => {
    try {
      const workspaceId = req.headers['x-workspace-id'] as string || req.query.workspaceId as string;

      if (!workspaceId) {
        logger.error('Workspace ID is required for languages');
        return res.status(400).json({ error: 'Workspace ID is required' });
      }

      const languages = await this.prisma.languages.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          isDefault: true,
        },
        where: {
          isActive: true,
          workspaceId: workspaceId
        },
        orderBy: {
          name: 'asc',
        },
      });

      logger.debug(`Retrieved ${languages.length} languages for workspace ${workspaceId}`);
      
      return res.status(200).json({
        languages: languages,
      });
    } catch (error) {
      logger.error('Error fetching languages:', error);
      return res.status(500).json({ error: 'Failed to fetch languages' });
    }
  };
} 