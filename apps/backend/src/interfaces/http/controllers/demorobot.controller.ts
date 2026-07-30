import { Request, Response } from 'express'
import logger from '../../../utils/logger'
import {
  createRobotModel,
  deleteRobotModel,
  listRobotModels,
  updateRobotModel,
} from '../../../application/demorobot/robot-model.service'
import {
  createFlow,
  deleteFlow,
  getFlowGraph,
  listFlows,
  saveFlowGraph,
} from '../../../application/demorobot/flow-graph.service'
import { createAssetFromFile, createAssetLink, deleteAsset, listAssets } from '../../../application/demorobot/asset.service'
import { OpenRouterEmbeddingProvider } from '../../../application/demorobot/embedding-provider'

// 3-layer security (authMiddleware -> sessionValidationMiddleware ->
// validateWorkspaceId) is applied at the route level — every handler here
// can trust (req as any).workspaceId, set by validateWorkspaceId.

const embeddingProvider = new OpenRouterEmbeddingProvider(process.env.OPENROUTER_API_KEY || '')

export class DemoRobotController {
  // ── RobotModel ──────────────────────────────────────────────────────────

  async listRobotModels(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const robotModels = await listRobotModels(workspaceId)
      res.json({ robotModels })
    } catch (error) {
      logger.error('[demorobot] listRobotModels error:', error)
      res.status(500).json({ error: 'Failed to list robot models' })
    }
  }

  async createRobotModel(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { name, slug, manufacturer, description, lookupRules } = req.body
      if (!name || !slug) {
        res.status(400).json({ error: 'name and slug are required' })
        return
      }
      const model = await createRobotModel(workspaceId, { name, slug, manufacturer, description, lookupRules })
      res.status(201).json(model)
    } catch (error) {
      logger.error('[demorobot] createRobotModel error:', error)
      res.status(500).json({ error: 'Failed to create robot model' })
    }
  }

  async updateRobotModel(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId } = req.params
      const updated = await updateRobotModel(workspaceId, robotModelId, req.body)
      if (!updated) {
        res.status(404).json({ error: 'Robot model not found' })
        return
      }
      res.json(updated)
    } catch (error) {
      logger.error('[demorobot] updateRobotModel error:', error)
      res.status(500).json({ error: 'Failed to update robot model' })
    }
  }

  async deleteRobotModel(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId } = req.params
      const ok = await deleteRobotModel(workspaceId, robotModelId)
      if (!ok) {
        res.status(404).json({ error: 'Robot model not found' })
        return
      }
      res.status(204).send()
    } catch (error) {
      logger.error('[demorobot] deleteRobotModel error:', error)
      res.status(500).json({ error: 'Failed to delete robot model' })
    }
  }

  // ── Flow ────────────────────────────────────────────────────────────────

  async listFlows(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const robotModelId = req.query.generic === 'true' ? null : (req.query.robotModelId as string | undefined) ?? null
      const flows = await listFlows(workspaceId, robotModelId)
      res.json({ flows })
    } catch (error) {
      logger.error('[demorobot] listFlows error:', error)
      res.status(500).json({ error: 'Failed to list flows' })
    }
  }

  async createFlow(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { title, robotModelId, description } = req.body
      if (!title) {
        res.status(400).json({ error: 'title is required' })
        return
      }
      const flow = await createFlow(workspaceId, robotModelId ?? null, title, description)
      res.status(201).json(flow)
    } catch (error) {
      logger.error('[demorobot] createFlow error:', error)
      res.status(500).json({ error: 'Failed to create flow' })
    }
  }

  async deleteFlow(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { flowId } = req.params
      const ok = await deleteFlow(workspaceId, flowId)
      if (!ok) {
        res.status(404).json({ error: 'Flow not found' })
        return
      }
      res.status(204).send()
    } catch (error) {
      logger.error('[demorobot] deleteFlow error:', error)
      res.status(500).json({ error: 'Failed to delete flow' })
    }
  }

  async getFlowGraph(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { flowId } = req.params
      const graph = await getFlowGraph(workspaceId, flowId)
      if (!graph) {
        res.status(404).json({ error: 'Flow not found' })
        return
      }
      res.json(graph)
    } catch (error) {
      logger.error('[demorobot] getFlowGraph error:', error)
      res.status(500).json({ error: 'Failed to load flow graph' })
    }
  }

  async saveFlowGraph(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { flowId } = req.params
      const result = await saveFlowGraph(workspaceId, flowId, req.body, embeddingProvider)
      if (!result.ok && !result.validationReport) {
        res.status(404).json({ error: 'Flow not found' })
        return
      }
      res.json(result)
    } catch (error) {
      logger.error('[demorobot] saveFlowGraph error:', error)
      res.status(500).json({ error: 'Failed to save flow graph' })
    }
  }

  // ── Asset ───────────────────────────────────────────────────────────────

  async listAssets(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId } = req.params
      const assets = await listAssets(workspaceId, robotModelId)
      if (assets === null) {
        res.status(404).json({ error: 'Robot model not found' })
        return
      }
      res.json({ assets })
    } catch (error) {
      logger.error('[demorobot] listAssets error:', error)
      res.status(500).json({ error: 'Failed to list assets' })
    }
  }

  async createAssetFromFile(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId } = req.params
      const file = req.file
      const { type, title, summary, language } = req.body
      if (!file) {
        res.status(400).json({ error: 'file is required' })
        return
      }
      if (!title || !type) {
        res.status(400).json({ error: 'type and title are required' })
        return
      }
      const asset = await createAssetFromFile(workspaceId, {
        robotModelId,
        type,
        title,
        summary,
        language,
        file: { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype },
      })
      if (!asset) {
        res.status(404).json({ error: 'Robot model not found' })
        return
      }
      res.status(201).json(asset)
    } catch (error) {
      logger.error('[demorobot] createAssetFromFile error:', error)
      res.status(500).json({ error: 'Failed to upload asset' })
    }
  }

  async createAssetLink(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId } = req.params
      const { url, title, summary, language } = req.body
      if (!url || !title) {
        res.status(400).json({ error: 'url and title are required' })
        return
      }
      const asset = await createAssetLink(workspaceId, { robotModelId, url, title, summary, language })
      if (!asset) {
        res.status(404).json({ error: 'Robot model not found' })
        return
      }
      res.status(201).json(asset)
    } catch (error) {
      logger.error('[demorobot] createAssetLink error:', error)
      res.status(500).json({ error: 'Failed to create asset link' })
    }
  }

  async deleteAsset(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId, assetId } = req.params
      const ok = await deleteAsset(workspaceId, robotModelId, assetId)
      if (!ok) {
        res.status(404).json({ error: 'Asset not found' })
        return
      }
      res.status(204).send()
    } catch (error) {
      logger.error('[demorobot] deleteAsset error:', error)
      res.status(500).json({ error: 'Failed to delete asset' })
    }
  }
}
