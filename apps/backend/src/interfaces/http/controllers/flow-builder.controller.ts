import { Request, Response } from 'express'
import logger from '../../../utils/logger'
import {
  createFlowCategory,
  deleteFlowCategory,
  listFlowCategories,
  updateFlowCategory,
} from '../../../application/flow-builder/flow-category.service'
import {
  createFlow,
  deleteFlow,
  duplicateFlow,
  getFlowGraph,
  listFlows,
  saveFlowGraph,
} from '../../../application/flow-builder/flow-graph.service'
import { createAssetFromFile, createAssetLink, deleteAsset, listAssets } from '../../../application/flow-builder/asset.service'
import { OpenRouterEmbeddingProvider } from '../../../application/flow-builder/embedding-provider'

// 3-layer security (authMiddleware -> sessionValidationMiddleware ->
// validateWorkspaceId) is applied at the route level — every handler here
// can trust (req as any).workspaceId, set by validateWorkspaceId.

const embeddingProvider = new OpenRouterEmbeddingProvider(process.env.OPENROUTER_API_KEY || '')

export class FlowBuilderController {
  // ── FlowCategory ────────────────────────────────────────────────────────

  async listCategories(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const flowCategories = await listFlowCategories(workspaceId)
      res.json({ flowCategories })
    } catch (error) {
      logger.error('[flow-builder] listFlowCategories error:', error)
      res.status(500).json({ error: 'Failed to list categories' })
    }
  }

  async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { name, slug, description, lookupRules } = req.body
      if (!name || !slug) {
        res.status(400).json({ error: 'name and slug are required' })
        return
      }
      const category = await createFlowCategory(workspaceId, { name, slug, description, lookupRules })
      res.status(201).json(category)
    } catch (error) {
      logger.error('[flow-builder] createFlowCategory error:', error)
      res.status(500).json({ error: 'Failed to create category' })
    }
  }

  async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId: categoryId } = req.params
      const updated = await updateFlowCategory(workspaceId, categoryId, req.body)
      if (!updated) {
        res.status(404).json({ error: 'Category not found' })
        return
      }
      res.json(updated)
    } catch (error) {
      logger.error('[flow-builder] updateFlowCategory error:', error)
      res.status(500).json({ error: 'Failed to update category' })
    }
  }

  async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId: categoryId } = req.params
      const ok = await deleteFlowCategory(workspaceId, categoryId)
      if (!ok) {
        res.status(404).json({ error: 'Category not found' })
        return
      }
      res.status(204).send()
    } catch (error) {
      logger.error('[flow-builder] deleteFlowCategory error:', error)
      res.status(500).json({ error: 'Failed to delete category' })
    }
  }

  // ── Flow ────────────────────────────────────────────────────────────────

  async listFlows(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const flowCategoryId = req.query.generic === 'true' ? null : (req.query.robotModelId as string | undefined) ?? null
      const flows = await listFlows(workspaceId, flowCategoryId)
      res.json({ flows })
    } catch (error) {
      logger.error('[flow-builder] listFlows error:', error)
      res.status(500).json({ error: 'Failed to list flows' })
    }
  }

  async createFlow(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { title, robotModelId: categoryId, description } = req.body
      if (!title) {
        res.status(400).json({ error: 'title is required' })
        return
      }
      const flow = await createFlow(workspaceId, categoryId ?? null, title, description)
      res.status(201).json(flow)
    } catch (error) {
      logger.error('[flow-builder] createFlow error:', error)
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
      logger.error('[flow-builder] deleteFlow error:', error)
      res.status(500).json({ error: 'Failed to delete flow' })
    }
  }

  async duplicateFlow(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { flowId } = req.params
      const copy = await duplicateFlow(workspaceId, flowId)
      if (!copy) {
        res.status(404).json({ error: 'Flow not found' })
        return
      }
      res.status(201).json({ flow: copy })
    } catch (error) {
      logger.error('[flow-builder] duplicateFlow error:', error)
      res.status(500).json({ error: 'Failed to duplicate flow' })
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
      logger.error('[flow-builder] getFlowGraph error:', error)
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
      logger.error('[flow-builder] saveFlowGraph error:', error)
      res.status(500).json({ error: 'Failed to save flow graph' })
    }
  }

  // ── Asset ───────────────────────────────────────────────────────────────

  async listAssets(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId: categoryId } = req.params
      const assets = await listAssets(workspaceId, categoryId)
      if (assets === null) {
        res.status(404).json({ error: 'Category not found' })
        return
      }
      res.json({ assets })
    } catch (error) {
      logger.error('[flow-builder] listAssets error:', error)
      res.status(500).json({ error: 'Failed to list assets' })
    }
  }

  async createAssetFromFile(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId: categoryId } = req.params
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
        flowCategoryId: categoryId,
        type,
        title,
        summary,
        language,
        file: { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype },
      })
      if (!asset) {
        res.status(404).json({ error: 'Category not found' })
        return
      }
      res.status(201).json(asset)
    } catch (error) {
      logger.error('[flow-builder] createAssetFromFile error:', error)
      res.status(500).json({ error: 'Failed to upload asset' })
    }
  }

  async createAssetLink(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId: categoryId } = req.params
      const { url, title, summary, language } = req.body
      if (!url || !title) {
        res.status(400).json({ error: 'url and title are required' })
        return
      }
      const asset = await createAssetLink(workspaceId, { flowCategoryId: categoryId, url, title, summary, language })
      if (!asset) {
        res.status(404).json({ error: 'Category not found' })
        return
      }
      res.status(201).json(asset)
    } catch (error) {
      logger.error('[flow-builder] createAssetLink error:', error)
      res.status(500).json({ error: 'Failed to create asset link' })
    }
  }

  async deleteAsset(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const { robotModelId: categoryId, assetId } = req.params
      const ok = await deleteAsset(workspaceId, categoryId, assetId)
      if (!ok) {
        res.status(404).json({ error: 'Asset not found' })
        return
      }
      res.status(204).send()
    } catch (error) {
      logger.error('[flow-builder] deleteAsset error:', error)
      res.status(500).json({ error: 'Failed to delete asset' })
    }
  }
}
