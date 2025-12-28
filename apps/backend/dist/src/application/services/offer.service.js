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
exports.OfferService = void 0;
const offer_entity_1 = require("../../domain/entities/offer.entity");
const offer_repository_1 = require("../../repositories/offer.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Service layer for Offers
 * Handles business logic for offers
 */
class OfferService {
    constructor() {
        this.offerRepository = new offer_repository_1.OfferRepository();
    }
    /**
     * Get all offers for a workspace
     */
    getAllOffers(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.offerRepository.findAll(workspaceId);
            }
            catch (error) {
                logger_1.default.error("Error getting all offers:", error);
                throw error;
            }
        });
    }
    /**
     * Get active offers, optionally filtered by category
     */
    getActiveOffers(workspaceId, categoryId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.offerRepository.findActive(workspaceId, categoryId);
            }
            catch (error) {
                logger_1.default.error("Error getting active offers:", error);
                throw error;
            }
        });
    }
    /**
     * Get offer by ID
     */
    getOfferById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.offerRepository.findById(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error getting offer ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Create a new offer
     */
    createOffer(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate required fields
                if (!data.name || !data.discountPercent || !data.startDate || !data.endDate) {
                    logger_1.default.error("Missing required fields in offer data:", data);
                    throw new Error("Missing required fields");
                }
                // Create offer entity for validation
                const offerToValidate = new offer_entity_1.Offer(data);
                if (!offerToValidate.validate()) {
                    logger_1.default.error("Invalid offer data:", data);
                    throw new Error("Invalid offer data");
                }
                logger_1.default.debug("Creating offer with data:", data);
                try {
                    const result = yield this.offerRepository.create(data);
                    logger_1.default.debug("Successfully created offer:", result);
                    return result;
                }
                catch (createError) {
                    logger_1.default.error("Error in repository during offer creation:", createError);
                    throw createError;
                }
            }
            catch (error) {
                logger_1.default.error("Error creating offer:", error);
                throw error;
            }
        });
    }
    /**
     * Update an offer
     */
    updateOffer(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if offer exists
                const existingOffer = yield this.offerRepository.findById(id, data.workspaceId);
                if (!existingOffer) {
                    throw new Error("Offer not found");
                }
                logger_1.default.info(`Updating offer ${id} with data:`, JSON.stringify(data));
                // Create merged offer for validation
                const offerToUpdate = new offer_entity_1.Offer(Object.assign(Object.assign({}, existingOffer), data));
                if (!offerToUpdate.validate()) {
                    logger_1.default.error(`Invalid offer data for update:`, data);
                    throw new Error("Invalid offer data");
                }
                logger_1.default.debug(`Final update data being sent to repository:`, JSON.stringify(data));
                try {
                    const result = yield this.offerRepository.update(id, data);
                    logger_1.default.info(`Successfully updated offer ${id}`);
                    return result;
                }
                catch (repoError) {
                    logger_1.default.error(`Repository error updating offer ${id}:`, repoError);
                    throw repoError;
                }
            }
            catch (error) {
                logger_1.default.error(`Error updating offer ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Delete an offer
     */
    deleteOffer(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.offerRepository.delete(id);
            }
            catch (error) {
                logger_1.default.error(`Error deleting offer ${id}:`, error);
                throw error;
            }
        });
    }
    getBestDiscount(workspaceId, categoryId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const offers = yield this.offerRepository.getActiveOffers(workspaceId, categoryId);
                if (!offers || offers.length === 0)
                    return 0;
                // Trova l'offerta con lo sconto maggiore
                const bestDiscount = Math.max(...offers.map(offer => offer.discountPercent));
                return bestDiscount;
            }
            catch (error) {
                logger_1.default.error('Error in getBestDiscount service:', error);
                return 0;
            }
        });
    }
}
exports.OfferService = OfferService;
//# sourceMappingURL=offer.service.js.map