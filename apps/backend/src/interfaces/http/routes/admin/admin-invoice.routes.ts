/**
 * 🧾 ADMIN INVOICE ROUTES (Wrapper)
 *
 * Thin router that delegates to sub-routers for maintainability.
 * Each sub-router handles a specific domain of invoice operations.
 */

import { Router } from "express"
import adminInvoiceCoreRoutes from "./admin-invoice-core.routes"
import adminInvoiceCreditNotesRoutes from "./admin-invoice-credit-notes.routes"
import adminInvoiceAdjustmentsRoutes from "./admin-invoice-adjustments.routes"
import adminInvoiceAnalyticsRoutes from "./admin-invoice-analytics.routes"
import adminInvoiceRevenueRoutes from "./admin-invoice-revenue.routes"
import adminInvoicePaypalRoutes from "./admin-invoice-paypal.routes"

const router = Router()

// Core: current invoices, PDF, status update, invoice detail
router.use(adminInvoiceCoreRoutes)

// Credit notes CRUD
router.use(adminInvoiceCreditNotesRoutes)

// Invoice adjustments CRUD
router.use(adminInvoiceAdjustmentsRoutes)

// Analytics: history, summary, unpaid/failed lists
router.use(adminInvoiceAnalyticsRoutes)

// Revenue stats for analytics dashboard
router.use(adminInvoiceRevenueRoutes)

// PayPal: payments, transactions, cancel invoice
router.use(adminInvoicePaypalRoutes)

export default router
