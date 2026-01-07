// Load environment variables BEFORE any other imports (single root .env)
import * as dotenv from "dotenv"
import fs from "fs"
import path from "path"

const findWorkspaceRoot = (startDir: string): string | null => {
  let current = startDir
  while (true) {
    const pkgPath = path.join(current, "package.json")
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
        if (Array.isArray(pkg.workspaces)) {
          return current
        }
      } catch {
        // Ignore invalid package.json during traversal
      }
    }
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

const workspaceRoot =
  findWorkspaceRoot(__dirname) || findWorkspaceRoot(process.cwd())
const envPath = workspaceRoot ? path.join(workspaceRoot, ".env") : null

if (envPath && fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}

const openRouterKeyLength = process.env.OPENROUTER_API_KEY?.length || 0
console.info(
  `[ENV] OPENROUTER_API_KEY loaded: ${openRouterKeyLength > 0} (length=${openRouterKeyLength})`
)

if (process.env.NODE_ENV === "production") {
  // Map tsconfig-style aliases at runtime for compiled JS (e.g. @shared/*).
  // Use explicit paths so it works even when cwd is the monorepo root.
  const path = require("path")
  const moduleAlias = require("module-alias")
  moduleAlias.addAliases({
    "@shared": path.join(__dirname, "shared"),
  })
}

const { prisma } = require("@echatbot/database")
const { createServer } = require("http")
const app = require("./app").default
const { startScheduler, stopScheduler } = require("./scheduler")
// WhatsApp Queue Processor REMOVED - now handled by Scheduler microservice only
// This prevents duplicate processing of the same messages
const { startWhatsAppQueueCleanup } = require("./jobs/whatsapp-queue-processor.job")
const { websocketService } = require("./services/websocket.service")
const logger = require("./utils/logger").default

const PORT = process.env.PORT || 3001

// Start the server with WebSocket support
async function startServer() {
  try {
    await prisma.$connect()
    logger.info("Connected to database")

    // Create HTTP server from Express app
    const httpServer = createServer(app)

    // Initialize WebSocket service
    websocketService.initialize(httpServer)
    logger.info("WebSocket service initialized")

    // Start listening
    httpServer.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`)
      logger.info(`WebSocket server ready on ws://localhost:${PORT}`)

      // Start background scheduler
      startScheduler()

      // WhatsApp Queue Processor REMOVED - handled by Scheduler microservice
      // See apps/scheduler/src/jobs/whatsapp-channel-queue.job.ts

      // Start WhatsApp queue cleanup (daily at 2 AM)
      startWhatsAppQueueCleanup()
    })

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down gracefully")
      stopScheduler()
      // stopWhatsAppQueueProcessor removed - handled by Scheduler
      await websocketService.shutdown()
      await prisma.$disconnect()
      process.exit(0)
    })
  } catch (error) {
    logger.error("Failed to start server:", error)
    process.exit(1)
  }
}

startServer()
