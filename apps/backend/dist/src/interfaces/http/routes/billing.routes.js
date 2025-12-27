"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingRouter = void 0;
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../../../middlewares/auth.middleware");
const billing_controller_1 = require("../controllers/billing.controller");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
const router = express_1.default.Router();
exports.billingRouter = router;
const billingController = new billing_controller_1.BillingController();
// 🔒 SECURITY: Protect all billing routes with authentication and workspace validation
router.use(auth_middleware_1.authMiddleware);
router.use(workspace_validation_middleware_1.workspaceValidationMiddleware);
/**
 * @route GET /api/billing/:workspaceId/totals
 * @desc Get current billing totals for a workspace
 * @query customerId (optional) - Get totals for specific customer
 */
router.get("/:workspaceId/totals", (req, res) => {
    billingController.getTotals(req, res);
});
/**
 * @route GET /api/billing/:workspaceId/summary
 * @desc Get detailed billing summary for a workspace
 */
router.get("/:workspaceId/summary", (req, res) => {
    billingController.getSummary(req, res);
});
/**
 * @route GET /api/billing/:workspaceId/history
 * @desc Get billing history in simple format: current + new = total
 * @query customerId (optional) - Get history for specific customer
 * @query limit (optional, default 50) - Number of records to return
 */
router.get("/:workspaceId/history", (req, res) => {
    billingController.getHistory(req, res);
});
/**
 * @route GET /api/billing/:workspaceId/monthly
 * @desc Get monthly billing breakdown for current month + 12 months history
 * @returns Monthly breakdown with totals per billing type
 */
router.get("/:workspaceId/monthly", (req, res) => {
    billingController.getMonthlyBreakdown(req, res);
});
/**
 * @route GET /api/billing/:workspaceId/monthly/:year/:month
 * @desc Get detailed billing records for a specific month
 * @param year - Year (e.g., 2025)
 * @param month - Month 1-12
 */
router.get("/:workspaceId/monthly/:year/:month", (req, res) => {
    billingController.getMonthDetail(req, res);
});
//# sourceMappingURL=billing.routes.js.map