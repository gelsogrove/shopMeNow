import cookieParser from "cookie-parser"
import cors from "cors"
import express from "express"
import fs from "fs"
import helmet from "helmet"
import path from "path"

import { errorMiddleware } from "./interfaces/http/middlewares/error.middleware"
import { jsonFixMiddleware } from "./interfaces/http/middlewares/json-fix.middleware"
import { loggingMiddleware } from "./middlewares/logging.middleware"
import apiRouter from "./routes"
import logger from "./utils/logger"
import { platformConfigService } from "./services/platform-config.service"

// Extend Request interface to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: string
    }
  }
}

// Import scheduler service
import { SchedulerService } from "./services/scheduler.service"

// Initialize Express app
const app = express()
// Use process.cwd() for monorepo root (on Heroku cwd = /app = monorepo root)
const backendRoot = process.cwd()
const landingAssetsPath = path.join(backendRoot, "apps/backend/public")
const landingPagePath = path.join(landingAssetsPath, "index.html")
const hasLandingPage = fs.existsSync(landingPagePath)
const landingRoutes = ["/", "/index.html", "/landing", "/landing/index.html"]
const frontendBaseUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "")
const loginRedirectUrl = `${frontendBaseUrl}/auth/login`

// Initialize and start scheduler service
const schedulerService = new SchedulerService()
schedulerService.startScheduledTasks()

// Logging middleware should be first
app.use(loggingMiddleware)

// 🔒 SECURITY: Force HTTPS in production (trust proxy for Heroku/nginx)
if (process.env.NODE_ENV === "production") {
  app.enable("trust proxy") // Trust X-Forwarded-* headers
  app.use((req, res, next) => {
    // Check if request is HTTP (not HTTPS)
    if (!req.secure && req.get("x-forwarded-proto") !== "https") {
      logger.warn(`HTTP request redirected to HTTPS: ${req.url}`, {
        ip: req.ip,
      })
      return res.redirect(301, `https://${req.hostname}${req.url}`)
    }
    next()
  })
}

// Other middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [process.env.FRONTEND_URL || "http://localhost:3000"]
        : [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002", // 🔐 Backoffice
            "http://localhost:5173",
          ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-workspace-id",
      "X-Session-Id",
    ],
    exposedHeaders: ["set-cookie", "Location", "location"],
  })
)

// Enable pre-flight requests for all routes
app.options("*", cors())

// 🔒 SECURITY: Helmet with strict security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // 🔐 FIX GOOGLE GSI: Allow popups for OAuth flow
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    // HSTS: Force HTTPS for 1 year (only in production)
    hsts:
      process.env.NODE_ENV === "production"
        ? {
            maxAge: 31536000, // 1 year in seconds
            includeSubDomains: true,
            preload: true,
          }
        : false,
    // Content Security Policy
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                "https://accounts.google.com",
                "https://accounts.google.com/gsi/",
                "https://*.gstatic.com",
              ],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://accounts.google.com",
              ],
              imgSrc: ["'self'", "data:", "https:", "blob:"],
              connectSrc: [
                "'self'",
                "https://api.openrouter.ai",
                "https://accounts.google.com",
                "https://*.googleapis.com",
                "https://*.gstatic.com",
                "wss://echatbot-production-5db591247cec.herokuapp.com",
                "https://echatbot-production-5db591247cec.herokuapp.com",
              ],
              fontSrc: ["'self'", "https://fonts.gstatic.com"],
              objectSrc: ["'none'"],
              frameSrc: [
                "https://accounts.google.com",
                "https://accounts.google.com/gsi/",
              ],
              childSrc: [
                "https://accounts.google.com",
                "https://accounts.google.com/gsi/",
              ],
              upgradeInsecureRequests: [],
            },
          }
        : false,
    // X-Frame-Options: prevent clickjacking
    frameguard: { action: "deny" },
    // X-Content-Type-Options: prevent MIME sniffing
    noSniff: true,
    // X-XSS-Protection: enable browser XSS filter
    xssFilter: true,
  })
)

// Serve static files from uploads directory
const uploadsPath = path.join(backendRoot, "apps/backend/uploads")
app.use("/uploads", express.static(uploadsPath))
logger.info(`Serving static files from: ${uploadsPath}`)

if (fs.existsSync(landingAssetsPath)) {
  app.use("/landing-assets", express.static(landingAssetsPath))
  logger.info(`[LandingPage] Serving assets from ${landingAssetsPath}`)
}

// 🌐 PRODUCTION: Serve frontend static files (from Vite build)
// Note: backendRoot = process.cwd() = monorepo root, so use apps/ path
if (process.env.NODE_ENV === "production") {
  const frontendDistPath = path.join(backendRoot, "apps/frontend/dist")
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath))
    logger.info(`[Production] Serving frontend from: ${frontendDistPath}`)
  } else {
    logger.warn(
      `[Production] Frontend dist not found at: ${frontendDistPath}`
    )
  }

  // 🔐 PRODUCTION: Serve backoffice static files (from Vite build)
  const backofficeDistPath = path.join(backendRoot, "apps/backoffice/dist")
  if (fs.existsSync(backofficeDistPath)) {
    app.use("/backoffice", express.static(backofficeDistPath))
    logger.info(`[Production] Serving backoffice from: ${backofficeDistPath}`)
  } else {
    logger.warn(
      `[Production] Backoffice dist not found at: ${backofficeDistPath}`
    )
  }
}

// Custom JSON parser middleware to handle potentially escaped JSON
app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      if (buf && buf.length) {
        const request = req as any // Cast to any to add rawBody property
        try {
          // Store the raw body for debugging purposes
          request.rawBody = buf.toString((encoding as BufferEncoding) || "utf8")

          // Test if we can parse the body
          JSON.parse(request.rawBody)
        } catch (e: any) {
          // If parsing fails, try to un-escape the string and parse again
          logger.warn(
            `JSON parse error: ${e.message}. Attempting to fix escaped JSON.`
          )
          try {
            const unescaped = request.rawBody
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, "\\")
            JSON.parse(unescaped)
            // If successful, replace the raw body with unescaped version
            request.rawBody = unescaped
          } catch (e2: any) {
            logger.error(`Failed to fix JSON: ${e2.message}`)
          }
        }
      }
    },
  })
)

// Add json-fix middleware after JSON parsing
app.use(jsonFixMiddleware)

app.use(cookieParser())

// Add test endpoint for JSON parsing
app.post("/api/test/json-parser", (req, res) => {
  logger.info("JSON parser test received body:", req.body)
  res.json({
    success: true,
    receivedBody: req.body,
    rawBodyExists: !!req.rawBody,
  })
})

// Endpoint di catch-all specifico per bloccare clienti
app.post("/api/workspaces/:workspaceId/customers/:id/block", (req, res) => {
  const { id, workspaceId } = req.params
  logger.info(
    `🔥 HOTFIX: Block customer catch-all endpoint chiamato per workspace ${workspaceId}, customer ${id}`
  )
  logger.info(
    `⚠️ Questo è un hotfix temporaneo per risolvere il problema del 404 su questo endpoint.`
  )

  // Import customerService on-demand
  const {
    default: customerService,
  } = require("./application/services/customer.service")

  // Try to block the customer
  customerService
    .blockCustomer(id, workspaceId)
    .then((customer) => {
      return res.status(200).json({
        message: "Customer blocked successfully via HOTFIX",
        customer,
      })
    })
    .catch((error) => {
      logger.error("Error in HOTFIX route:", error)
      return res.status(404).json({
        message: error.message || "Failed to block customer",
        error: true,
      })
  })
})

if (hasLandingPage) {
  logger.info(`[LandingPage] Serving static landing page from ${landingPagePath}`)
} else {
  logger.warn(`[LandingPage] Public landing page not found at ${landingPagePath} - requests will redirect to ${loginRedirectUrl}`)
}

app.get(landingRoutes, async (req, res, next) => {
  try {
    if (!hasLandingPage) {
      logger.warn("[LandingPage] Requested but file missing, redirecting to login", { path: req.path })
      return res.redirect(302, loginRedirectUrl)
    }

    const landingEnabled = await platformConfigService.isLandingPageEnabled()
    if (!landingEnabled) {
      logger.info("[LandingPage] Flag disabled - redirecting to login", { path: req.path })
      return res.redirect(302, loginRedirectUrl)
    }

    res.sendFile(landingPagePath, (err) => {
      if (err) {
        logger.error("Failed to send landing page", { error: err })
        next(err)
      }
    })
  } catch (error) {
    logger.error("[LandingPage] Error handling request, redirecting to login", { error })
    return res.redirect(302, loginRedirectUrl)
  }
})

// Short URL routes (must be before API routes to handle /s/:shortCode)
import { shortUrlRoutes } from "./interfaces/http/routes/short-url.routes"
app.use("/", shortUrlRoutes)

// PUBLIC SERVICES ENDPOINT (no auth required for checkout page)
import { prisma } from "@echatbot/database"
import { workspaceValidationMiddleware } from "./interfaces/http/middlewares/workspace-validation.middleware"

app.get(
  "/api/services/public",
  workspaceValidationMiddleware,
  async (req, res) => {
    try {
      const workspaceId = (req as any).workspaceId

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          error: "Workspace ID is required",
        })
      }

      const services = await prisma.services.findMany({
        where: {
          workspaceId: workspaceId,
        },
        orderBy: { name: "asc" },
      })

      logger.info(`📦 PUBLIC: Found ${services.length} services`)

      return res.json({
        success: true,
        data: services,
      })
    } catch (error) {
      logger.error("❌ PUBLIC: Error getting services:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to get services",
      })
    }
  }
)
logger.info("✅ Registered PUBLIC services endpoint at /api/services/public")

// Versioned routes
app.use("/api/v1", apiRouter)

// Default version route (current version)
app.use("/api", apiRouter)

// Mount workspace routes directly at root for legacy compatibility
import { workspaceRoutes as workspaceRoutesRoot } from "./interfaces/http/routes/workspace.routes"
app.use("/workspaces", workspaceRoutesRoot)

// 🌐 PRODUCTION: SPA fallback - serve index.html for all non-API routes
// This MUST be after all API routes to avoid conflicts
if (process.env.NODE_ENV === "production") {
  const frontendDistPath = path.join(backendRoot, "apps/frontend/dist")
  const frontendIndexPath = path.join(frontendDistPath, "index.html")
  
  if (fs.existsSync(frontendIndexPath)) {
    app.get("*", (req, res, next) => {
      // Skip API routes
      if (req.path.startsWith("/api")) {
        return next()
      }
      res.sendFile(frontendIndexPath)
    })
    logger.info(`[Production] SPA fallback enabled for frontend routes`)
  }
}

// Error handling should be last
app.use(errorMiddleware)

// Add diagnostics endpoint for direct access
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    apiVersion: "v1",
  })
})

export default app
