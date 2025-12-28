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
exports.CreditNoteService = void 0;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../utils/logger"));
class CreditNoteService {
    /**
     * Create a credit note for a delivered order (partial refund)
     * Business Rules:
     * - Only DELIVERED orders can have credit notes
     * - Amount must be positive and less than order total
     * - Credit note code format: NC-{orderCode}
     */
    createCreditNote(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Validate order exists and belongs to workspace
                const order = yield database_1.prisma.orders.findFirst({
                    where: {
                        id: data.orderId,
                        workspaceId: data.workspaceId,
                    },
                    include: {
                        customer: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                        creditNotes: true,
                    },
                });
                if (!order) {
                    throw new Error("Ordine non trovato");
                }
                // 2. Validate order is CONFIRMED or DELIVERED
                if (order.status !== "DELIVERED" && order.status !== "CONFIRMED") {
                    throw new Error(`La nota di credito può essere emessa solo per ordini confermati o consegnati. Stato attuale: ${order.status}`);
                }
                // 3. Validate amount
                if (data.amount <= 0) {
                    throw new Error("L'importo della nota di credito deve essere maggiore di zero");
                }
                // 4. Calculate total existing credit notes for this order
                const existingCreditNotesTotal = order.creditNotes.reduce((sum, cn) => sum + cn.amount, 0);
                // 5. Validate new credit note doesn't exceed remaining amount
                const remainingAmount = order.totalAmount - existingCreditNotesTotal;
                if (data.amount > remainingAmount) {
                    throw new Error(`L'importo supera il valore residuo dell'ordine. Massimo consentito: €${remainingAmount.toFixed(2)}`);
                }
                // 6. Generate credit note code
                // Format: NC-{orderCode} or NC-{orderCode}-2 for multiple credit notes
                const creditNoteNumber = order.creditNotes.length + 1;
                const creditNoteCode = creditNoteNumber === 1
                    ? `NC-${order.orderCode}`
                    : `NC-${order.orderCode}-${creditNoteNumber}`;
                // 7. Create credit note
                const creditNote = yield database_1.prisma.creditNote.create({
                    data: {
                        creditNoteCode,
                        orderId: data.orderId,
                        amount: data.amount,
                        reason: data.reason,
                        createdById: data.createdById,
                    },
                    include: {
                        order: {
                            select: {
                                id: true,
                                orderCode: true,
                                status: true,
                                totalAmount: true,
                                customer: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                });
                logger_1.default.info("Credit note created:", {
                    creditNoteId: creditNote.id,
                    creditNoteCode: creditNote.creditNoteCode,
                    orderId: data.orderId,
                    orderCode: order.orderCode,
                    amount: data.amount,
                    reason: data.reason,
                });
                return creditNote;
            }
            catch (error) {
                logger_1.default.error("Error creating credit note:", error);
                throw error;
            }
        });
    }
    /**
     * Get all credit notes for an order
     */
    getCreditNotesByOrderId(orderId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // First verify order belongs to workspace
                const order = yield database_1.prisma.orders.findFirst({
                    where: {
                        id: orderId,
                        workspaceId,
                    },
                });
                if (!order) {
                    throw new Error("Ordine non trovato");
                }
                const creditNotes = yield database_1.prisma.creditNote.findMany({
                    where: {
                        orderId,
                    },
                    include: {
                        order: {
                            select: {
                                id: true,
                                orderCode: true,
                                status: true,
                                totalAmount: true,
                                customer: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
                return creditNotes;
            }
            catch (error) {
                logger_1.default.error("Error fetching credit notes:", error);
                throw error;
            }
        });
    }
    /**
     * Get a single credit note by ID
     */
    getCreditNoteById(creditNoteId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const creditNote = yield database_1.prisma.creditNote.findFirst({
                    where: {
                        id: creditNoteId,
                        order: {
                            workspaceId,
                        },
                    },
                    include: {
                        order: {
                            select: {
                                id: true,
                                orderCode: true,
                                status: true,
                                totalAmount: true,
                                customer: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                });
                return creditNote;
            }
            catch (error) {
                logger_1.default.error("Error fetching credit note:", error);
                throw error;
            }
        });
    }
    /**
     * Get all credit notes for a workspace (for reporting)
     */
    getAllCreditNotes(workspaceId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const where = {
                    order: {
                        workspaceId,
                    },
                };
                if ((options === null || options === void 0 ? void 0 : options.startDate) || (options === null || options === void 0 ? void 0 : options.endDate)) {
                    where.createdAt = {};
                    if (options.startDate) {
                        where.createdAt.gte = options.startDate;
                    }
                    if (options.endDate) {
                        where.createdAt.lte = options.endDate;
                    }
                }
                if (options === null || options === void 0 ? void 0 : options.customerId) {
                    where.order.customerId = options.customerId;
                }
                const creditNotes = yield database_1.prisma.creditNote.findMany({
                    where,
                    include: {
                        order: {
                            select: {
                                id: true,
                                orderCode: true,
                                status: true,
                                totalAmount: true,
                                customer: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
                return creditNotes;
            }
            catch (error) {
                logger_1.default.error("Error fetching all credit notes:", error);
                throw error;
            }
        });
    }
    /**
     * Calculate total credit notes amount for an order
     */
    getTotalCreditNotesForOrder(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield database_1.prisma.creditNote.aggregate({
                where: { orderId },
                _sum: { amount: true },
            });
            return result._sum.amount || 0;
        });
    }
    /**
     * Delete a credit note
     */
    deleteCreditNote(creditNoteId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Verify credit note exists and belongs to workspace
                const creditNote = yield database_1.prisma.creditNote.findFirst({
                    where: {
                        id: creditNoteId,
                        order: {
                            workspaceId,
                        },
                    },
                });
                if (!creditNote) {
                    throw new Error("Nota di credito non trovata");
                }
                yield database_1.prisma.creditNote.delete({
                    where: { id: creditNoteId },
                });
                logger_1.default.info("Credit note deleted:", {
                    creditNoteId,
                    creditNoteCode: creditNote.creditNoteCode,
                });
            }
            catch (error) {
                logger_1.default.error("Error deleting credit note:", error);
                throw error;
            }
        });
    }
}
exports.CreditNoteService = CreditNoteService;
//# sourceMappingURL=credit-note.service.js.map