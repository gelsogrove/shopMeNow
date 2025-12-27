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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfferRepository = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const offer_entity_1 = require("../domain/entities/offer.entity");
const prisma_1 = require("../lib/prisma");
/**
 * Implementation of Offer Repository using Prisma
 */
class OfferRepository {
    /**
     * Find all offers in a workspace
     */
    findAll(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const offers = yield prisma_1.prisma.offers.findMany({
                where: { workspaceId },
                include: {
                    category: true,
                    categories: true,
                },
            });
            return offers.map((offer) => {
                // Create a new object instead of modifying the prisma result directly
                const offerData = Object.assign(Object.assign({}, offer), { categoryIds: offer.categories.length > 0
                        ? offer.categories.map((cat) => cat.id)
                        : offer.categoryId
                            ? [offer.categoryId]
                            : [] });
                return new offer_entity_1.Offer(offerData);
            });
        });
    }
    /**
     * Find active offers in a workspace, optionally filtered by category
     */
    findActive(workspaceId, categoryId) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            // Offers expire based on dates only - isActive flag is ignored
            const where = {
                workspaceId,
                startDate: { lte: now },
                endDate: { gte: now },
            };
            if (categoryId) {
                where.OR = [
                    { categoryId: categoryId },
                    { categories: { some: { id: categoryId } } },
                ];
            }
            try {
                const offers = yield prisma_1.prisma.offers.findMany({
                    where,
                    include: {
                        category: true,
                        categories: true,
                    },
                });
                return offers.map((offer) => {
                    // Create a new object instead of modifying the prisma result directly
                    const offerData = Object.assign(Object.assign({}, offer), { categoryIds: offer.categories.length > 0
                            ? offer.categories.map((cat) => cat.id)
                            : offer.categoryId
                                ? [offer.categoryId]
                                : [] });
                    return new offer_entity_1.Offer(offerData);
                });
            }
            catch (error) {
                logger_1.default.error("Error finding active offers:", error);
                throw error;
            }
        });
    }
    /**
     * Get active offers in a workspace, optionally filtered by category
     * This is an alias for findActive for backward compatibility
     */
    getActiveOffers(workspaceId, categoryId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.findActive(workspaceId, categoryId);
        });
    }
    /**
     * Find a single offer by ID and workspace
     */
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const offer = yield prisma_1.prisma.offers.findFirst({
                where: { id, workspaceId },
                include: {
                    category: true,
                    categories: true,
                },
            });
            if (!offer)
                return null;
            // Create a new object instead of modifying the prisma result directly
            const offerData = Object.assign(Object.assign({}, offer), { categoryIds: offer.categories.length > 0
                    ? offer.categories.map((cat) => cat.id)
                    : offer.categoryId
                        ? [offer.categoryId]
                        : [] });
            return new offer_entity_1.Offer(offerData);
        });
    }
    /**
     * Create a new offer
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Extract categoryIds but don't include it in the prisma operation
                const { categoryIds } = data, prismaData = __rest(data, ["categoryIds"]);
                logger_1.default.debug("Creating offer in repository with data:", prismaData);
                logger_1.default.debug("CategoryIds:", categoryIds);
                // Prepare the create data with category connections
                const createData = Object.assign({}, prismaData);
                // Handle category relationships
                if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
                    // Use many-to-many relationship for multiple categories
                    createData.categories = {
                        connect: categoryIds.map((id) => ({ id })),
                    };
                    // Also set the first category as the primary category for backward compatibility
                    createData.categoryId = categoryIds[0];
                }
                const offer = yield prisma_1.prisma.offers.create({
                    data: createData,
                    include: {
                        category: true,
                        categories: true,
                    },
                });
                // Create a new object with both the prisma result and additional data
                const offerData = Object.assign(Object.assign({}, offer), { categoryIds: offer.categories.length > 0
                        ? offer.categories.map((cat) => cat.id)
                        : offer.categoryId
                            ? [offer.categoryId]
                            : [] });
                logger_1.default.debug("Successfully created offer in repository:", offer);
                return new offer_entity_1.Offer(offerData);
            }
            catch (error) {
                logger_1.default.error(`Error creating offer in repository:`, error);
                throw new Error(`Failed to create offer: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        });
    }
    /**
     * Update an existing offer
     */
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`Updating offer with ID: ${id}`);
                logger_1.default.debug(`Original update data:`, data);
                // Extract fields that shouldn't be sent to Prisma
                const { createdAt, updatedAt, categoryIds } = data, updateData = __rest(data, ["createdAt", "updatedAt", "categoryIds"]);
                logger_1.default.debug(`Processed update data (without categoryIds):`, updateData);
                logger_1.default.debug(`CategoryIds to update:`, categoryIds);
                // Ensure the offer exists and belongs to the specified workspace
                const existingOffer = yield prisma_1.prisma.offers.findFirst({
                    where: {
                        id,
                        workspaceId: updateData.workspaceId,
                    },
                    include: {
                        category: true,
                        categories: true,
                    },
                });
                if (!existingOffer) {
                    throw new Error(`Offer with ID ${id} not found in workspace ${updateData.workspaceId}`);
                }
                // Handle category relationships
                if (categoryIds !== undefined) {
                    if (categoryIds === null ||
                        (Array.isArray(categoryIds) && categoryIds.length === 0)) {
                        // Clear all category relationships
                        updateData.categoryId = null;
                        updateData.categories = {
                            set: [], // This will disconnect all categories
                        };
                        logger_1.default.debug(`Clearing all category relationships`);
                    }
                    else if (Array.isArray(categoryIds) && categoryIds.length > 0) {
                        // Set new category relationships
                        updateData.categories = {
                            set: categoryIds.map((id) => ({ id })),
                        };
                        // Also set the first category as the primary category for backward compatibility
                        updateData.categoryId = categoryIds[0];
                        logger_1.default.debug(`Setting categories to ${categoryIds.join(", ")} and primary categoryId to ${updateData.categoryId}`);
                    }
                }
                try {
                    const offer = yield prisma_1.prisma.offers.update({
                        where: { id },
                        data: updateData,
                        include: {
                            category: true,
                            categories: true,
                        },
                    });
                    // Create a new object with both the prisma result and additional data
                    const offerData = Object.assign(Object.assign({}, offer), { categoryIds: offer.categories.length > 0
                            ? offer.categories.map((cat) => cat.id)
                            : offer.categoryId
                                ? [offer.categoryId]
                                : [] });
                    logger_1.default.info(`Successfully updated offer with ID: ${id}`);
                    return new offer_entity_1.Offer(offerData);
                }
                catch (prismaError) {
                    logger_1.default.error(`Prisma error updating offer with ID ${id}:`, prismaError);
                    throw prismaError;
                }
            }
            catch (error) {
                logger_1.default.error(`Error updating offer with ID ${id}:`, error);
                throw new Error(`Failed to update offer: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        });
    }
    /**
     * Delete an offer
     */
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma_1.prisma.offers.delete({
                    where: { id },
                });
                return true;
            }
            catch (error) {
                logger_1.default.error(`Error deleting offer with ID ${id}:`, error);
                return false;
            }
        });
    }
}
exports.OfferRepository = OfferRepository;
//# sourceMappingURL=offer.repository.js.map