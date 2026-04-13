/**
 * System Functions Sync Service
 * 
 * Runs ONCE on server startup to ensure all workspaces have
 * the required system calling functions.
 * 
 * Behavior:
 *   - CREATE missing functions with default descriptions
 *   - NEVER overwrite existing functions (DB is source of truth)
 *   - Handles both ecommerce and informational workspaces
 *   - Runs in background (non-blocking)
 */
import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"
import {
  ALWAYS_AVAILABLE_FUNCTIONS,
  APPOINTMENT_FUNCTIONS,
  ECOMMERCE_FUNCTIONS,
  SystemFunctionDef,
} from "../constants/system-functions"

export async function syncSystemFunctionsOnStartup(prisma: PrismaClient): Promise<void> {
  try {
    logger.info("🔄 [SystemFunctionsSync] Starting system functions sync...")

    // Get all active workspaces
    const workspaces = await prisma.workspace.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        enableCalendarBooking: true,
        channelMode: true,
      }
    })

    let totalCreated = 0

    for (const workspace of workspaces) {
      // Always-available functions (changeLanguage, customerSupportAgent, etc.)
      const functionsToSync: SystemFunctionDef[] = [...ALWAYS_AVAILABLE_FUNCTIONS]

      // E-commerce functions if workspace is in ecommerce mode
      if (workspace.channelMode === "ECOMMERCE") {
        functionsToSync.push(...ECOMMERCE_FUNCTIONS)
      }

      // Appointment functions if calendar is enabled
      if (workspace.enableCalendarBooking) {
        functionsToSync.push(...APPOINTMENT_FUNCTIONS)
      }

      for (const fnDef of functionsToSync) {
        try {
          // CREATE-only: skip if function already exists in DB
          const existing = await prisma.workspaceCallingFunction.findUnique({
            where: {
              workspaceId_functionName: {
                workspaceId: workspace.id,
                functionName: fnDef.functionName
              }
            }
          })

          if (!existing) {
            await prisma.workspaceCallingFunction.create({
              data: {
                workspaceId: workspace.id,
                functionName: fnDef.functionName,
                description: fnDef.description,
                parameters: fnDef.parameters,
                isSystemFunction: fnDef.isSystemFunction,
                executionType: fnDef.executionType,
                isActive: fnDef.isActive,
              }
            })
            totalCreated++
            logger.info(`✅ [SystemFunctionsSync] Created ${fnDef.functionName} for workspace ${workspace.name}`)
          }
        } catch (error: any) {
          // P2002 = unique constraint (race condition, harmless)
          if (error.code !== "P2002") {
            logger.warn(`⚠️ [SystemFunctionsSync] Failed to sync ${fnDef.functionName} for ${workspace.id}:`, error)
          }
        }
      }
    }

    logger.info(`✅ [SystemFunctionsSync] Completed. Created ${totalCreated} missing functions across ${workspaces.length} workspaces.`)
  } catch (error) {
    logger.error("❌ [SystemFunctionsSync] Failed (non-fatal):", error)
  }
}
