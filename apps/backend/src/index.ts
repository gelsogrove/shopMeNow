// Load environment variables BEFORE any other imports
import "dotenv/config"

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
      // See apps/scheduler/src/jobs/whatsapp-challenge-queue.job.ts

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
