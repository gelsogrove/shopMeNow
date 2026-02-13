/**
 * 👤 ADMIN USER MANAGEMENT ROUTES (Wrapper)
 *
 * Thin router that delegates to sub-routers for maintainability.
 * Each sub-router handles a specific domain of user management.
 */

import { Router } from "express"
import adminUserPermissionsRoutes from "./admin-user-permissions.routes"
import adminUserSubscriptionRoutes from "./admin-user-subscription.routes"
import adminUserSecurityRoutes from "./admin-user-security.routes"

const router = Router()

// Permissions: isPlatformAdmin, isDeveloperUser, user status
router.use(adminUserPermissionsRoutes)

// Subscription: payment failure/reset, subscription status, bonus credits
router.use(adminUserSubscriptionRoutes)

// Security: 2FA reset/enable, impersonation, trial extension
router.use(adminUserSecurityRoutes)

export default router
