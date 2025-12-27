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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransportTypeRepository = void 0;
class TransportTypeRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Find all transport types for a workspace
     */
    findByWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.transportType.findMany({
                where: { workspaceId },
                orderBy: { name: "asc" },
            });
        });
    }
    /**
     * Find transport type by ID with workspace validation
     */
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.transportType.findFirst({
                where: { id, workspaceId },
            });
        });
    }
    /**
     * Find transport type by name (case-insensitive) in workspace
     */
    findByName(name, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.transportType.findFirst({
                where: {
                    workspaceId,
                    name: {
                        equals: name,
                        mode: "insensitive",
                    },
                },
            });
        });
    }
    /**
     * Create a new transport type
     */
    create(workspaceId, name) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.transportType.create({
                data: {
                    workspaceId,
                    name: name.trim(),
                },
            });
        });
    }
    /**
     * Update transport type name
     */
    update(id, workspaceId, name) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.transportType.update({
                where: { id },
                data: { name: name.trim() },
            });
        });
    }
    /**
     * Delete transport type (only if not used by products)
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.prisma.transportType.delete({
                where: { id },
            });
        });
    }
    /**
     * Count products using this transport type
     */
    countProductsUsing(transportTypeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const count = yield this.prisma.productTransportType.count({
                where: { transportTypeId },
            });
            return count;
        });
    }
    /**
     * Get transport types with product counts
     */
    findByWorkspaceWithCounts(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.transportType.findMany({
                where: { workspaceId },
                include: {
                    _count: {
                        select: { productTransportTypes: true },
                    },
                },
                orderBy: { name: "asc" },
            });
        });
    }
    /**
     * Get active transport types with prices for a workspace
     * Used for transport cost calculation in cart optimization
     * @param workspaceId Workspace ID
     * @returns Active transport types with prices
     */
    findActiveWithPrices(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const transportTypes = yield this.prisma.transportType.findMany({
                where: {
                    workspaceId,
                    isActive: true,
                },
                select: {
                    id: true,
                    name: true,
                    price: true,
                    isActive: true,
                },
                orderBy: { name: "asc" },
            });
            // Convert Decimal to number for price
            return transportTypes.map(t => (Object.assign(Object.assign({}, t), { price: Number(t.price) })));
        });
    }
    /**
     * Check if workspace has transport types with prices configured
     * @param workspaceId Workspace ID
     * @returns true if at least one active transport type has price > 0
     */
    hasConfiguredPrices(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const count = yield this.prisma.transportType.count({
                where: {
                    workspaceId,
                    isActive: true,
                    price: { gt: 0 },
                },
            });
            return count > 0;
        });
    }
}
exports.TransportTypeRepository = TransportTypeRepository;
//# sourceMappingURL=transport-type.repository.js.map