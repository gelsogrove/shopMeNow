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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables BEFORE any other imports
require("dotenv/config");
const database_1 = require("@echatbot/database");
const http_1 = require("http");
const app_1 = __importDefault(require("./app"));
const scheduler_1 = require("./scheduler");
// WhatsApp Queue Processor REMOVED - now handled by Scheduler microservice only
// This prevents duplicate processing of the same messages
const whatsapp_queue_processor_job_1 = require("./jobs/whatsapp-queue-processor.job");
const websocket_service_1 = require("./services/websocket.service");
const logger_1 = __importDefault(require("./utils/logger"));
const PORT = process.env.PORT || 3001;
// Start the server with WebSocket support
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield database_1.prisma.$connect();
            logger_1.default.info("Connected to database");
            // Create HTTP server from Express app
            const httpServer = (0, http_1.createServer)(app_1.default);
            // Initialize WebSocket service
            websocket_service_1.websocketService.initialize(httpServer);
            logger_1.default.info("WebSocket service initialized");
            // Start listening
            httpServer.listen(PORT, () => {
                logger_1.default.info(`Server is running on port ${PORT}`);
                logger_1.default.info(`WebSocket server ready on ws://localhost:${PORT}`);
                // Start background scheduler
                (0, scheduler_1.startScheduler)();
                // WhatsApp Queue Processor REMOVED - handled by Scheduler microservice
                // See apps/scheduler/src/jobs/whatsapp-challenge-queue.job.ts
                // Start WhatsApp queue cleanup (daily at 2 AM)
                (0, whatsapp_queue_processor_job_1.startWhatsAppQueueCleanup)();
            });
            // Graceful shutdown
            process.on("SIGTERM", () => __awaiter(this, void 0, void 0, function* () {
                logger_1.default.info("SIGTERM received, shutting down gracefully");
                (0, scheduler_1.stopScheduler)();
                // stopWhatsAppQueueProcessor removed - handled by Scheduler
                yield websocket_service_1.websocketService.shutdown();
                yield database_1.prisma.$disconnect();
                process.exit(0);
            }));
        }
        catch (error) {
            logger_1.default.error("Failed to start server:", error);
            process.exit(1);
        }
    });
}
startServer();
//# sourceMappingURL=index.js.map