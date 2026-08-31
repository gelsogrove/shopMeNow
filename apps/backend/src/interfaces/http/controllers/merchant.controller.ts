import { Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { MerchantService } from "../../../application/services/merchant.service"
import { AppError } from "../middlewares/error.middleware"
import logger from "../../../utils/logger"

/**
 * MerchantController
 *
 * HTTP layer for the merchant-advertising domain: merchants (esercenti),
 * their creatives (pushes), push-package quota top-ups and the invoicing
 * stats. Thin by design — every rule lives in MerchantService.
 *
 * workspaceId always comes from the route params validated by the middleware
 * stack (multi-tenant, CLAUDE.md rule 2).
 */
export class MerchantController {
  private service: MerchantService

  constructor() {
    this.service = new MerchantService(prisma as any)
  }

  private handleError(res: Response, error: unknown, fallback: string): Response {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message })
    }
    logger.error(`[MerchantController] ${fallback}`, {
      error: error instanceof Error ? error.message : String(error),
    })
    return res.status(500).json({ error: fallback })
  }

  // ── Merchants ──────────────────────────────────────────────────────────

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params
      return res.json(await this.service.list(workspaceId))
    } catch (error) {
      return this.handleError(res, error, "Failed to list merchants")
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId, id } = req.params
      return res.json(await this.service.getById(id, workspaceId))
    } catch (error) {
      return this.handleError(res, error, "Failed to get merchant")
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params
      const merchant = await this.service.create({
        ...req.body,
        workspaceId, // never trusted from the body
      })
      return res.status(201).json(merchant)
    } catch (error) {
      return this.handleError(res, error, "Failed to create merchant")
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId, id } = req.params
      // workspaceId/quotaRemaining are not client-writable: the first is the
      // tenant boundary, the second only moves via top-ups and debited sends.
      const { workspaceId: _ws, quotaRemaining: _q, ...data } = req.body ?? {}
      return res.json(await this.service.update(id, workspaceId, data))
    } catch (error) {
      return this.handleError(res, error, "Failed to update merchant")
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId, id } = req.params
      await this.service.delete(id, workspaceId)
      return res.status(204).send()
    } catch (error) {
      return this.handleError(res, error, "Failed to delete merchant")
    }
  }

  // ── Quota ──────────────────────────────────────────────────────────────

  async topUpQuota(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId, id } = req.params
      const merchant = await this.service.topUpQuota({
        id,
        workspaceId,
        amount: Number(req.body?.amount),
        note: req.body?.note ?? null,
        createdByUserId: (req as any).user?.id ?? null,
      })
      return res.json(merchant)
    } catch (error) {
      return this.handleError(res, error, "Failed to top up quota")
    }
  }

  async stats(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId, id } = req.params
      return res.json(await this.service.stats(id, workspaceId))
    } catch (error) {
      return this.handleError(res, error, "Failed to get merchant stats")
    }
  }

  // ── Creatives (pushes) ─────────────────────────────────────────────────

  async listPushes(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId, id } = req.params
      return res.json(await this.service.listPushes(id, workspaceId))
    } catch (error) {
      return this.handleError(res, error, "Failed to list pushes")
    }
  }

  async createPush(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId, id } = req.params
      const push = await this.service.createPush({
        ...req.body,
        workspaceId,
        merchantId: id,
      })
      return res.status(201).json(push)
    } catch (error) {
      return this.handleError(res, error, "Failed to create push")
    }
  }

  async updatePush(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId, pushId } = req.params
      const { workspaceId: _ws, merchantId: _m, ...data } = req.body ?? {}
      return res.json(await this.service.updatePush(pushId, workspaceId, data))
    } catch (error) {
      return this.handleError(res, error, "Failed to update push")
    }
  }

  async deletePush(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId, pushId } = req.params
      await this.service.deletePush(pushId, workspaceId)
      return res.status(204).send()
    } catch (error) {
      return this.handleError(res, error, "Failed to delete push")
    }
  }
}
