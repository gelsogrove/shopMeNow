import { Router } from "express"
import { shortUrlController } from "../controllers/short-url.controller"
import { authMiddleware } from "../middlewares/auth.middleware"

const router = Router()

/**
 * Short URL Routes
 * Handle URL shortening and redirection
 *
 * 🔓 PUBLIC: Redirect and resolve endpoints are public (short URLs for customers)
 * 🔒 PROTECTED: Stats endpoint requires authentication
 */

// Redirect from short URL (public route - NO AUTH REQUIRED)
router.get("/s/:shortCode", shortUrlController.redirect)

// Resolve short URL to JSON (public route - NO AUTH REQUIRED)
// Used by frontend SPA to avoid CORS redirect issues
router.get("/s/:shortCode/resolve", shortUrlController.resolve)

// Get short URL statistics (API route - REQUIRES AUTH)
router.get(
  "/api/short-urls/:shortCode/stats",
  authMiddleware,
  shortUrlController.getStats
)

export { router as shortUrlRoutes }
