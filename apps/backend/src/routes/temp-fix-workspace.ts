import { Router, Request, Response } from 'express';
import { prisma } from '@echatbot/database';

const router = Router();

// TEMPORARY ENDPOINT - Delete after use!
router.get('/temp-fix-workspace/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    
    // Check current state
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        deletedAt: true,
        channelStatus: true
      }
    });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    const result = {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        deletedAt: workspace.deletedAt,
        channelStatus: workspace.channelStatus
      },
      problem: workspace.deletedAt !== null ? `deletedAt is set to ${workspace.deletedAt}` : null
    };
    
    // If fix query parameter is provided, fix it
    if (req.query.fix === 'true' && workspace.deletedAt !== null) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { deletedAt: null }
      });
      
      return res.json({
        ...result,
        fixed: true,
        message: 'deletedAt has been set to NULL'
      });
    }
    
    return res.json(result);
    
  } catch (error) {
    console.error('Error in temp-fix-workspace:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
