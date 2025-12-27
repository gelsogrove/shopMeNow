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
exports.ServiceRepository = void 0;
const service_entity_1 = require("../domain/entities/service.entity");
const prisma_1 = require("../lib/prisma");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Implementation of Service Repository using Prisma
 */
class ServiceRepository {
    /**
     * Find all services in a workspace
     */
    findAll(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const services = yield prisma_1.prisma.services.findMany({
                    where: { workspaceId },
                    orderBy: {
                        name: "asc",
                    },
                });
                return services ? services.map((service) => new service_entity_1.Service(service)) : [];
            }
            catch (error) {
                logger_1.default.error("Error finding services:", error);
                return [];
            }
        });
    }
    /**
     * Find a single service by ID and workspace
     */
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const service = yield prisma_1.prisma.services.findFirst({
                    where: {
                        id,
                        workspaceId,
                    },
                });
                return service ? new service_entity_1.Service(service) : null;
            }
            catch (error) {
                logger_1.default.error(`Error finding service ${id}:`, error);
                return null;
            }
        });
    }
    /**
     * Find services by IDs and workspace
     */
    findByIds(ids, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const services = yield prisma_1.prisma.services.findMany({
                    where: {
                        id: {
                            in: ids,
                        },
                        workspaceId,
                    },
                });
                return services ? services.map((service) => new service_entity_1.Service(service)) : [];
            }
            catch (error) {
                logger_1.default.error(`Error finding services by ids:`, error);
                return [];
            }
        });
    }
    /**
     * Find service by service code (e.g., "SRV-001", "GFT001")
     */
    findByServiceCode(code, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔍 findByServiceCode called:", { code, workspaceId });
                const service = yield prisma_1.prisma.services.findFirst({
                    where: {
                        code,
                        workspaceId,
                    },
                });
                logger_1.default.info("🔍 findByServiceCode result:", {
                    found: !!service,
                    serviceName: service === null || service === void 0 ? void 0 : service.name,
                    serviceCode: service === null || service === void 0 ? void 0 : service.code
                });
                return service ? new service_entity_1.Service(service) : null;
            }
            catch (error) {
                logger_1.default.error(`Error finding service by code ${code}:`, error);
                return null;
            }
        });
    }
    /**
     * Create a new service
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const service = yield prisma_1.prisma.services.create({
                    data: data,
                });
                return new service_entity_1.Service(service);
            }
            catch (error) {
                logger_1.default.error("Error creating service:", error);
                throw error;
            }
        });
    }
    /**
     * Update an existing service
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma_1.prisma.services.updateMany({
                    where: {
                        id,
                        workspaceId,
                    },
                    data: data,
                });
                // Get updated service
                return this.findById(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error updating service ${id}:`, error);
                return null;
            }
        });
    }
    /**
     * Hard delete a service
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield prisma_1.prisma.services.deleteMany({
                    where: {
                        id,
                        workspaceId,
                    },
                });
                return result.count > 0;
            }
            catch (error) {
                logger_1.default.error(`Error deleting service ${id}:`, error);
                return false;
            }
        });
    }
}
exports.ServiceRepository = ServiceRepository;
//# sourceMappingURL=service.repository.js.map