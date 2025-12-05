import { prisma } from "@echatbot/database"
import "dotenv/config"
import { createServer } from "http"
import app from "./app"
import { startScheduler, stopScheduler } from "./scheduler"
// WhatsApp Queue Processor REMOVED - now handled by Scheduler microservice only
// This prevents duplicate processing of the same messages
import { startWhatsAppQueueCleanup } from "./jobs/whatsapp-queue-processor.job"
import { websocketService } from "./services/websocket.service"
import logger from "./utils/logger"

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
