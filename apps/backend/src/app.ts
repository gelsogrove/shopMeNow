import cookieParser from "cookie-parser"
import cors from "cors"
import express from "express"
import fs from "fs"
import helmet from "helmet"
import path from "path"

import { errorMiddleware } from "./interfaces/http/middlewares/error.middleware"
import { authMiddleware } from "./interfaces/http/middlewares/auth.middleware"
import { jsonFixMiddleware } from "./interfaces/http/middlewares/json-fix.middleware"
import { sessionValidationMiddleware } from "./interfaces/http/middlewares/session-validation.middleware"
import { loggingMiddleware } from "./middlewares/logging.middleware"
import apiRouter from "./routes"
import logger from "./utils/logger"
import { prisma } from "@echatbot/database"

// Extend Request interface to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: string
    }
  }
}

// Initialize Express app
const app = express()
// Use process.cwd() for monorepo root (on Heroku cwd = /app = monorepo root)
const backendRoot = process.cwd()

const workspaceOriginCache = {
  values: new Set<string>(),
  lastLoaded: 0,
  pending: null as Promise<void> | null,
}

const WORKSPACE_ORIGIN_CACHE_TTL_MS = 60_000

const normalizeOrigin = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    return url.origin.toLowerCase()
  } catch (error) {
    logger.warn("Invalid workspace website URL for CORS allowlist", { value, error })
    return null
  }
}

const parseEnvOrigins = (value?: string): string[] => {
  if (!value) return []
  return value
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin))
}

const refreshWorkspaceOrigins = async () => {
  const workspaceUrls = await prisma.workspace.findMany({
    select: { websiteUrl: true, url: true },
  })

  const next = new Set<string>()
  for (const workspace of workspaceUrls) {
    const websiteOrigin = normalizeOrigin(workspace.websiteUrl)
    const legacyOrigin = normalizeOrigin(workspace.url)
    if (websiteOrigin) next.add(websiteOrigin)
    if (legacyOrigin) next.add(legacyOrigin)
  }

  workspaceOriginCache.values = next
  workspaceOriginCache.lastLoaded = Date.now()
}

const ensureWorkspaceOrigins = async (force = false) => {
  const isFresh =
    Date.now() - workspaceOriginCache.lastLoaded < WORKSPACE_ORIGIN_CACHE_TTL_MS
  if (!force && isFresh) return
  if (workspaceOriginCache.pending) {
    return workspaceOriginCache.pending
  }
  workspaceOriginCache.pending = refreshWorkspaceOrigins()
    .catch((error) => {
      logger.error("Failed to refresh workspace origins for CORS", { error })
    })
    .finally(() => {
      workspaceOriginCache.pending = null
    })
  return workspaceOriginCache.pending
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true) // Allow requests with no origin (mobile apps, Postman)
    }

    const normalized = origin.toLowerCase()

    const envOrigins = parseEnvOrigins(
      process.env.CORS_ORIGINS || process.env.CORS_ORIGIN
    )

    const defaultOrigins =
      process.env.NODE_ENV === "production"
        ? [
            process.env.FRONTEND_URL || "https://echatbot.ai",
            "https://www.echatbot.ai",
            process.env.BACKOFFICE_URL || "https://backoffice.echatbot.ai",
            "https://echatbot-backoffice-3497e777ec08.herokuapp.com",
          ]
        : [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:5173",
          ]

    const allowedOrigins = Array.from(
      new Set(
        [...defaultOrigins, ...envOrigins]
          .map((value) => normalizeOrigin(value))
          .filter((value): value is string => Boolean(value))
      )
    )

    if (allowedOrigins.includes(normalized)) {
      return callback(null, true)
    }

    if (workspaceOriginCache.values.has(normalized)) {
      return callback(null, true)
    }

    ensureWorkspaceOrigins(true)
      .then(() => {
        if (workspaceOriginCache.values.has(normalized)) {
          return callback(null, true)
        }
        return callback(null, false)
      })
      .catch(() => callback(null, false))
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-workspace-id",
    "X-Session-Id",
    "x-visitor-id",
    "x-hub-signature-256",
  ],
  exposedHeaders: ["set-cookie", "Location", "location"],
}

// ⚠️  NOTE: Scheduler is now a separate microservice (apps/scheduler)
// Run with: npm run dev:all (starts backend + frontend + scheduler)
// Scheduler handles: WhatsApp queue, billing, cleanups, etc.

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
app.use(cors(corsOptions))

// Enable pre-flight requests for all routes
app.options("*", cors(corsOptions))

// 🔒 SECURITY: Helmet with strict security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // 🔐 FIX GOOGLE GSI: Disable COOP for OAuth popup flow
    crossOriginOpenerPolicy: false,
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
                "https://accounts.google.com",
                "https://accounts.google.com/gsi/",
                "https://*.gstatic.com",
                "https://www.google.com",
                "https://www.gstatic.com",
                "https://www.googletagmanager.com",
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
                "https://www.google.com",
              ],
              childSrc: [
                "https://accounts.google.com",
                "https://accounts.google.com/gsi/",
                "https://www.google.com",
              ],
              frameAncestors: [
                "'self'",
                "https://accounts.google.com",
                "https://www.google.com",
              ],
              upgradeInsecureRequests: [],
            },
          }
        : false,
    // X-Frame-Options: prevent clickjacking (disabled to allow Google OAuth)
    frameguard: false,
    // X-Content-Type-Options: prevent MIME sniffing
    noSniff: true,
    // X-XSS-Protection: enable browser XSS filter
    xssFilter: true,
  })
)

// 🔒 SECURITY (TASK06): Serve ONLY public uploads directory
// Private files are served via authenticated endpoint /api/v1/files/:key
// Calculate correct path: in dev __dirname = apps/backend/src, in prod = apps/backend/dist
const publicUploadsPath = path.resolve(__dirname, "..", "uploads", "public")
app.use("/uploads/public", express.static(publicUploadsPath))
logger.info(`[SECURITY] Serving public files from: ${publicUploadsPath}`)

// 🎫 SUPPORT TICKETS: Serve support ticket attachments (authenticated access)
// Note: These should be accessible only to ticket owner and admins
// For now serving statically - TODO: add authentication middleware
const supportUploadsPath = path.resolve(__dirname, "..", "uploads", "support-tickets")
app.use("/uploads/support-tickets", express.static(supportUploadsPath))
logger.info(`[SUPPORT] Serving support ticket attachments from: ${supportUploadsPath}`)

logger.info(`[SECURITY] Private files require authentication via /api/v1/files/:key`)

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

  // 🔐 BACKOFFICE: Now deployed as separate app on backoffice.echatbot.ai
  // No static serving needed - backoffice makes CORS API calls
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

// 🔒 SECURITY: Test endpoint only in development (TASK07)
if (process.env.NODE_ENV !== "production") {
  app.post("/api/v1/test/json-parser", (req, res) => {
    logger.info("JSON parser test received body:", req.body)
    res.json({
      success: true,
      receivedBody: req.body,
      rawBodyExists: !!req.rawBody,
    })
  })
}

// Endpoint di catch-all specifico per bloccare clienti
app.post(
  "/api/workspaces/:workspaceId/customers/:id/block",
  authMiddleware,
  sessionValidationMiddleware,
  (req, res) => {
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
  }
)

// Short URL routes (must be before API routes to handle /s/:shortCode)
import { shortUrlRoutes } from "./interfaces/http/routes/short-url.routes"
app.use("/", shortUrlRoutes)

// PUBLIC SERVICES ENDPOINT (no auth required for checkout page)
import { workspaceValidationMiddleware } from "./interfaces/http/middlewares/workspace-validation.middleware"

app.get(
  "/api/v1/services/public",
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

// Versioned routes - API v1 is the only endpoint
app.use("/api/v1", apiRouter)

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
