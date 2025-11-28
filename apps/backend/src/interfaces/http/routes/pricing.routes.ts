/**
 * Pricing Routes
 *
 * PUBLIC routes for pricing configuration.
 * No authentication required.
 */

import { Router } from "express"
import { PricingController } from "../controllers/pricing.controller"

const router = Router()
const controller = new PricingController()

/**
 * GET /api/pricing/config
 * Returns all pricing grouped by type (plans, usage, thresholds)
 */
router.get("/config", controller.getConfig.bind(controller))

/**
 * GET /api/pricing/config/:key
 * Returns specific pricing by key
 */
router.get("/config/:key", controller.getByKey.bind(controller))

export default router
