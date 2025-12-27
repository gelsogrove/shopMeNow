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
exports.CertificationService = void 0;
const certification_repository_1 = require("../repositories/certification.repository");
const logger_1 = __importDefault(require("../utils/logger"));
class CertificationService {
    constructor(prisma) {
        this.prisma = prisma;
        this.certificationRepository = new certification_repository_1.CertificationRepository(prisma);
    }
    /**
     * Get all certifications for a workspace
     */
    getAllForWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.certificationRepository.findByWorkspace(workspaceId);
        });
    }
    /**
     * Get all certifications with product counts
     */
    getAllWithCounts(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.certificationRepository.findByWorkspaceWithCounts(workspaceId);
        });
    }
    /**
     * Get certification by ID
     */
    getById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.certificationRepository.findById(id, workspaceId);
        });
    }
    /**
     * Create new certification
     */
    create(workspaceId, name) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate name
            const trimmedName = name.trim();
            if (!trimmedName) {
                throw new Error("Certification name is required");
            }
            if (trimmedName.length > 50) {
                throw new Error("Certification name too long (max 50 characters)");
            }
            // Check for duplicate (case-insensitive)
            const existing = yield this.certificationRepository.findByName(trimmedName, workspaceId);
            if (existing) {
                throw new Error("Certification already exists");
            }
            return this.certificationRepository.create(workspaceId, trimmedName);
        });
    }
    /**
     * Update certification name
     */
    update(id, workspaceId, name) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate name
            const trimmedName = name.trim();
            if (!trimmedName) {
                throw new Error("Certification name is required");
            }
            if (trimmedName.length > 50) {
                throw new Error("Certification name too long (max 50 characters)");
            }
            // Check if certification exists
            const certification = yield this.certificationRepository.findById(id, workspaceId);
            if (!certification) {
                throw new Error("Certification not found");
            }
            // Check for duplicate name (case-insensitive), excluding current certification
            const existing = yield this.certificationRepository.findByName(trimmedName, workspaceId);
            if (existing && existing.id !== id) {
                throw new Error("Certification name already exists");
            }
            return this.certificationRepository.update(id, workspaceId, trimmedName);
        });
    }
    /**
     * Delete certification (only if not used by products)
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if certification exists
            const certification = yield this.certificationRepository.findById(id, workspaceId);
            if (!certification) {
                throw new Error("Certification not found");
            }
            // Check if certification is used by products
            const productCount = yield this.certificationRepository.countProductsUsing(id);
            if (productCount > 0) {
                throw new Error(`Cannot delete. Used by ${productCount} products. Remove from products first.`);
            }
            // Delete certification
            yield this.certificationRepository.delete(id, workspaceId);
            logger_1.default.info(`Certification deleted: ${id} (${certification.name})`);
        });
    }
    /**
     * Validate certification IDs belong to workspace
     */
    validateCertificationIds(certificationIds, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (certificationIds.length === 0)
                return true;
            const certifications = yield this.certificationRepository.findByWorkspace(workspaceId);
            const validIds = certifications.map((c) => c.id);
            return certificationIds.every((id) => validIds.includes(id));
        });
    }
}
exports.CertificationService = CertificationService;
//# sourceMappingURL=certification.service.js.map