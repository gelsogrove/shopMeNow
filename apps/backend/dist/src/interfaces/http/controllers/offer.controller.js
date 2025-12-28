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
exports.OfferController = void 0;
const database_1 = require("@echatbot/database");
const billing_service_1 = require("../../../application/services/billing.service");
const offer_service_1 = require("../../../application/services/offer.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
// prisma imported
/**
 * Gets the workspace ID from request parameters or query
 */
const getWorkspaceId = (req) => {
    return req.params.workspaceId || req.query.workspaceId;
};
/**
 * OfferController class
 * Handles HTTP requests related to offers
 */
class OfferController {
    constructor() {
        this.offerService = new offer_service_1.OfferService();
        this.billingService = new billing_service_1.BillingService(database_1.prisma);
    }
    /**
     * Get all offers for a workspace
     */
    getAllOffers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({
                        error: "Workspace ID is required",
                        message: "Missing workspaceId parameter",
                    });
                }
                const offers = yield this.offerService.getAllOffers(workspaceId);
                return res.json(offers);
            }
            catch (error) {
                logger_1.default.error("Error getting offers:", error);
                return res.status(500).json({ error: "Failed to get offers" });
            }
        });
    }
    /**
     * Get active offers
     */
    getActiveOffers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = getWorkspaceId(req);
                const { categoryId } = req.query;
                if (!workspaceId) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                const offers = yield this.offerService.getActiveOffers(workspaceId, categoryId);
                return res.json(offers);
            }
            catch (error) {
                logger_1.default.error("Error getting active offers:", error);
                return res.status(500).json({ error: "Failed to get active offers" });
            }
        });
    }
    /**
     * Get offer by ID
     */
    getOfferById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                const offer = yield this.offerService.getOfferById(id, workspaceId);
                if (!offer) {
                    return res.status(404).json({ error: "Offer not found" });
                }
                return res.json(offer);
            }
            catch (error) {
                logger_1.default.error(`Error getting offer ${req.params.id}:`, error);
                return res.status(500).json({ error: "Failed to get offer" });
            }
        });
    }
    /**
     * Create a new offer
     */
    createOffer(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                const offerData = Object.assign(Object.assign({}, req.body), { workspaceId });
                const offer = yield this.offerService.createOffer(offerData);
                return res.status(201).json(offer);
            }
            catch (error) {
                logger_1.default.error("Error creating offer:", error);
                return res.status(500).json({ error: "Failed to create offer" });
            }
        });
    }
    /**
     * Update an offer
     */
    updateOffer(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                logger_1.default.info(`Updating offer ${id} in controller. Request body:`, JSON.stringify(req.body));
                // Check if the offer exists before updating it
                const existingOffer = yield this.offerService.getOfferById(id, workspaceId);
                if (!existingOffer) {
                    return res.status(404).json({ error: "Offer not found" });
                }
                // Ensure the request belongs to the workspace
                const offerData = Object.assign(Object.assign({}, req.body), { workspaceId });
                // 💰 BILLING: Check if offer is being activated (false → true)
                const wasActive = existingOffer.isActive;
                const willBeActive = offerData.isActive !== undefined ? offerData.isActive : wasActive;
                const isBeingActivated = !wasActive && willBeActive;
                try {
                    const offer = yield this.offerService.updateOffer(id, offerData);
                    logger_1.default.info(`Offer ${id} successfully updated in controller`);
                    return res.json(offer);
                }
                catch (serviceError) {
                    logger_1.default.error(`Service error updating offer ${id}:`, serviceError);
                    return res.status(500).json({
                        error: "Failed to update offer",
                        message: serviceError instanceof Error
                            ? serviceError.message
                            : "Unknown error",
                    });
                }
            }
            catch (error) {
                logger_1.default.error(`Error updating offer ${req.params.id}:`, error);
                return res.status(500).json({ error: "Failed to update offer" });
            }
        });
    }
    /**
     * Delete an offer
     */
    deleteOffer(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = getWorkspaceId(req);
                if (!workspaceId) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                // Check if the offer exists before deleting it
                const offer = yield this.offerService.getOfferById(id, workspaceId);
                if (!offer) {
                    return res.status(404).json({ error: "Offer not found" });
                }
                const result = yield this.offerService.deleteOffer(id);
                return res.json({ success: result });
            }
            catch (error) {
                logger_1.default.error(`Error deleting offer ${req.params.id}:`, error);
                return res.status(500).json({ error: "Failed to delete offer" });
            }
        });
    }
}
exports.OfferController = OfferController;
//# sourceMappingURL=offer.controller.js.map