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
exports.CertificationController = void 0;
const certification_service_1 = require("../../../services/certification.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
class CertificationController {
    constructor(prisma) {
        this.prisma = prisma;
        this.certificationService = new certification_service_1.CertificationService(prisma);
    }
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/certifications:
     *   get:
     *     summary: Get all certifications for workspace
     *     tags: [Certifications]
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: List of certifications
     */
    getAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.workspaceId;
                const certifications = yield this.certificationService.getAllWithCounts(workspaceId);
                return res.json(certifications);
            }
            catch (error) {
                logger_1.default.error("Error getting certifications:", error);
                return res.status(500).json({
                    error: "Failed to get certifications",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/certifications/{id}:
     *   get:
     *     summary: Get certification by ID
     *     tags: [Certifications]
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *       - in: path
     *         name: id
     *         required: true
     *     responses:
     *       200:
     *         description: Certification details
     *       404:
     *         description: Certification not found
     */
    getById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = req.workspaceId;
                const certification = yield this.certificationService.getById(id, workspaceId);
                if (!certification) {
                    return res.status(404).json({ error: "Certification not found" });
                }
                return res.json(certification);
            }
            catch (error) {
                logger_1.default.error("Error getting certification:", error);
                return res.status(500).json({
                    error: "Failed to get certification",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/certifications:
     *   post:
     *     summary: Create new certification
     *     tags: [Certifications]
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
     *                 example: "Kosher"
     *     responses:
     *       201:
     *         description: Certification created
     *       400:
     *         description: Validation error
     */
    create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { name } = req.body;
                const workspaceId = req.workspaceId;
                if (!name) {
                    return res.status(400).json({ error: "Certification name is required" });
                }
                const certification = yield this.certificationService.create(workspaceId, name);
                logger_1.default.info(`Certification created: ${certification.id} (${name})`);
                return res.status(201).json(certification);
            }
            catch (error) {
                logger_1.default.error("Error creating certification:", error);
                if (error instanceof Error &&
                    error.message === "Certification already exists") {
                    return res.status(400).json({ error: error.message });
                }
                if (error instanceof Error &&
                    error.message.includes("Certification name")) {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({
                    error: "Failed to create certification",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/certifications/{id}:
     *   put:
     *     summary: Update certification
     *     tags: [Certifications]
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
     *         description: Certification updated
     *       404:
     *         description: Certification not found
     */
    update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { name } = req.body;
                const workspaceId = req.workspaceId;
                if (!name) {
                    return res.status(400).json({ error: "Certification name is required" });
                }
                const certification = yield this.certificationService.update(id, workspaceId, name);
                logger_1.default.info(`Certification updated: ${id} (${name})`);
                return res.json(certification);
            }
            catch (error) {
                logger_1.default.error("Error updating certification:", error);
                if (error instanceof Error &&
                    error.message === "Certification not found") {
                    return res.status(404).json({ error: error.message });
                }
                if (error instanceof Error &&
                    (error.message === "Certification name already exists" ||
                        error.message.includes("Certification name"))) {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({
                    error: "Failed to update certification",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/certifications/{id}:
     *   delete:
     *     summary: Delete certification
     *     tags: [Certifications]
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *       - in: path
     *         name: id
     *         required: true
     *     responses:
     *       200:
     *         description: Certification deleted
     *       400:
     *         description: Cannot delete - used by products
     *       404:
     *         description: Certification not found
     */
    delete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceId = req.workspaceId;
                yield this.certificationService.delete(id, workspaceId);
                logger_1.default.info(`Certification deleted: ${id}`);
                return res.json({ message: "Certification deleted successfully" });
            }
            catch (error) {
                logger_1.default.error("Error deleting certification:", error);
                if (error instanceof Error &&
                    error.message === "Certification not found") {
                    return res.status(404).json({ error: error.message });
                }
                if (error instanceof Error &&
                    error.message.includes("Cannot delete")) {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({
                    error: "Failed to delete certification",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
}
exports.CertificationController = CertificationController;
//# sourceMappingURL=certification.controller.js.map