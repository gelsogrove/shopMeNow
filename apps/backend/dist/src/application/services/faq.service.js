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
exports.FaqService = void 0;
const database_1 = require("@echatbot/database");
const faq_entity_1 = require("../../domain/entities/faq.entity");
const faq_repository_1 = require("../../repositories/faq.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
// prisma imported
/**
 * Service layer for FAQ
 * Handles business logic for FAQs
 */
class FaqService {
    constructor() {
        this.faqRepository = new faq_repository_1.FAQRepository(database_1.prisma);
    }
    /**
     * Get all FAQs for a workspace
     */
    getAllForWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.faqRepository.findAll(workspaceId);
            }
            catch (error) {
                logger_1.default.error("Error getting all FAQs:", error);
                throw error;
            }
        });
    }
    /**
     * Get a FAQ by ID
     */
    getById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.faqRepository.findById(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error getting FAQ with id ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Create a new FAQ
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate required fields
                if (!data.question || !data.answer || !data.workspaceId) {
                    throw new Error("Missing required fields");
                }
                // Create a FAQ entity for validation
                const faqToCreate = new faq_entity_1.FAQ(data);
                // Validate the FAQ
                if (!faqToCreate.validate()) {
                    throw new Error("Invalid FAQ data");
                }
                // Create the FAQ
                return yield this.faqRepository.create(data);
            }
            catch (error) {
                logger_1.default.error("Error creating FAQ:", error);
                throw error;
            }
        });
    }
    /**
     * Update an existing FAQ
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if FAQ exists
                const existingFAQ = yield this.faqRepository.findById(id, workspaceId);
                if (!existingFAQ) {
                    throw new Error("FAQ not found");
                }
                // Create merged FAQ for validation
                const faqToUpdate = new faq_entity_1.FAQ(Object.assign(Object.assign({}, existingFAQ), data));
                // Validate the FAQ if question or answer are updated
                if ((data.question || data.answer) && !faqToUpdate.validate()) {
                    throw new Error("Invalid FAQ data");
                }
                // Update the FAQ
                return yield this.faqRepository.update(id, workspaceId, data);
            }
            catch (error) {
                logger_1.default.error(`Error updating FAQ with id ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Delete a FAQ
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if FAQ exists
                const faq = yield this.faqRepository.findById(id, workspaceId);
                if (!faq) {
                    throw new Error("FAQ not found");
                }
                // Delete the FAQ
                return yield this.faqRepository.delete(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error deleting FAQ with id ${id}:`, error);
                throw error;
            }
        });
    }
}
exports.FaqService = FaqService;
exports.default = new FaqService();
//# sourceMappingURL=faq.service.js.map