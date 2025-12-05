import { prisma } from "@echatbot/database"
import { Request, Response } from "express"
import { BillingService } from "../../../application/services/billing.service"
import { FaqService } from "../../../application/services/faq.service"
import logger from "../../../utils/logger"

// prisma imported

/**
 * FaqController class
 * Handles HTTP requests related to FAQs
 */
export class FaqController {
  private faqService: FaqService
  private billingService: BillingService

  constructor() {
    this.faqService = new FaqService()
    this.billingService = new BillingService(prisma)
  }

  /**
   * Get all FAQs for a workspace
   * @swagger
   * /api/workspaces/{workspaceId}/faqs:
   *   get:
   *     summary: Get all FAQs for a workspace
   *     tags: [FAQs]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of FAQs
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/FAQ'
   *       400:
   *         description: Workspace ID is required
   *       500:
   *         description: Failed to get FAQs
   */
  async getAllFaqs(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const faqs = await this.faqService.getAllForWorkspace(workspaceId)
      return res.json(faqs)
    } catch (error) {
      logger.error("Error getting FAQs:", error)
      return res.status(500).json({ error: "Failed to get FAQs" })
    }
  }

  /**
   * Get FAQ by ID
   * @swagger
   * /api/workspaces/{workspaceId}/faqs/{id}:
   *   get:
   *     summary: Get FAQ by ID
   *     tags: [FAQs]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: FAQ ID
   *     responses:
   *       200:
   *         description: FAQ details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FAQ'
   *       404:
   *         description: FAQ not found
   *       500:
   *         description: Failed to get FAQ
   */
  async getFaqById(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const faq = await this.faqService.getById(id, workspaceId)

      if (!faq) {
        return res.status(404).json({ error: "FAQ not found" })
      }

      return res.json(faq)
    } catch (error) {
      logger.error(`Error getting FAQ ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get FAQ" })
    }
  }

  /**
   * Create a new FAQ
   * @swagger
   * /api/workspaces/{workspaceId}/faqs:
   *   post:
   *     summary: Create a new FAQ
   *     tags: [FAQs]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateFAQRequest'
   *     responses:
   *       201:
   *         description: FAQ created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FAQ'
   *       400:
   *         description: Invalid FAQ data or missing required fields
   *       500:
   *         description: Failed to create FAQ
   */
  async createFaq(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const { question, answer, isActive } = req.body
      const faqData = {
        question,
        answer,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      }

      const faq = await this.faqService.create(faqData)

      return res.status(201).json(faq)
    } catch (error: any) {
      logger.error("Error creating FAQ:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid FAQ data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create FAQ" })
    }
  }

  /**
   * Update a FAQ
   * @swagger
   * /api/workspaces/{workspaceId}/faqs/{id}:
   *   put:
   *     summary: Update a FAQ
   *     tags: [FAQs]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: FAQ ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateFAQRequest'
   *     responses:
   *       200:
   *         description: FAQ updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FAQ'
   *       400:
   *         description: Invalid FAQ data
   *       404:
   *         description: FAQ not found
   *       500:
   *         description: Failed to update FAQ
   */
  async updateFaq(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const { question, answer, isActive } = req.body

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const faq = await this.faqService.update(id, workspaceId, {
        question,
        answer,
        isActive,
      })

      return res.json(faq)
    } catch (error: any) {
      logger.error(`Error updating FAQ ${req.params.id}:`, error)

      if (error.message === "FAQ not found") {
        return res.status(404).json({ error: "FAQ not found" })
      }

      if (error.message === "Invalid FAQ data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update FAQ" })
    }
  }

  /**
   * Delete a FAQ
   * @swagger
   * /api/workspaces/{workspaceId}/faqs/{id}:
   *   delete:
   *     summary: Delete a FAQ
   *     tags: [FAQs]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: FAQ ID
   *     responses:
   *       204:
   *         description: FAQ deleted
   *       404:
   *         description: FAQ not found
   *       500:
   *         description: Failed to delete FAQ
   */
  async deleteFaq(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.faqService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "FAQ not found") {
          return res.status(404).json({ error: "FAQ not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting FAQ ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete FAQ" })
    }
  }
}
