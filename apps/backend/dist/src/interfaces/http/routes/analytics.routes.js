"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
const router = (0, express_1.Router)();
const analyticsController = new analytics_controller_1.AnalyticsController();
// Protect all analytics routes with authentication
router.use(auth_middleware_1.authMiddleware);
router.use(workspace_validation_middleware_1.workspaceValidationMiddleware);
/**
 * GET /api/analytics/:workspaceId/dashboard
 * Get dashboard analytics data with optional date range
 * Query params: startDate, endDate (optional)
 * Default: last 3 months excluding current month
 */
router.get("/:workspaceId/dashboard", analyticsController.getDashboardData.bind(analyticsController));
/**
 * GET /api/analytics/:workspaceId/detailed
 * Get detailed metrics for a specific metric type
 * Query params: startDate, endDate (required), metric (required)
 */
router.get("/:workspaceId/detailed", analyticsController.getDetailedMetrics.bind(analyticsController));
/**
 * GET /api/analytics/:workspaceId/monthly-top-customers
 * Get monthly top customers breakdown
 * Query params: startDate, endDate (required)
 */
router.get("/:workspaceId/monthly-top-customers", analyticsController.getMonthlyTopCustomers.bind(analyticsController));
/**
 * GET /api/analytics/:workspaceId/monthly-top-clients
 * Get monthly top clients breakdown
 * Query params: startDate, endDate (required)
 */
router.get("/:workspaceId/monthly-top-clients", analyticsController.getMonthlyTopClients.bind(analyticsController));
/**
 * GET /api/analytics/:workspaceId/top-searched-products
 * Get top 10 searched products with counts
 * Query params: period (7days|30days|alltime), limit (default 10)
 */
router.get("/:workspaceId/top-searched-products", analyticsController.getTopSearchedProducts.bind(analyticsController));
/**
 * GET /api/analytics/:workspaceId/search-trends
 * Get search trends over time (daily aggregation)
 * Query params: period (7days|30days|alltime)
 */
router.get("/:workspaceId/search-trends", analyticsController.getSearchTrends.bind(analyticsController));
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map