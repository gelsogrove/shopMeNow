"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gdpr_controller_1 = require("../controllers/gdpr.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
const workspace_role_middleware_1 = require("../../../middlewares/workspace-role.middleware");
const router = (0, express_1.Router)({ mergeParams: true });
/**
 * @swagger
 * /api/workspaces/{workspaceId}/gdpr:
 *   get:
 *     summary: Get GDPR content in specified language
 *     description: Returns GDPR privacy notice in the requested language
 *     parameters:
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [it, en, es, pt]
 *         description: Language code (default - English)
 *     responses:
 *       200:
 *         description: GDPR content successfully retrieved
 *   put:
 *     summary: Update GDPR content for a specific language
 *     description: Updates GDPR content in the database
 *     parameters:
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [it, en, es, pt]
 *         required: true
 *         description: Language code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: GDPR content successfully updated
 */
// GET: Retrieve GDPR content (public, no auth required)
router.get("/", (req, res) => gdpr_controller_1.gdprController.getGdpr(req, res));
// PUT: Update GDPR content (requires auth + workspace validation + SUPER_ADMIN only)
router.put("/", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, workspace_role_middleware_1.requireSuperAdmin, (req, res) => gdpr_controller_1.gdprController.updateGdpr(req, res));
exports.default = router;
//# sourceMappingURL=gdpr.routes.js.map