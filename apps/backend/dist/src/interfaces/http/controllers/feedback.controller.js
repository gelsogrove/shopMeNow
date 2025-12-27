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
exports.FeedbackController = void 0;
const database_1 = require("@echatbot/database");
const secure_token_service_1 = require("../../../application/services/secure-token.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
// prisma imported
/**
 * Controller for customer feedback (public access with token)
 */
class FeedbackController {
    constructor() {
        this.secureTokenService = new secure_token_service_1.SecureTokenService();
    }
    /**
     * Get customer feedback by ID
     * Used for displaying existing feedback
     */
    getFeedback(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { token } = req.query;
                if (!token || typeof token !== "string") {
                    return res.status(400).json({ error: "Token richiesto" });
                }
                // Validate token
                const validation = yield this.secureTokenService.validateToken(token);
                if (!validation.valid || !validation.data) {
                    return res.status(401).json({ error: "Token invalido o scaduto" });
                }
                const { customerId, workspaceId } = validation.data;
                // Get customer feedback
                const feedback = yield database_1.prisma.customerFeedback.findFirst({
                    where: {
                        customerId,
                        workspaceId,
                    },
                    orderBy: { createdAt: "desc" },
                    include: {
                        customer: {
                            select: {
                                name: true,
                                email: true,
                            },
                        },
                    },
                });
                res.json({
                    feedback: feedback || null,
                    customer: validation.data,
                });
            }
            catch (error) {
                logger_1.default.error("Error getting feedback:", error);
                next(error);
            }
        });
    }
    /**
     * Submit customer feedback (public endpoint with token validation)
     */
    submitFeedback(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { token, rating, comment } = req.body;
                // Validation
                if (!token) {
                    return res.status(400).json({ error: "Token richiesto" });
                }
                if (!rating || rating < 1 || rating > 5) {
                    return res.status(400).json({
                        error: "Valutazione obbligatoria",
                        message: "La valutazione deve essere tra 1 e 5 stelle",
                    });
                }
                // Validate token
                const validation = yield this.secureTokenService.validateToken(token);
                if (!validation.valid || !validation.data) {
                    return res.status(401).json({
                        error: "Token invalido o scaduto",
                        message: "Il link è scaduto o non è valido. Richiedi un nuovo link.",
                    });
                }
                const { customerId, workspaceId } = validation.data;
                const campaignId = (_a = validation.payload) === null || _a === void 0 ? void 0 : _a.campaignId;
                // Check if customer already submitted feedback recently (avoid duplicates)
                const existingFeedback = yield database_1.prisma.customerFeedback.findFirst({
                    where: {
                        customerId,
                        workspaceId,
                        createdAt: {
                            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                        },
                    },
                });
                if (existingFeedback) {
                    // Update existing feedback instead of creating duplicate
                    const updated = yield database_1.prisma.customerFeedback.update({
                        where: { id: existingFeedback.id },
                        data: {
                            rating,
                            comment: comment || null,
                        },
                    });
                    logger_1.default.info(`Updated feedback ${updated.id} for customer ${customerId} (rating: ${rating})`);
                    return res.json({
                        message: "Grazie! La tua recensione è stata aggiornata.",
                        feedback: updated,
                    });
                }
                // Create new feedback
                const feedback = yield database_1.prisma.customerFeedback.create({
                    data: {
                        customerId,
                        workspaceId,
                        campaignId: campaignId || null,
                        rating,
                        comment: comment || null,
                    },
                });
                logger_1.default.info(`Created feedback ${feedback.id} for customer ${customerId} (rating: ${rating})`);
                // Mark token as used
                yield this.secureTokenService.markTokenAsUsed(token);
                res.status(201).json({
                    message: "Grazie per il tuo feedback! 🙏",
                    feedback,
                });
            }
            catch (error) {
                logger_1.default.error("Error submitting feedback:", error);
                next(error);
            }
        });
    }
    /**
     * Get all feedbacks for a workspace (admin endpoint)
     */
    getWorkspaceFeedbacks(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { page = 1, limit = 20 } = req.query;
                const skip = (Number(page) - 1) * Number(limit);
                const [feedbacks, total] = yield Promise.all([
                    database_1.prisma.customerFeedback.findMany({
                        where: { workspaceId },
                        include: {
                            customer: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    phone: true,
                                },
                            },
                            campaign: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                        orderBy: { createdAt: "desc" },
                        skip,
                        take: Number(limit),
                    }),
                    database_1.prisma.customerFeedback.count({ where: { workspaceId } }),
                ]);
                // Calculate average rating
                const avgRating = yield database_1.prisma.customerFeedback.aggregate({
                    where: { workspaceId },
                    _avg: { rating: true },
                });
                res.json({
                    data: feedbacks,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        totalPages: Math.ceil(total / Number(limit)),
                    },
                    stats: {
                        averageRating: avgRating._avg.rating || 0,
                        totalFeedbacks: total,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error getting workspace feedbacks:", error);
                next(error);
            }
        });
    }
}
exports.FeedbackController = FeedbackController;
//# sourceMappingURL=feedback.controller.js.map