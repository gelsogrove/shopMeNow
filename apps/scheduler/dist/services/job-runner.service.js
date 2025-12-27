"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runJob = runJob;
const database_1 = require("../config/database");
const email_alert_service_1 = require("./email-alert.service");
const logger_1 = __importDefault(require("../utils/logger"));
async function runJob(jobName, fn) {
    // Check if job is active (can be disabled from backoffice)
    const jobStatus = await database_1.prisma.schedulerJobStatus.findUnique({
        where: { jobName },
        select: { isActive: true }
    });
    // If job exists and is disabled, skip execution (silent - no log spam)
    if (jobStatus && !jobStatus.isActive) {
        await database_1.prisma.schedulerJobStatus.update({
            where: { jobName },
            data: {
                lastStatus: 'SKIPPED',
                lastRunAt: new Date(),
                lastError: null
            }
        });
        return;
    }
    const start = Date.now();
    // Mark as RUNNING (upsert creates with isActive=true if not exists)
    await database_1.prisma.schedulerJobStatus.upsert({
        where: { jobName },
        create: {
            jobName,
            isActive: true,
            lastStatus: 'RUNNING',
            lastRunAt: new Date()
        },
        update: {
            lastStatus: 'RUNNING',
            lastRunAt: new Date(),
            lastError: null
        },
    });
    try {
        // Silent execution - no log spam for routine jobs
        await fn();
        // Mark as SUCCESS
        const duration = Date.now() - start;
        await database_1.prisma.schedulerJobStatus.update({
            where: { jobName },
            data: {
                lastStatus: 'SUCCESS',
                lastDuration: duration,
                lastError: null,
            },
        });
    }
    catch (error) {
        const errorMsg = error.message;
        const duration = Date.now() - start;
        // Mark as FAILED
        await database_1.prisma.schedulerJobStatus.update({
            where: { jobName },
            data: {
                lastStatus: 'FAILED',
                lastDuration: duration,
                lastError: errorMsg,
            },
        });
        logger_1.default.error(`❌ Job FAILED: ${jobName} - ${errorMsg}`);
        // Send email alert
        await (0, email_alert_service_1.sendJobErrorAlert)(jobName, error);
    }
}
//# sourceMappingURL=job-runner.service.js.map