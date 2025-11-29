/**
 * 🕐 SCHEDULER CONTROLLER
 *
 * Handles scheduler job status management for Platform Admin.
 *
 * @author Andrea Gelso - ShopME Platform
 */

import { Request, Response } from "express"
import { PrismaClient } from "@prisma/client"
import logger from "../../../utils/logger"

const prisma = new PrismaClient()

class SchedulerController {
  /**
   * Get all scheduler jobs
   * GET /api/schedulers
   */
  async getAllJobs(req: Request, res: Response) {
    try {
      const jobs = await prisma.schedulerJobStatus.findMany({
        orderBy: { jobName: "asc" },
      })

      logger.info(`📋 [SCHEDULER] Fetched ${jobs.length} scheduler jobs`)

      return res.json({
        success: true,
        data: jobs,
      })
    } catch (error: any) {
      logger.error("❌ [SCHEDULER] Error fetching jobs:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch scheduler jobs",
        message: error.message,
      })
    }
  }

  /**
   * Update a scheduler job (toggle isActive)
   * PATCH /api/schedulers/:jobName
   */
  async updateJob(req: Request, res: Response) {
    try {
      const { jobName } = req.params
      const { isActive } = req.body

      // Validate isActive is boolean
      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "Invalid request: isActive must be a boolean",
        })
      }

      // Check if job exists
      const existingJob = await prisma.schedulerJobStatus.findUnique({
        where: { jobName },
      })

      if (!existingJob) {
        return res.status(404).json({
          success: false,
          error: `Scheduler job '${jobName}' not found`,
        })
      }

      // Update job
      const updatedJob = await prisma.schedulerJobStatus.update({
        where: { jobName },
        data: { isActive },
      })

      logger.info(
        `✅ [SCHEDULER] Job '${jobName}' updated: isActive=${isActive}`
      )

      return res.json({
        success: true,
        data: updatedJob,
        message: `Job '${jobName}' ${isActive ? "enabled" : "disabled"} successfully`,
      })
    } catch (error: any) {
      logger.error("❌ [SCHEDULER] Error updating job:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to update scheduler job",
        message: error.message,
      })
    }
  }
}

export const schedulerController = new SchedulerController()
