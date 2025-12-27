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
exports.CampaignController = void 0;
const database_1 = require("@echatbot/database");
const campaign_service_1 = require("../../../application/services/campaign.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
// prisma imported
/**
 * Controller for WhatsApp marketing campaigns
 */
class CampaignController {
    constructor() {
        this.campaignService = new campaign_service_1.CampaignService(database_1.prisma);
    }
    /**
     * Get all campaigns for a workspace
     */
    getCampaigns(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const campaigns = yield this.campaignService.findAllByWorkspace(workspaceId);
                res.json({ data: campaigns });
            }
            catch (error) {
                logger_1.default.error("Error getting campaigns:", error);
                next(error);
            }
        });
    }
    /**
     * Get campaign by ID
     */
    getCampaignById(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, id } = req.params;
                const campaign = yield this.campaignService.findById(id, workspaceId);
                if (!campaign) {
                    return res.status(404).json({ error: "Campagna non trovata" });
                }
                res.json(campaign);
            }
            catch (error) {
                logger_1.default.error("Error getting campaign:", error);
                next(error);
            }
        });
    }
    /**
     * Create a new campaign
     */
    createCampaign(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { name, messagePreview, frequency, targetType, customerIds, templateName, templateParams, isActive, } = req.body;
                // Validation
                if (!name || !messagePreview || !frequency || !targetType) {
                    return res.status(400).json({
                        error: "Campi obbligatori mancanti",
                        message: "Nome, messaggio, frequenza e tipo destinatari sono obbligatori",
                    });
                }
                // If targetType is SELECTED, customerIds must be provided
                if (targetType === "SELECTED" &&
                    (!customerIds || customerIds.length === 0)) {
                    return res.status(400).json({
                        error: "Destinatari mancanti",
                        message: "Se selezioni 'Solo clienti specifici', devi fornire almeno un cliente",
                    });
                }
                const campaign = yield this.campaignService.create({
                    workspaceId,
                    name,
                    messagePreview,
                    frequency,
                    targetType,
                    customerIds: customerIds || [],
                    templateName,
                    templateParams,
                    isActive,
                });
                res.status(201).json(campaign);
            }
            catch (error) {
                logger_1.default.error("Error creating campaign:", error);
                next(error);
            }
        });
    }
    /**
     * Update a campaign
     */
    updateCampaign(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, id } = req.params;
                const { name, messagePreview, frequency, targetType, customerIds, templateName, templateParams, isActive, } = req.body;
                const campaign = yield this.campaignService.update(id, workspaceId, {
                    name,
                    messagePreview,
                    frequency,
                    targetType,
                    customerIds,
                    templateName,
                    templateParams,
                    isActive,
                });
                if (!campaign) {
                    return res.status(404).json({ error: "Campagna non trovata" });
                }
                res.json(campaign);
            }
            catch (error) {
                logger_1.default.error("Error updating campaign:", error);
                next(error);
            }
        });
    }
    /**
     * Delete a campaign
     */
    deleteCampaign(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, id } = req.params;
                const success = yield this.campaignService.delete(id, workspaceId);
                if (!success) {
                    return res.status(404).json({ error: "Campagna non trovata" });
                }
                res.status(204).send();
            }
            catch (error) {
                logger_1.default.error("Error deleting campaign:", error);
                next(error);
            }
        });
    }
    /**
     * Toggle campaign active status
     */
    toggleCampaignActive(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, id } = req.params;
                const campaign = yield this.campaignService.toggleActive(id, workspaceId);
                if (!campaign) {
                    return res.status(404).json({ error: "Campagna non trovata" });
                }
                res.json({
                    message: campaign.isActive
                        ? "Campagna attivata"
                        : "Campagna disattivata",
                    campaign,
                });
            }
            catch (error) {
                logger_1.default.error("Error toggling campaign active status:", error);
                next(error);
            }
        });
    }
}
exports.CampaignController = CampaignController;
//# sourceMappingURL=campaign.controller.js.map