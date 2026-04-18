/**
 * FlowSyncService — Keeps FlowNodeConfig and WorkspaceCallingFunction in sync.
 *
 * When a Sub-LLM (FlowNodeConfig) is created, a DELEGATE_TO_AGENT calling function
 * is automatically created and added to the Router's availableFunctions.
 * When deleted, the calling function is removed and Router's list is cleaned.
 * When a calling function is deleted, all FlowNodeConfig references are cleaned.
 *
 * All operations use Prisma transactions for atomicity.
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"

export class FlowSyncService {
  constructor(private prisma: PrismaClient) {}

  /**
   * After a FlowNodeConfig (Sub-LLM) is created, ensure a DELEGATE_TO_AGENT
   * calling function exists so the Router can dispatch to it.
   */
  async ensureCallingFunctionForFlow(
    workspaceId: string,
    flowKey: string,
    flowLabel: string
  ): Promise<void> {
    try {
      if (flowKey === "router") return

      const functionName = this.flowKeyToFunctionName(flowKey)

      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.workspaceCallingFunction.findUnique({
          where: { workspaceId_functionName: { workspaceId, functionName } },
        })

        if (!existing) {
          await tx.workspaceCallingFunction.create({
            data: {
              workspaceId,
              functionName,
              description: `Delegate to Sub-LLM: ${flowLabel}. Use when the customer needs help with ${flowLabel}.`,
              parameters: { type: "object", properties: {} },
              executionType: "DELEGATE_TO_AGENT",
              attachedFlowKey: flowKey,
              isActive: true,
              isSystemFunction: false,
            },
          })
          logger.info(`[FlowSync] Created calling function ${functionName} for flow ${flowKey}`)
        }

        await this.addFunctionToRouter(tx, workspaceId, functionName)
      })
    } catch (error) {
      logger.error(`[FlowSync] ensureCallingFunctionForFlow failed for ${flowKey}:`, error)
      throw error
    }
  }

  /**
   * Before a FlowNodeConfig (Sub-LLM) is deleted, remove its associated
   * calling function and clean up Router references.
   */
  async removeCallingFunctionForFlow(
    workspaceId: string,
    flowKey: string
  ): Promise<void> {
    try {
      if (flowKey === "router") return

      await this.prisma.$transaction(async (tx) => {
        const callingFunction = await tx.workspaceCallingFunction.findFirst({
          where: {
            workspaceId,
            executionType: "DELEGATE_TO_AGENT",
            attachedFlowKey: flowKey,
          },
        })

        if (callingFunction) {
          await this.removeFunctionFromRouter(tx, workspaceId, callingFunction.functionName)

          await tx.workspaceCallingFunction.delete({
            where: { id: callingFunction.id },
          })
          logger.info(`[FlowSync] Deleted calling function ${callingFunction.functionName} for flow ${flowKey}`)
        }
      })
    } catch (error) {
      logger.error(`[FlowSync] removeCallingFunctionForFlow failed for ${flowKey}:`, error)
      throw error
    }
  }

  /**
   * After a calling function is deleted, clean up any FlowNodeConfig
   * that references it in availableFunctions.
   */
  async cleanupOrphanedReferences(
    workspaceId: string,
    deletedFunctionName: string
  ): Promise<void> {
    try {
      const configs = await this.prisma.flowNodeConfig.findMany({
        where: { workspaceId },
      })

      for (const config of configs) {
        const functions = Array.isArray(config.availableFunctions)
          ? (config.availableFunctions as string[])
          : []

        if (functions.includes(deletedFunctionName)) {
          const updated = functions.filter((f) => f !== deletedFunctionName)
          await this.prisma.flowNodeConfig.update({
            where: { id: config.id },
            data: { availableFunctions: updated },
          })
          logger.info(
            `[FlowSync] Removed ${deletedFunctionName} from FlowNodeConfig ${config.flowKey} availableFunctions`
          )
        }
      }
    } catch (error) {
      logger.error(`[FlowSync] cleanupOrphanedReferences failed for ${deletedFunctionName}:`, error)
      throw error
    }
  }

  /**
   * When a DELEGATE_TO_AGENT calling function is created (from Custom Tools),
   * auto-add it to the Router's availableFunctions.
   */
  async addDelegateToRouter(
    workspaceId: string,
    functionName: string
  ): Promise<void> {
    try {
      await this.addFunctionToRouter(this.prisma, workspaceId, functionName)
    } catch (error) {
      logger.error(`[FlowSync] addDelegateToRouter failed for ${functionName}:`, error)
      throw error
    }
  }

  /**
   * When a Sub-LLM label is updated, sync the calling function description.
   */
  async updateCallingFunctionLabel(
    workspaceId: string,
    flowKey: string,
    newLabel: string
  ): Promise<void> {
    try {
      if (flowKey === "router") return

      const callingFunction = await this.prisma.workspaceCallingFunction.findFirst({
        where: {
          workspaceId,
          executionType: "DELEGATE_TO_AGENT",
          attachedFlowKey: flowKey,
        },
      })

      if (callingFunction) {
        await this.prisma.workspaceCallingFunction.update({
          where: { id: callingFunction.id },
          data: {
            description: `Delegate to Sub-LLM: ${newLabel}. Use when the customer needs help with ${newLabel}.`,
          },
        })
        logger.info(`[FlowSync] Updated calling function description for flow ${flowKey}`)
      }
    } catch (error) {
      logger.error(`[FlowSync] updateCallingFunctionLabel failed for ${flowKey}:`, error)
      throw error
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private flowKeyToFunctionName(flowKey: string): string {
    return flowKey.replace(/[^a-zA-Z0-9]/g, "_") + "Agent"
  }

  private async addFunctionToRouter(
    tx: any,
    workspaceId: string,
    functionName: string
  ): Promise<void> {
    const routerConfig = await tx.flowNodeConfig.findFirst({
      where: { workspaceId, flowKey: "router" },
    })

    if (!routerConfig) return

    const currentFunctions = Array.isArray(routerConfig.availableFunctions)
      ? (routerConfig.availableFunctions as string[])
      : []

    if (!currentFunctions.includes(functionName)) {
      await tx.flowNodeConfig.update({
        where: { id: routerConfig.id },
        data: { availableFunctions: [...currentFunctions, functionName] },
      })
      logger.info(`[FlowSync] Added ${functionName} to Router's availableFunctions`)
    }
  }

  private async removeFunctionFromRouter(
    tx: any,
    workspaceId: string,
    functionName: string
  ): Promise<void> {
    const routerConfig = await tx.flowNodeConfig.findFirst({
      where: { workspaceId, flowKey: "router" },
    })

    if (!routerConfig) return

    const currentFunctions = Array.isArray(routerConfig.availableFunctions)
      ? (routerConfig.availableFunctions as string[])
      : []

    if (currentFunctions.includes(functionName)) {
      const updated = currentFunctions.filter((f) => f !== functionName)
      await tx.flowNodeConfig.update({
        where: { id: routerConfig.id },
        data: { availableFunctions: updated },
      })
      logger.info(`[FlowSync] Removed ${functionName} from Router's availableFunctions`)
    }
  }
}
