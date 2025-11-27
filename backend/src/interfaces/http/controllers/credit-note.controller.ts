import { Request, Response } from "express"
import { CreditNoteService } from "../../../application/services/credit-note.service"
import logger from "../../../utils/logger"

export class CreditNoteController {
  private creditNoteService: CreditNoteService

  constructor(creditNoteService?: CreditNoteService) {
    this.creditNoteService = creditNoteService || new CreditNoteService()
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/orders/{orderId}/credit-notes:
   *   post:
   *     summary: Create a credit note for a delivered order
   *     tags: [Credit Notes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - amount
   *               - reason
   *             properties:
   *               amount:
   *                 type: number
   *                 minimum: 0.01
   *                 description: Amount of the credit note (must be positive, less than order total)
   *               reason:
   *                 type: string
   *                 description: Reason for the credit note
   *     responses:
   *       201:
   *         description: Credit note created successfully
   *       400:
   *         description: Invalid request or business rule violation
   *       404:
   *         description: Order not found
   */
  createCreditNote = async (req: Request, res: Response): Promise<Response> => {
    try {
      const workspaceId = req.params.workspaceId
      const orderId = req.params.orderId
      const { amount, reason } = req.body
      const userId = (req as any).user?.id

      if (!workspaceId) {
        return res.status(400).json({
          message: "WorkspaceId is required",
        })
      }

      if (!orderId) {
        return res.status(400).json({
          message: "OrderId is required",
        })
      }

      if (!amount || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({
          message: "L'importo deve essere un numero maggiore di zero",
        })
      }

      if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
        return res.status(400).json({
          message: "Il motivo della nota di credito è obbligatorio",
        })
      }

      const creditNote = await this.creditNoteService.createCreditNote({
        orderId,
        workspaceId,
        amount,
        reason: reason.trim(),
        createdById: userId,
      })

      logger.info("Credit note created via API:", {
        creditNoteId: creditNote.id,
        creditNoteCode: creditNote.creditNoteCode,
        orderId,
        amount,
        userId,
      })

      return res.status(201).json(creditNote)
    } catch (error) {
      const errorMessage = (error as Error).message

      // Handle business rule violations with 400
      if (
        errorMessage.includes("consegnati") ||
        errorMessage.includes("supera il valore") ||
        errorMessage.includes("maggiore di zero")
      ) {
        return res.status(400).json({
          message: errorMessage,
        })
      }

      // Handle not found
      if (errorMessage.includes("non trovato")) {
        return res.status(404).json({
          message: errorMessage,
        })
      }

      logger.error("Error creating credit note:", error)
      return res.status(500).json({
        message: "Errore nella creazione della nota di credito",
        error: errorMessage,
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/orders/{orderId}/credit-notes:
   *   get:
   *     summary: Get all credit notes for an order
   *     tags: [Credit Notes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of credit notes for the order
   *       404:
   *         description: Order not found
   */
  getCreditNotesByOrder = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const workspaceId = req.params.workspaceId
      const orderId = req.params.orderId

      if (!workspaceId || !orderId) {
        return res.status(400).json({
          message: "WorkspaceId and OrderId are required",
        })
      }

      const creditNotes = await this.creditNoteService.getCreditNotesByOrderId(
        orderId,
        workspaceId
      )

      return res.json(creditNotes)
    } catch (error) {
      const errorMessage = (error as Error).message

      if (errorMessage.includes("non trovato")) {
        return res.status(404).json({
          message: errorMessage,
        })
      }

      logger.error("Error fetching credit notes:", error)
      return res.status(500).json({
        message: "Errore nel recupero delle note di credito",
        error: errorMessage,
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/credit-notes/{creditNoteId}:
   *   get:
   *     summary: Get a single credit note by ID
   *     tags: [Credit Notes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: creditNoteId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Credit note details
   *       404:
   *         description: Credit note not found
   */
  getCreditNoteById = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const workspaceId = req.params.workspaceId
      const creditNoteId = req.params.creditNoteId

      if (!workspaceId || !creditNoteId) {
        return res.status(400).json({
          message: "WorkspaceId and CreditNoteId are required",
        })
      }

      const creditNote = await this.creditNoteService.getCreditNoteById(
        creditNoteId,
        workspaceId
      )

      if (!creditNote) {
        return res.status(404).json({
          message: "Nota di credito non trovata",
        })
      }

      return res.json(creditNote)
    } catch (error) {
      logger.error("Error fetching credit note:", error)
      return res.status(500).json({
        message: "Errore nel recupero della nota di credito",
        error: (error as Error).message,
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/credit-notes:
   *   get:
   *     summary: Get all credit notes for a workspace
   *     tags: [Credit Notes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: customerId
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of all credit notes for the workspace
   */
  getAllCreditNotes = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const workspaceId = req.params.workspaceId
      const { startDate, endDate, customerId } = req.query

      if (!workspaceId) {
        return res.status(400).json({
          message: "WorkspaceId is required",
        })
      }

      const options: {
        startDate?: Date
        endDate?: Date
        customerId?: string
      } = {}

      if (startDate) {
        options.startDate = new Date(startDate as string)
      }
      if (endDate) {
        options.endDate = new Date(endDate as string)
      }
      if (customerId) {
        options.customerId = customerId as string
      }

      const creditNotes = await this.creditNoteService.getAllCreditNotes(
        workspaceId,
        options
      )

      return res.json(creditNotes)
    } catch (error) {
      logger.error("Error fetching all credit notes:", error)
      return res.status(500).json({
        message: "Errore nel recupero delle note di credito",
        error: (error as Error).message,
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/credit-notes/{creditNoteId}:
   *   delete:
   *     summary: Delete a credit note
   *     tags: [Credit Notes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: creditNoteId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Credit note deleted successfully
   *       404:
   *         description: Credit note not found
   */
  deleteCreditNote = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const workspaceId = req.params.workspaceId
      const creditNoteId = req.params.creditNoteId

      if (!workspaceId || !creditNoteId) {
        return res.status(400).json({
          message: "WorkspaceId and CreditNoteId are required",
        })
      }

      await this.creditNoteService.deleteCreditNote(creditNoteId, workspaceId)

      return res.json({
        message: "Nota di credito eliminata con successo",
      })
    } catch (error) {
      const errorMessage = (error as Error).message

      if (errorMessage.includes("non trovata")) {
        return res.status(404).json({
          message: errorMessage,
        })
      }

      logger.error("Error deleting credit note:", error)
      return res.status(500).json({
        message: "Errore nell'eliminazione della nota di credito",
        error: errorMessage,
      })
    }
  }
}
