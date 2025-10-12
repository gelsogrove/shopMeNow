import { PrismaClient } from "@prisma/client"
import "dotenv/config"
import { createServer } from "http"
import app from "./app"
import { websocketService } from "./services/websocket.service"
import logger from "./utils/logger"

const PORT = process.env.PORT || 3001
const prisma = new PrismaClient()

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
    })

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down gracefully")
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
