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
exports.OtpService = void 0;
const speakeasy = __importStar(require("speakeasy"));
const error_middleware_1 = require("../../interfaces/http/middlewares/error.middleware");
const logger_1 = __importDefault(require("../../utils/logger"));
class OtpService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    setupTwoFactor(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get user email for QR code label
            const user = yield this.prisma.user.findUnique({
                where: { id: userId },
                select: { email: true },
            });
            if (!user) {
                throw new error_middleware_1.AppError(404, "User not found");
            }
            // Generate secret
            const secret = speakeasy.generateSecret({
                name: `eChatbot:${user.email}`, // Format: "eChatbot:email@example.com"
                issuer: "eChatbot", // This is what appears as app name in authenticator
                length: 32,
            });
            // Save secret to user
            yield this.prisma.user.update({
                where: { id: userId },
                data: { twoFactorSecret: secret.base32 },
            });
            // Return otpauth URL directly (NOT data URL)
            const otpauthUrl = secret.otpauth_url;
            if (!otpauthUrl) {
                throw new error_middleware_1.AppError(500, "Failed to generate OTP auth URL");
            }
            return otpauthUrl;
        });
    }
    verifyTwoFactor(userId, token) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get user's secret
            const user = yield this.prisma.user.findUnique({
                where: { id: userId },
                select: { twoFactorSecret: true, email: true },
            });
            if (!(user === null || user === void 0 ? void 0 : user.twoFactorSecret)) {
                throw new error_middleware_1.AppError(400, "2FA not set up for this user");
            }
            // Verify token with extended window for time drift
            const isValid = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: "base32",
                token: token,
                window: 2, // Allow 2 steps (60 seconds) before/after for time drift
            });
            logger_1.default.debug(`[2FA Verify] userId=${userId}, isValid=${isValid}`);
            return isValid;
        });
    }
    /**
     * ⚠️ DEPRECATED: otpToken table was removed during database cleanup
     * Use setupTwoFactor/verifyTwoFactor instead for 2FA functionality
     */
    generateOtp(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new error_middleware_1.AppError(501, "OTP generation is no longer supported. Use 2FA instead.");
            /*
            // Generate a 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString()
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        
            // Hash the OTP before storing
            const otpHash = crypto.createHash("sha256").update(otp).digest("hex")
        
            // Store the OTP
            await this.prisma.otpToken.create({
              data: {
                userId,
                otpHash,
                expiresAt,
              },
            })
        
            return otp
            */
        });
    }
    /**
     * ⚠️ DEPRECATED: otpToken table was removed during database cleanup
     * Use setupTwoFactor/verifyTwoFactor instead for 2FA functionality
     */
    verifyOtp(userId, otp) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new error_middleware_1.AppError(501, "OTP verification is no longer supported. Use 2FA instead.");
            /*
            // Hash the provided OTP
            const otpHash = crypto.createHash("sha256").update(otp).digest("hex")
        
            // Find valid OTP
            const validOtp = await this.prisma.otpToken.findFirst({
              where: {
                userId,
                otpHash,
                expiresAt: {
                  gt: new Date(),
                },
                usedAt: null,
              },
            })
        
            if (!validOtp) {
              return false
            }
        
            // Mark OTP as used
            await this.prisma.otpToken.update({
              where: { id: validOtp.id },
              data: { usedAt: new Date() },
            })
        
            return true
            */
        });
    }
    /**
     * ⚠️ DEPRECATED: otpToken table was removed during database cleanup
     */
    cleanupExpiredOtps() {
        return __awaiter(this, void 0, void 0, function* () {
            // No-op: table no longer exists
            /*
            await this.prisma.otpToken.deleteMany({
              where: {
                OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
              },
            })
            */
        });
    }
}
exports.OtpService = OtpService;
//# sourceMappingURL=otp.service.js.map