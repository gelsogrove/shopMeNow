"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.authMiddleware = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const prisma_1 = require("../lib/prisma");
const logger_1 = __importDefault(require("../utils/logger"));
const authMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        // 🛡️ PRIORITY: Authorization header FIRST, then cookies
        // This ensures that when frontend clears localStorage and sends new token in header,
        // we use the new token instead of stale cookie from previous session
        let token;
        // Check Authorization header FIRST (priority)
        const authHeader = (_a = req.headers) === null || _a === void 0 ? void 0 : _a.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const headerToken = authHeader.split(" ")[1];
            if (headerToken && headerToken.trim() !== "") {
                token = headerToken;
                logger_1.default.info("Using token from Authorization header");
            }
        }
        // Fallback to cookies only if no header token
        if (!token && ((_b = req.cookies) === null || _b === void 0 ? void 0 : _b.auth_token)) {
            token = req.cookies.auth_token;
            logger_1.default.info("Using token from cookie (no Authorization header)");
        }
        if (!token) {
            return res
                .status(401)
                .json({ message: "Authentication token is required" });
        }
        // SECURITY: Use config.jwtSecret which validates the secret is set
        const { config } = yield Promise.resolve().then(() => __importStar(require("../config")));
        const decoded = (0, jsonwebtoken_1.verify)(token, config.jwtSecret);
        // Use either id or userId from the token
        const userId = decoded.id || decoded.userId;
        if (!userId) {
            logger_1.default.error("No user ID found in token:", decoded);
            return res.status(401).json({ message: "Invalid token format" });
        }
        const user = yield prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: {
                workspaces: {
                    include: {
                        workspace: true,
                    },
                },
            },
        });
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        // Add user to request object
        req.user = {
            id: user.id, // Include both id and userId for consistency
            userId: user.id,
            email: user.email,
            role: user.role,
            workspaces: user.workspaces.map((w) => ({
                id: w.workspace.id,
                role: w.role,
            })),
        };
        // Get workspaceId from query params or headers
        const workspaceId = ((_c = req.query) === null || _c === void 0 ? void 0 : _c.workspaceId) ||
            ((_d = req.headers) === null || _d === void 0 ? void 0 : _d["x-workspace-id"]) ||
            ((_e = req.params) === null || _e === void 0 ? void 0 : _e.workspaceId);
        logger_1.default.info("workspaceId extraction in auth middleware:", {
            fromQuery: (_f = req.query) === null || _f === void 0 ? void 0 : _f.workspaceId,
            fromHeaders: (_g = req.headers) === null || _g === void 0 ? void 0 : _g["x-workspace-id"],
            fromParams: (_h = req.params) === null || _h === void 0 ? void 0 : _h.workspaceId,
            result: workspaceId,
            requestPath: req.path,
            url: req.originalUrl,
        });
        // Store the workspaceId if present
        if (workspaceId) {
            ;
            req.workspaceId = workspaceId;
        }
        next();
    }
    catch (error) {
        logger_1.default.error("Auth middleware error:", error);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
});
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map