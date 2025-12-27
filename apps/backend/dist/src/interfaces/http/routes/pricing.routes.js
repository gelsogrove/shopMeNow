"use strict";
/**
 * Pricing Routes
 *
 * PUBLIC routes for pricing configuration.
 * No authentication required.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pricing_controller_1 = require("../controllers/pricing.controller");
const router = (0, express_1.Router)();
const controller = new pricing_controller_1.PricingController();
/**
 * GET /api/pricing/config
 * Returns all pricing grouped by type (plans, usage, thresholds)
 */
router.get("/config", controller.getConfig.bind(controller));
/**
 * GET /api/pricing/config/:key
 * Returns specific pricing by key
 */
router.get("/config/:key", controller.getByKey.bind(controller));
exports.default = router;
//# sourceMappingURL=pricing.routes.js.map