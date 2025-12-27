"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables BEFORE any other imports
require("dotenv/config");
if (process.env.NODE_ENV === "production") {
    // Map tsconfig-style aliases at runtime for compiled JS (e.g. @shared/*).
    // Use explicit paths so it works even when cwd is the monorepo root.
    const path = require("path");
    const moduleAlias = require("module-alias");
    moduleAlias.addAliases({
        "@shared": path.join(__dirname, "shared"),
    });
}
const { prisma } = require("@echatbot/database");
const { createServer } = require("http");
const app = require("./app").default;
const { startScheduler, stopScheduler } = require("./scheduler");
// WhatsApp Queue Processor REMOVED - now handled by Scheduler microservice only
// This prevents duplicate processing of the same messages
const { startWhatsAppQueueCleanup } = require("./jobs/whatsapp-queue-processor.job");
const { websocketService } = require("./services/websocket.service");
const logger = require("./utils/logger").default;
const PORT = process.env.PORT || 3001;
// Start the server with WebSocket support
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield prisma.$connect();
            logger.info("Connected to database");
            // Create HTTP server from Express app
            const httpServer = createServer(app);
            // Initialize WebSocket service
            websocketService.initialize(httpServer);
            logger.info("WebSocket service initialized");
            // Start listening
            httpServer.listen(PORT, () => {
                logger.info(`Server is running on port ${PORT}`);
                logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
                // Start background scheduler
                startScheduler();
                // WhatsApp Queue Processor REMOVED - handled by Scheduler microservice
                // See apps/scheduler/src/jobs/whatsapp-challenge-queue.job.ts
                // Start WhatsApp queue cleanup (daily at 2 AM)
                startWhatsAppQueueCleanup();
            });
            // Graceful shutdown
            process.on("SIGTERM", () => __awaiter(this, void 0, void 0, function* () {
                logger.info("SIGTERM received, shutting down gracefully");
                stopScheduler();
                // stopWhatsAppQueueProcessor removed - handled by Scheduler
                yield websocketService.shutdown();
                yield prisma.$disconnect();
                process.exit(0);
            }));
        }
        catch (error) {
            logger.error("Failed to start server:", error);
            process.exit(1);
        }
    });
}
startServer();
//# sourceMappingURL=index.js.map