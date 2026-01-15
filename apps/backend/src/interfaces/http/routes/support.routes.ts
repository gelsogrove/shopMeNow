import express from "express"
import multer from "multer"
import { authMiddleware } from "../../../middlewares/auth.middleware"
import { supportTicketController } from "../controllers/support-ticket.controller"

const router = express.Router()

// Configure multer for file uploads (memory storage for S3/Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5, // Max 5 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and common document types
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`))
    }
  },
})

// 🔒 All routes require authentication
router.use(authMiddleware)

/**
 * @swagger
 * /api/support/tickets:
 *   post:
 *     summary: Create a new support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - issueType
 *               - subject
 *               - message
 *             properties:
 *               workspaceId:
 *                 type: string
 *               issueType:
 *                 type: string
 *                 enum: [ACCOUNT_ISSUE, PLAN_AND_BILLING, WHATSAPP, WIDGET, SALES_AGENT, OTHER]
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ticket created successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 */
router.post("/tickets", (req, res) => {
  supportTicketController.createTicket(req, res)
})

/**
 * @swagger
 * /api/support/tickets:
 *   get:
 *     summary: Get all tickets for current user
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, CLOSED]
 *       - in: query
 *         name: issueType
 *         schema:
 *           type: string
 *           enum: [ACCOUNT_ISSUE, PLAN_AND_BILLING, WHATSAPP, WIDGET, SALES_AGENT, SUPPORT, OTHER]
 *     responses:
 *       200:
 *         description: List of tickets
 *       401:
 *         description: Unauthorized
 */
router.get("/tickets", (req, res) => {
  supportTicketController.getMyTickets(req, res)
})

/**
 * @swagger
 * /api/support/tickets/unread-count:
 *   get:
 *     summary: Get unread message count
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     unreadCount:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get("/tickets/unread-count", (req, res) => {
  supportTicketController.getUnreadCount(req, res)
})

/**
 * @swagger
 * /api/support/tickets/{ticketId}:
 *   get:
 *     summary: Get a specific ticket with all messages
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticket details with messages
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Ticket not found
 */
router.get("/tickets/:ticketId", (req, res) => {
  supportTicketController.getTicket(req, res)
})

/**
 * @swagger
 * /api/support/tickets/{ticketId}:
 *   delete:
 *     summary: Delete a ticket (owner only)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticket deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Ticket not found
 */
router.delete("/tickets/:ticketId", (req, res) => {
  supportTicketController.deleteMyTicket(req, res)
})

/**
 * @swagger
 * /api/support/tickets/{ticketId}/messages:
 *   post:
 *     summary: Add a message to a ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Message added successfully
 *       400:
 *         description: Message is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
router.post("/tickets/:ticketId/messages", upload.array("attachments", 5), (req, res) => {
  supportTicketController.addMessage(req, res)
})

/**
 * @swagger
 * /api/support/tickets/{ticketId}/status:
 *   put:
 *     summary: Update ticket status (admin only)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, WAITING_REPLY, RESOLVED, CLOSED]
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin only
 *       404:
 *         description: Ticket not found
 */
router.put("/tickets/:ticketId/status", (req, res) => {
  supportTicketController.updateStatus(req, res)
})

export { router as supportRouter }
