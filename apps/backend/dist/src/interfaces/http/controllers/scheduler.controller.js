"use strict";
/**
 * 🕐 SCHEDULER CONTROLLER
 *
 * Handles scheduler job status management for Platform Admin.
 *
 * @author Andrea Gelso - eChatbot Platform
 */
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
exports.schedulerController = void 0;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../../utils/logger"));
// prisma imported
class SchedulerController {
    /**
     * Get all scheduler jobs
     * GET /api/schedulers
     */
    getAllJobs(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const jobs = yield database_1.prisma.schedulerJobStatus.findMany({
                    orderBy: { jobName: "asc" },
                });
                logger_1.default.info(`📋 [SCHEDULER] Fetched ${jobs.length} scheduler jobs`);
                return res.json({
                    success: true,
                    data: jobs,
                });
            }
            catch (error) {
                logger_1.default.error("❌ [SCHEDULER] Error fetching jobs:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to fetch scheduler jobs",
                    message: error.message,
                });
            }
        });
    }
    /**
     * Update a scheduler job (toggle isActive)
     * PATCH /api/schedulers/:jobName
     */
    updateJob(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { jobName } = req.params;
                const { isActive } = req.body;
                // Validate isActive is boolean
                if (typeof isActive !== "boolean") {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid request: isActive must be a boolean",
                    });
                }
                // Check if job exists
                const existingJob = yield database_1.prisma.schedulerJobStatus.findUnique({
                    where: { jobName },
                });
                if (!existingJob) {
                    return res.status(404).json({
                        success: false,
                        error: `Scheduler job '${jobName}' not found`,
                    });
                }
                // Update job
                const updatedJob = yield database_1.prisma.schedulerJobStatus.update({
                    where: { jobName },
                    data: { isActive },
                });
                logger_1.default.info(`✅ [SCHEDULER] Job '${jobName}' updated: isActive=${isActive}`);
                return res.json({
                    success: true,
                    data: updatedJob,
                    message: `Job '${jobName}' ${isActive ? "enabled" : "disabled"} successfully`,
                });
            }
            catch (error) {
                logger_1.default.error("❌ [SCHEDULER] Error updating job:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to update scheduler job",
                    message: error.message,
                });
            }
        });
    }
}
exports.schedulerController = new SchedulerController();
//# sourceMappingURL=scheduler.controller.js.map