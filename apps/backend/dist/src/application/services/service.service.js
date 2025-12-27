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
const service_entity_1 = require("../../domain/entities/service.entity");
const service_repository_1 = require("../../repositories/service.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Service for managing services
 */
class ServiceService {
    constructor() {
        this.serviceRepository = new service_repository_1.ServiceRepository();
    }
    /**
     * Get all services for a workspace
     */
    getAllForWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.serviceRepository.findAll(workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error getting services for workspace ${workspaceId}:`, error);
                throw error;
            }
        });
    }
    /**
     * Get a service by ID
     */
    getById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const service = yield this.serviceRepository.findById(id, workspaceId);
                if (!service) {
                    return null;
                }
                return service;
            }
            catch (error) {
                logger_1.default.error(`Error getting service ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Get services by IDs
     */
    getByIds(ids, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.serviceRepository.findByIds(ids, workspaceId);
            }
            catch (error) {
                logger_1.default.error("Error getting services by ids:", error);
                throw error;
            }
        });
    }
    /**
     * Create a new service
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Ensure required fields are present
                if (!data.name || !data.workspaceId) {
                    throw new Error('Invalid service data');
                }
                // Create a service entity to validate the data
                const service = new service_entity_1.Service(data);
                if (!service.validate()) {
                    throw new Error('Invalid service data');
                }
                return yield this.serviceRepository.create(service);
            }
            catch (error) {
                logger_1.default.error('Error creating service:', error);
                throw error;
            }
        });
    }
    /**
     * Update a service
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if service exists
                const existingService = yield this.serviceRepository.findById(id, workspaceId);
                if (!existingService) {
                    throw new Error('Service not found');
                }
                // Create a merged service entity to validate the updated data
                const mergedData = Object.assign(Object.assign({}, existingService), data);
                // Create a service entity with the merged data to run validation
                const updatedService = new service_entity_1.Service(mergedData);
                // Validate the updated service
                if (!updatedService.validate()) {
                    throw new Error('Invalid service data');
                }
                const updated = yield this.serviceRepository.update(id, workspaceId, data);
                if (!updated) {
                    throw new Error('Service not found');
                }
                return updated;
            }
            catch (error) {
                logger_1.default.error(`Error updating service ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Hard delete a service
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if service exists first
                const existingService = yield this.serviceRepository.findById(id, workspaceId);
                if (!existingService) {
                    throw new Error('Service not found');
                }
                return yield this.serviceRepository.delete(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error deleting service ${id}:`, error);
                throw error;
            }
        });
    }
}
exports.default = new ServiceService();
//# sourceMappingURL=service.service.js.map