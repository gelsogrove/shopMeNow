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
exports.CampaignService = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Service for managing WhatsApp marketing campaigns
 * Handles CRUD operations and campaign logic
 */
class CampaignService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Get all campaigns for a workspace
     */
    findAllByWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const campaigns = yield this.prisma.campaign.findMany({
                    where: { workspaceId },
                    orderBy: { createdAt: "desc" },
                    include: {
                        _count: {
                            select: {
                                sends: true,
                                feedbacks: true,
                            },
                        },
                    },
                });
                return campaigns;
            }
            catch (error) {
                logger_1.default.error(`Error fetching campaigns for workspace ${workspaceId}:`, error);
                throw new Error("Failed to fetch campaigns");
            }
        });
    }
    /**
     * Get campaign by ID
     */
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const campaign = yield this.prisma.campaign.findFirst({
                    where: {
                        id,
                        workspaceId,
                    },
                    include: {
                        _count: {
                            select: {
                                sends: true,
                                feedbacks: true,
                            },
                        },
                    },
                });
                return campaign;
            }
            catch (error) {
                logger_1.default.error(`Error fetching campaign ${id}:`, error);
                throw new Error("Failed to fetch campaign");
            }
        });
    }
    /**
     * Create a new campaign
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const campaign = yield this.prisma.campaign.create({
                    data: {
                        workspaceId: data.workspaceId,
                        name: data.name,
                        messagePreview: data.messagePreview,
                        frequency: data.frequency,
                        targetType: data.targetType,
                        customerIds: data.customerIds || [],
                        templateName: data.templateName,
                        templateParams: data.templateParams,
                        isActive: data.isActive !== undefined ? data.isActive : true,
                    },
                });
                logger_1.default.info(`Created campaign ${campaign.id} for workspace ${data.workspaceId}`);
                return campaign;
            }
            catch (error) {
                logger_1.default.error("Error creating campaign:", error);
                throw new Error("Failed to create campaign");
            }
        });
    }
    /**
     * Update a campaign
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Verify campaign belongs to workspace
                const existing = yield this.findById(id, workspaceId);
                if (!existing) {
                    return null;
                }
                const updated = yield this.prisma.campaign.update({
                    where: { id },
                    data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (data.name !== undefined && { name: data.name })), (data.messagePreview !== undefined && {
                        messagePreview: data.messagePreview,
                    })), (data.frequency !== undefined && { frequency: data.frequency })), (data.targetType !== undefined && { targetType: data.targetType })), (data.customerIds !== undefined && {
                        customerIds: data.customerIds,
                    })), (data.templateName !== undefined && {
                        templateName: data.templateName,
                    })), (data.templateParams !== undefined && {
                        templateParams: data.templateParams,
                    })), (data.isActive !== undefined && { isActive: data.isActive })),
                });
                logger_1.default.info(`Updated campaign ${id}`);
                return updated;
            }
            catch (error) {
                logger_1.default.error(`Error updating campaign ${id}:`, error);
                throw new Error("Failed to update campaign");
            }
        });
    }
    /**
     * Delete a campaign
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Verify campaign belongs to workspace
                const existing = yield this.findById(id, workspaceId);
                if (!existing) {
                    return false;
                }
                yield this.prisma.campaign.delete({
                    where: { id },
                });
                logger_1.default.info(`Deleted campaign ${id}`);
                return true;
            }
            catch (error) {
                logger_1.default.error(`Error deleting campaign ${id}:`, error);
                throw new Error("Failed to delete campaign");
            }
        });
    }
    /**
     * Toggle campaign active status
     */
    toggleActive(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const campaign = yield this.findById(id, workspaceId);
                if (!campaign) {
                    return null;
                }
                const updated = yield this.prisma.campaign.update({
                    where: { id },
                    data: { isActive: !campaign.isActive },
                });
                logger_1.default.info(`Toggled campaign ${id} active status to ${updated.isActive}`);
                return updated;
            }
            catch (error) {
                logger_1.default.error(`Error toggling campaign ${id} active status:`, error);
                throw new Error("Failed to toggle campaign active status");
            }
        });
    }
    /**
     * Get active campaigns for scheduler
     */
    findActiveCampaigns() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const campaigns = yield this.prisma.campaign.findMany({
                    where: { isActive: true },
                    include: {
                        workspace: {
                            select: {
                                id: true,
                                whatsappPhoneNumber: true,
                                whatsappApiKey: true,
                            },
                        },
                    },
                });
                return campaigns;
            }
            catch (error) {
                logger_1.default.error("Error fetching active campaigns:", error);
                throw new Error("Failed to fetch active campaigns");
            }
        });
    }
    /**
     * Update last run timestamp for campaign
     */
    updateLastRun(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.prisma.campaign.update({
                    where: { id },
                    data: { lastRunAt: new Date() },
                });
                logger_1.default.info(`Updated last run timestamp for campaign ${id}`);
            }
            catch (error) {
                logger_1.default.error(`Error updating last run for campaign ${id}:`, error);
                throw new Error("Failed to update campaign last run");
            }
        });
    }
}
exports.CampaignService = CampaignService;
//# sourceMappingURL=campaign.service.js.map