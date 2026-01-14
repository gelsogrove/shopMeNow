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

// 🔒 All routes require authentication (admin check is in controller)
router.use(authMiddleware)

/**
 * @swagger
 * /api/admin/support/tickets:
 *   get:
 *     summary: Get all support tickets (admin only)
 *     tags: [Admin - Support]
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
 *           enum: [OPEN, IN_PROGRESS, WAITING_REPLY, RESOLVED, CLOSED]
 *       - in: query
 *         name: issueType
 *         schema:
 *           type: string
 *           enum: [BUG, FEATURE_REQUEST, BILLING, TECHNICAL, OTHER]
 *     responses:
 *       200:
 *         description: List of all tickets
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin only
 */
router.get("/tickets", (req, res) => {
  supportTicketController.getAllTickets(req, res)
})

/**
 * @swagger
 * /api/admin/support/tickets/unread-count:
 *   get:
 *     summary: Get unread message count for admin
 *     tags: [Admin - Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count for admin
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin only
 */
router.get("/tickets/unread-count", (req, res) => {
  supportTicketController.getUnreadCount(req, res)
})

/**
 * @swagger
 * /api/admin/support/tickets/{ticketId}:
 *   get:
 *     summary: Get a specific ticket with all messages
 *     tags: [Admin - Support]
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
 *         description: Ticket details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin only
 *       404:
 *         description: Ticket not found
 */
router.get("/tickets/:ticketId", (req, res) => {
  supportTicketController.getTicket(req, res)
})

/**
 * @swagger
 * /api/admin/support/tickets/{ticketId}/messages:
 *   post:
 *     summary: Add an admin reply to a ticket
 *     tags: [Admin - Support]
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
 *         description: Reply added
 *       400:
 *         description: Message required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin only
 */
router.post("/tickets/:ticketId/messages", upload.array("attachments", 5), (req, res) => {
  supportTicketController.addMessage(req, res)
})

/**
 * @swagger
 * /api/admin/support/tickets/{ticketId}/status:
 *   put:
 *     summary: Update ticket status
 *     tags: [Admin - Support]
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
 *         description: Platform admin only
 *       404:
 *         description: Ticket not found
 */
router.put("/tickets/:ticketId/status", (req, res) => {
  supportTicketController.updateStatus(req, res)
})

export { router as adminSupportRouter }
