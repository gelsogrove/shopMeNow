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
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const error_middleware_1 = require("./interfaces/http/middlewares/error.middleware");
const json_fix_middleware_1 = require("./interfaces/http/middlewares/json-fix.middleware");
const logging_middleware_1 = require("./middlewares/logging.middleware");
const routes_1 = __importDefault(require("./routes"));
const logger_1 = __importDefault(require("./utils/logger"));
const platform_config_service_1 = require("./services/platform-config.service");
// Import scheduler service
const scheduler_service_1 = require("./services/scheduler.service");
// Initialize Express app
const app = (0, express_1.default)();
// Use process.cwd() for monorepo root (on Heroku cwd = /app = monorepo root)
const backendRoot = process.cwd();
const landingAssetsPath = path_1.default.join(backendRoot, "apps/backend/public");
const landingPagePath = path_1.default.join(landingAssetsPath, "index.html");
const hasLandingPage = fs_1.default.existsSync(landingPagePath);
const landingRoutes = ["/", "/index.html", "/landing", "/landing/index.html"];
const frontendBaseUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const loginRedirectUrl = `${frontendBaseUrl}/auth/login`;
// Initialize and start scheduler service
const schedulerService = new scheduler_service_1.SchedulerService();
schedulerService.startScheduledTasks();
// Logging middleware should be first
app.use(logging_middleware_1.loggingMiddleware);
// 🔒 SECURITY: Force HTTPS in production (trust proxy for Heroku/nginx)
if (process.env.NODE_ENV === "production") {
    app.enable("trust proxy"); // Trust X-Forwarded-* headers
    app.use((req, res, next) => {
        // Check if request is HTTP (not HTTPS)
        if (!req.secure && req.get("x-forwarded-proto") !== "https") {
            logger_1.default.warn(`HTTP request redirected to HTTPS: ${req.url}`, {
                ip: req.ip,
            });
            return res.redirect(301, `https://${req.hostname}${req.url}`);
        }
        next();
    });
}
// Other middleware
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === "production"
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
}));
// Enable pre-flight requests for all routes
app.options("*", (0, cors_1.default)());
// 🔒 SECURITY: Helmet with strict security headers
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // 🔐 FIX GOOGLE GSI: Allow popups for OAuth flow
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    // HSTS: Force HTTPS for 1 year (only in production)
    hsts: process.env.NODE_ENV === "production"
        ? {
            maxAge: 31536000, // 1 year in seconds
            includeSubDomains: true,
            preload: true,
        }
        : false,
    // Content Security Policy
    contentSecurityPolicy: process.env.NODE_ENV === "production"
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
}));
// Serve static files from uploads directory
const uploadsPath = path_1.default.join(backendRoot, "apps/backend/uploads");
app.use("/uploads", express_1.default.static(uploadsPath));
logger_1.default.info(`Serving static files from: ${uploadsPath}`);
if (fs_1.default.existsSync(landingAssetsPath)) {
    app.use("/landing-assets", express_1.default.static(landingAssetsPath));
    logger_1.default.info(`[LandingPage] Serving assets from ${landingAssetsPath}`);
}
// 🌐 PRODUCTION: Serve frontend static files (from Vite build)
// Note: backendRoot = process.cwd() = monorepo root, so use apps/ path
if (process.env.NODE_ENV === "production") {
    const frontendDistPath = path_1.default.join(backendRoot, "apps/frontend/dist");
    if (fs_1.default.existsSync(frontendDistPath)) {
        app.use(express_1.default.static(frontendDistPath));
        logger_1.default.info(`[Production] Serving frontend from: ${frontendDistPath}`);
    }
    else {
        logger_1.default.warn(`[Production] Frontend dist not found at: ${frontendDistPath}`);
    }
    // 🔐 PRODUCTION: Serve backoffice static files (from Vite build)
    const backofficeDistPath = path_1.default.join(backendRoot, "apps/backoffice/dist");
    if (fs_1.default.existsSync(backofficeDistPath)) {
        app.use("/backoffice", express_1.default.static(backofficeDistPath));
        logger_1.default.info(`[Production] Serving backoffice from: ${backofficeDistPath}`);
    }
    else {
        logger_1.default.warn(`[Production] Backoffice dist not found at: ${backofficeDistPath}`);
    }
}
// Custom JSON parser middleware to handle potentially escaped JSON
app.use(express_1.default.json({
    verify: (req, res, buf, encoding) => {
        if (buf && buf.length) {
            const request = req; // Cast to any to add rawBody property
            try {
                // Store the raw body for debugging purposes
                request.rawBody = buf.toString(encoding || "utf8");
                // Test if we can parse the body
                JSON.parse(request.rawBody);
            }
            catch (e) {
                // If parsing fails, try to un-escape the string and parse again
                logger_1.default.warn(`JSON parse error: ${e.message}. Attempting to fix escaped JSON.`);
                try {
                    const unescaped = request.rawBody
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, "\\");
                    JSON.parse(unescaped);
                    // If successful, replace the raw body with unescaped version
                    request.rawBody = unescaped;
                }
                catch (e2) {
                    logger_1.default.error(`Failed to fix JSON: ${e2.message}`);
                }
            }
        }
    },
}));
// Add json-fix middleware after JSON parsing
app.use(json_fix_middleware_1.jsonFixMiddleware);
app.use((0, cookie_parser_1.default)());
// Add test endpoint for JSON parsing
app.post("/api/test/json-parser", (req, res) => {
    logger_1.default.info("JSON parser test received body:", req.body);
    res.json({
        success: true,
        receivedBody: req.body,
        rawBodyExists: !!req.rawBody,
    });
});
// Endpoint di catch-all specifico per bloccare clienti
app.post("/api/workspaces/:workspaceId/customers/:id/block", (req, res) => {
    const { id, workspaceId } = req.params;
    logger_1.default.info(`🔥 HOTFIX: Block customer catch-all endpoint chiamato per workspace ${workspaceId}, customer ${id}`);
    logger_1.default.info(`⚠️ Questo è un hotfix temporaneo per risolvere il problema del 404 su questo endpoint.`);
    // Import customerService on-demand
    const { default: customerService, } = require("./application/services/customer.service");
    // Try to block the customer
    customerService
        .blockCustomer(id, workspaceId)
        .then((customer) => {
        return res.status(200).json({
            message: "Customer blocked successfully via HOTFIX",
            customer,
        });
    })
        .catch((error) => {
        logger_1.default.error("Error in HOTFIX route:", error);
        return res.status(404).json({
            message: error.message || "Failed to block customer",
            error: true,
        });
    });
});
if (hasLandingPage) {
    logger_1.default.info(`[LandingPage] Serving static landing page from ${landingPagePath}`);
}
else {
    logger_1.default.warn(`[LandingPage] Public landing page not found at ${landingPagePath} - requests will redirect to ${loginRedirectUrl}`);
}
app.get(landingRoutes, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!hasLandingPage) {
            logger_1.default.warn("[LandingPage] Requested but file missing, redirecting to login", { path: req.path });
            return res.redirect(302, loginRedirectUrl);
        }
        const landingEnabled = yield platform_config_service_1.platformConfigService.isLandingPageEnabled();
        if (!landingEnabled) {
            logger_1.default.info("[LandingPage] Flag disabled - redirecting to login", { path: req.path });
            return res.redirect(302, loginRedirectUrl);
        }
        res.sendFile(landingPagePath, (err) => {
            if (err) {
                logger_1.default.error("Failed to send landing page", { error: err });
                next(err);
            }
        });
    }
    catch (error) {
        logger_1.default.error("[LandingPage] Error handling request, redirecting to login", { error });
        return res.redirect(302, loginRedirectUrl);
    }
}));
// Short URL routes (must be before API routes to handle /s/:shortCode)
const short_url_routes_1 = require("./interfaces/http/routes/short-url.routes");
app.use("/", short_url_routes_1.shortUrlRoutes);
// PUBLIC SERVICES ENDPOINT (no auth required for checkout page)
const database_1 = require("@echatbot/database");
const workspace_validation_middleware_1 = require("./interfaces/http/middlewares/workspace-validation.middleware");
app.get("/api/services/public", workspace_validation_middleware_1.workspaceValidationMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const workspaceId = req.workspaceId;
        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                error: "Workspace ID is required",
            });
        }
        const services = yield database_1.prisma.services.findMany({
            where: {
                workspaceId: workspaceId,
            },
            orderBy: { name: "asc" },
        });
        logger_1.default.info(`📦 PUBLIC: Found ${services.length} services`);
        return res.json({
            success: true,
            data: services,
        });
    }
    catch (error) {
        logger_1.default.error("❌ PUBLIC: Error getting services:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to get services",
        });
    }
}));
logger_1.default.info("✅ Registered PUBLIC services endpoint at /api/services/public");
// Versioned routes
app.use("/api/v1", routes_1.default);
// Default version route (current version)
app.use("/api", routes_1.default);
// Mount workspace routes directly at root for legacy compatibility
const workspace_routes_1 = require("./interfaces/http/routes/workspace.routes");
app.use("/workspaces", workspace_routes_1.workspaceRoutes);
// 🌐 PRODUCTION: SPA fallback - serve index.html for all non-API routes
// This MUST be after all API routes to avoid conflicts
if (process.env.NODE_ENV === "production") {
    const frontendDistPath = path_1.default.join(backendRoot, "apps/frontend/dist");
    const frontendIndexPath = path_1.default.join(frontendDistPath, "index.html");
    if (fs_1.default.existsSync(frontendIndexPath)) {
        app.get("*", (req, res, next) => {
            // Skip API routes
            if (req.path.startsWith("/api")) {
                return next();
            }
            res.sendFile(frontendIndexPath);
        });
        logger_1.default.info(`[Production] SPA fallback enabled for frontend routes`);
    }
}
// Error handling should be last
app.use(error_middleware_1.errorMiddleware);
// Add diagnostics endpoint for direct access
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        apiVersion: "v1",
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map