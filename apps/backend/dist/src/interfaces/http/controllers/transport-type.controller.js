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
exports.TransportTypeController = void 0;
const transport_type_service_1 = require("../../../services/transport-type.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
class TransportTypeController {
    constructor(prisma) {
        this.prisma = prisma;
        this.transportTypeService = new transport_type_service_1.TransportTypeService(prisma);
    }
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/transport-types:
     *   get:
     *     summary: Get all transport types for workspace
     *     tags: [TransportTypes]
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: List of transport types
     */
    getAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.workspaceId;
                const transportTypes = yield this.transportTypeService.getAllWithCounts(workspaceId);
                return res.json(transportTypes);
            }
            catch (error) {
                logger_1.default.error("Error getting transport types:", error);
                return res.status(500).json({
                    error: "Failed to get transport types",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/transport-types/{id}:
     *   get:
     *     summary: Get transport type by ID
     *     tags: [TransportTypes]
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *       - in: path
     *         name: id
     *         required: true
     *     responses:
     *       200:
     *         description: Transport type details
     *       404:
     *         description: Transport type not found
     */
    getById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = req.workspaceId;
                const transportType = yield this.transportTypeService.getById(id, workspaceId);
                if (!transportType) {
                    return res.status(404).json({ error: "Transport type not found" });
                }
                return res.json(transportType);
            }
            catch (error) {
                logger_1.default.error("Error getting transport type:", error);
                return res.status(500).json({
                    error: "Failed to get transport type",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/transport-types:
     *   post:
     *     summary: Create new transport type
     *     tags: [TransportTypes]
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 example: "Air"
     *     responses:
     *       201:
     *         description: Transport type created
     *       400:
     *         description: Validation error
     */
    create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { name } = req.body;
                const workspaceId = req.workspaceId;
                if (!name) {
                    return res.status(400).json({ error: "Transport type name is required" });
                }
                const transportType = yield this.transportTypeService.create(workspaceId, name);
                logger_1.default.info(`Transport type created: ${transportType.id} (${name})`);
                return res.status(201).json(transportType);
            }
            catch (error) {
                logger_1.default.error("Error creating transport type:", error);
                if (error instanceof Error &&
                    error.message === "Transport type already exists") {
                    return res.status(400).json({ error: error.message });
                }
                if (error instanceof Error &&
                    error.message.includes("Transport type name")) {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({
                    error: "Failed to create transport type",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/transport-types/{id}:
     *   put:
     *     summary: Update transport type
     *     tags: [TransportTypes]
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *       - in: path
     *         name: id
     *         required: true
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *     responses:
     *       200:
     *         description: Transport type updated
     *       404:
     *         description: Transport type not found
     */
    update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { name } = req.body;
                const workspaceId = req.workspaceId;
                if (!name) {
                    return res.status(400).json({ error: "Transport type name is required" });
                }
                const transportType = yield this.transportTypeService.update(id, workspaceId, name);
                logger_1.default.info(`Transport type updated: ${id} (${name})`);
                return res.json(transportType);
            }
            catch (error) {
                logger_1.default.error("Error updating transport type:", error);
                if (error instanceof Error &&
                    error.message === "Transport type not found") {
                    return res.status(404).json({ error: error.message });
                }
                if (error instanceof Error &&
                    (error.message === "Transport type name already exists" ||
                        error.message.includes("Transport type name"))) {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({
                    error: "Failed to update transport type",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/transport-types/{id}:
     *   delete:
     *     summary: Delete transport type
     *     tags: [TransportTypes]
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *       - in: path
     *         name: id
     *         required: true
     *     responses:
     *       200:
     *         description: Transport type deleted
     *       400:
     *         description: Cannot delete - used by products
     *       404:
     *         description: Transport type not found
     */
    delete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = req.workspaceId;
                yield this.transportTypeService.delete(id, workspaceId);
                logger_1.default.info(`Transport type deleted: ${id}`);
                return res.json({ message: "Transport type deleted successfully" });
            }
            catch (error) {
                logger_1.default.error("Error deleting transport type:", error);
                if (error instanceof Error &&
                    error.message === "Transport type not found") {
                    return res.status(404).json({ error: error.message });
                }
                if (error instanceof Error &&
                    error.message.includes("Cannot delete")) {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({
                    error: "Failed to delete transport type",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
}
exports.TransportTypeController = TransportTypeController;
//# sourceMappingURL=transport-type.controller.js.map