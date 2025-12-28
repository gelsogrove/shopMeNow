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
exports.RegistrationAttemptsService = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
class RegistrationAttemptsService {
    constructor(prisma) {
        this.MAX_ATTEMPTS = 5;
        this.ATTEMPT_WINDOW_HOURS = 24; // Reset attempts after 24 hours
        this.prisma = prisma;
    }
    /**
     * Record a registration attempt for a phone number
     */
    recordAttempt(phoneNumber, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if there's an existing record
                const existing = yield this.prisma.registrationAttempts.findFirst({
                    where: {
                        phoneNumber,
                        workspaceId
                    }
                });
                const now = new Date();
                const windowStart = new Date(now.getTime() - (this.ATTEMPT_WINDOW_HOURS * 60 * 60 * 1000));
                if (existing) {
                    // Check if attempts are within the time window
                    if (existing.lastAttemptAt < windowStart) {
                        // Reset attempts if outside the window
                        const updated = yield this.prisma.registrationAttempts.update({
                            where: { id: existing.id },
                            data: {
                                attemptCount: 1,
                                lastAttemptAt: now,
                                isBlocked: false
                            }
                        });
                        logger_1.default.info(`[REGISTRATION_ATTEMPTS] Reset attempts for ${phoneNumber} in workspace ${workspaceId}`);
                        return this.mapToInterface(updated);
                    }
                    else {
                        // Increment attempts within the window
                        const newCount = existing.attemptCount + 1;
                        const isBlocked = newCount >= this.MAX_ATTEMPTS;
                        const updated = yield this.prisma.registrationAttempts.update({
                            where: { id: existing.id },
                            data: {
                                attemptCount: newCount,
                                lastAttemptAt: now,
                                isBlocked: isBlocked
                            }
                        });
                        if (isBlocked) {
                            logger_1.default.warn(`[REGISTRATION_ATTEMPTS] User ${phoneNumber} blocked after ${newCount} attempts in workspace ${workspaceId}`);
                            // Also block the customer if they exist
                            yield this.blockCustomer(phoneNumber, workspaceId);
                        }
                        else {
                            logger_1.default.info(`[REGISTRATION_ATTEMPTS] User ${phoneNumber} has ${newCount}/${this.MAX_ATTEMPTS} attempts in workspace ${workspaceId}`);
                        }
                        return this.mapToInterface(updated);
                    }
                }
                else {
                    // Create new record
                    const created = yield this.prisma.registrationAttempts.create({
                        data: {
                            phoneNumber,
                            workspaceId,
                            attemptCount: 1,
                            lastAttemptAt: now,
                            isBlocked: false
                        }
                    });
                    logger_1.default.info(`[REGISTRATION_ATTEMPTS] First attempt recorded for ${phoneNumber} in workspace ${workspaceId}`);
                    return this.mapToInterface(created);
                }
            }
            catch (error) {
                logger_1.default.error(`[REGISTRATION_ATTEMPTS] Error recording attempt for ${phoneNumber}:`, error);
                throw error;
            }
        });
    }
    /**
     * Check if a phone number is blocked due to too many registration attempts
     */
    isBlocked(phoneNumber, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const attempt = yield this.prisma.registrationAttempts.findFirst({
                    where: {
                        phoneNumber,
                        workspaceId,
                        isBlocked: true
                    }
                });
                if (!attempt) {
                    return false;
                }
                // Check if the block is still within the time window
                const now = new Date();
                const windowStart = new Date(now.getTime() - (this.ATTEMPT_WINDOW_HOURS * 60 * 60 * 1000));
                if (attempt.lastAttemptAt < windowStart) {
                    // Unblock if outside the window
                    yield this.prisma.registrationAttempts.update({
                        where: { id: attempt.id },
                        data: {
                            isBlocked: false,
                            attemptCount: 0
                        }
                    });
                    logger_1.default.info(`[REGISTRATION_ATTEMPTS] Auto-unblocked ${phoneNumber} in workspace ${workspaceId} after time window`);
                    return false;
                }
                return true;
            }
            catch (error) {
                logger_1.default.error(`[REGISTRATION_ATTEMPTS] Error checking block status for ${phoneNumber}:`, error);
                return false; // Fail open - don't block if there's an error
            }
        });
    }
    /**
     * Clear attempts when user successfully registers
     */
    clearAttempts(phoneNumber, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.prisma.registrationAttempts.deleteMany({
                    where: {
                        phoneNumber,
                        workspaceId
                    }
                });
                logger_1.default.info(`[REGISTRATION_ATTEMPTS] Cleared attempts for successfully registered user ${phoneNumber} in workspace ${workspaceId}`);
            }
            catch (error) {
                logger_1.default.error(`[REGISTRATION_ATTEMPTS] Error clearing attempts for ${phoneNumber}:`, error);
            }
        });
    }
    /**
     * Get attempt information for a phone number
     */
    getAttempts(phoneNumber, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const attempt = yield this.prisma.registrationAttempts.findFirst({
                    where: {
                        phoneNumber,
                        workspaceId
                    }
                });
                return attempt ? this.mapToInterface(attempt) : null;
            }
            catch (error) {
                logger_1.default.error(`[REGISTRATION_ATTEMPTS] Error getting attempts for ${phoneNumber}:`, error);
                return null;
            }
        });
    }
    /**
     * Block a customer in the database
     */
    blockCustomer(phoneNumber, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Find customer by phone number
                const customer = yield this.prisma.customers.findFirst({
                    where: {
                        phone: phoneNumber,
                        workspaceId: workspaceId
                    }
                });
                if (customer) {
                    // Update existing customer
                    yield this.prisma.customers.update({
                        where: { id: customer.id },
                        data: { isBlacklisted: true }
                    });
                    logger_1.default.info(`[REGISTRATION_ATTEMPTS] Blocked existing customer ${phoneNumber} in workspace ${workspaceId}`);
                }
                else {
                    // Create a blocked customer record
                    yield this.prisma.customers.create({
                        data: {
                            phone: phoneNumber,
                            workspaceId: workspaceId,
                            name: "Blocked User",
                            email: `${phoneNumber.replace(/[^0-9]/g, '')}@blocked.com`,
                            isBlacklisted: true,
                            isActive: true
                        }
                    });
                    logger_1.default.info(`[REGISTRATION_ATTEMPTS] Created blocked customer record for ${phoneNumber} in workspace ${workspaceId}`);
                }
            }
            catch (error) {
                logger_1.default.error(`[REGISTRATION_ATTEMPTS] Error blocking customer ${phoneNumber}:`, error);
            }
        });
    }
    /**
     * Map database record to interface
     */
    mapToInterface(record) {
        return {
            phoneNumber: record.phoneNumber,
            workspaceId: record.workspaceId,
            attemptCount: record.attemptCount,
            lastAttemptAt: record.lastAttemptAt,
            isBlocked: record.isBlocked
        };
    }
}
exports.RegistrationAttemptsService = RegistrationAttemptsService;
//# sourceMappingURL=registration-attempts.service.js.map