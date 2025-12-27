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
exports.CertificationRepository = void 0;
class CertificationRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Find all certifications for a workspace
     */
    findByWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.certification.findMany({
                where: { workspaceId },
                orderBy: { name: "asc" },
            });
        });
    }
    /**
     * Find certification by ID with workspace validation
     */
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.certification.findFirst({
                where: { id, workspaceId },
            });
        });
    }
    /**
     * Find certification by name (case-insensitive) in workspace
     */
    findByName(name, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.certification.findFirst({
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
     * Create a new certification
     */
    create(workspaceId, name) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.certification.create({
                data: {
                    workspaceId,
                    name: name.trim(),
                },
            });
        });
    }
    /**
     * Update certification name
     */
    update(id, workspaceId, name) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.certification.update({
                where: { id },
                data: { name: name.trim() },
            });
        });
    }
    /**
     * Delete certification (only if not used by products)
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.prisma.certification.delete({
                where: { id },
            });
        });
    }
    /**
     * Count products using this certification
     */
    countProductsUsing(certificationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const count = yield this.prisma.productCertification.count({
                where: { certificationId },
            });
            return count;
        });
    }
    /**
     * Get certifications with product counts
     */
    findByWorkspaceWithCounts(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.certification.findMany({
                where: { workspaceId },
                include: {
                    _count: {
                        select: { productCertifications: true },
                    },
                },
                orderBy: { name: "asc" },
            });
        });
    }
}
exports.CertificationRepository = CertificationRepository;
//# sourceMappingURL=certification.repository.js.map