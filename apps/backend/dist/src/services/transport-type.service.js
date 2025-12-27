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
exports.TransportTypeService = void 0;
const transport_type_repository_1 = require("../repositories/transport-type.repository");
const logger_1 = __importDefault(require("../utils/logger"));
class TransportTypeService {
    constructor(prisma) {
        this.prisma = prisma;
        this.transportTypeRepository = new transport_type_repository_1.TransportTypeRepository(prisma);
    }
    /**
     * Get all transport types for a workspace
     */
    getAllForWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.transportTypeRepository.findByWorkspace(workspaceId);
        });
    }
    /**
     * Get all transport types with product counts
     */
    getAllWithCounts(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.transportTypeRepository.findByWorkspaceWithCounts(workspaceId);
        });
    }
    /**
     * Get transport type by ID
     */
    getById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.transportTypeRepository.findById(id, workspaceId);
        });
    }
    /**
     * Create new transport type
     */
    create(workspaceId, name) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate name
            const trimmedName = name.trim();
            if (!trimmedName) {
                throw new Error("Transport type name is required");
            }
            if (trimmedName.length > 50) {
                throw new Error("Transport type name too long (max 50 characters)");
            }
            // Check for duplicate (case-insensitive)
            const existing = yield this.transportTypeRepository.findByName(trimmedName, workspaceId);
            if (existing) {
                throw new Error("Transport type already exists");
            }
            return this.transportTypeRepository.create(workspaceId, trimmedName);
        });
    }
    /**
     * Update transport type name
     */
    update(id, workspaceId, name) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate name
            const trimmedName = name.trim();
            if (!trimmedName) {
                throw new Error("Transport type name is required");
            }
            if (trimmedName.length > 50) {
                throw new Error("Transport type name too long (max 50 characters)");
            }
            // Check if transport type exists
            const transportType = yield this.transportTypeRepository.findById(id, workspaceId);
            if (!transportType) {
                throw new Error("Transport type not found");
            }
            // Check for duplicate name (case-insensitive), excluding current transport type
            const existing = yield this.transportTypeRepository.findByName(trimmedName, workspaceId);
            if (existing && existing.id !== id) {
                throw new Error("Transport type name already exists");
            }
            return this.transportTypeRepository.update(id, workspaceId, trimmedName);
        });
    }
    /**
     * Delete transport type (only if not used by products)
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if transport type exists
            const transportType = yield this.transportTypeRepository.findById(id, workspaceId);
            if (!transportType) {
                throw new Error("Transport type not found");
            }
            // Check if transport type is used by products
            const productCount = yield this.transportTypeRepository.countProductsUsing(id);
            if (productCount > 0) {
                throw new Error(`Cannot delete. Used by ${productCount} products. Remove from products first.`);
            }
            // Delete transport type
            yield this.transportTypeRepository.delete(id, workspaceId);
            logger_1.default.info(`Transport type deleted: ${id} (${transportType.name})`);
        });
    }
    /**
     * Validate transport type IDs belong to workspace
     */
    validateTransportTypeIds(transportTypeIds, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (transportTypeIds.length === 0)
                return true;
            const transportTypes = yield this.transportTypeRepository.findByWorkspace(workspaceId);
            const validIds = transportTypes.map((t) => t.id);
            return transportTypeIds.every((id) => validIds.includes(id));
        });
    }
}
exports.TransportTypeService = TransportTypeService;
//# sourceMappingURL=transport-type.service.js.map