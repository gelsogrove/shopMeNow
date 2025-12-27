"use strict";
/**
 * 🕐 SCHEDULER ROUTES
 *
 * Route definitions for scheduler job status API.
 * Only accessible by Platform Admins.
 *
 * Protected Routes:
 * - GET /api/schedulers - Get all scheduler jobs
 * - PATCH /api/schedulers/:jobName - Update job (toggle isActive)
 *
 * @author Andrea Gelso - eChatbot Platform
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const scheduler_controller_1 = require("../controllers/scheduler.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const platform_admin_middleware_1 = require("../middlewares/platform-admin.middleware");
const router = (0, express_1.Router)();
// ============================================================================
// PROTECTED ROUTES (Platform Admin only)
// ============================================================================
/**
 * @swagger
 * /api/schedulers:
 *   get:
 *     summary: Get all scheduler jobs
 *     description: Returns all scheduler job statuses. Platform Admin only.
 *     tags: [Schedulers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of scheduler jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       jobName:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 *                       lastRunAt:
 *                         type: string
 *                         format: date-time
 *                       lastStatus:
 *                         type: string
 *                       lastError:
 *                         type: string
 *                       lastDuration:
 *                         type: integer
 *                       nextRunAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Platform Admin required
 */
router.get("/", auth_middleware_1.authMiddleware, platform_admin_middleware_1.platformAdminMiddleware, scheduler_controller_1.schedulerController.getAllJobs.bind(scheduler_controller_1.schedulerController));
/**
 * @swagger
 * /api/schedulers/{jobName}:
 *   patch:
 *     summary: Update scheduler job
 *     description: Update a scheduler job (e.g., toggle isActive). Platform Admin only.
 *     tags: [Schedulers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobName
 *         required: true
 *         schema:
 *           type: string
 *         description: The job name to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Job updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Platform Admin required
 *       404:
 *         description: Job not found
 */
router.patch("/:jobName", auth_middleware_1.authMiddleware, platform_admin_middleware_1.platformAdminMiddleware, scheduler_controller_1.schedulerController.updateJob.bind(scheduler_controller_1.schedulerController));
exports.default = router;
//# sourceMappingURL=scheduler.routes.js.map