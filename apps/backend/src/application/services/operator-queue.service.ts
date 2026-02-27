/**
 * OperatorQueueService
 *
 * Provides data for the operator selection dashboard:
 *  - getWaitingCustomers: list of customers waiting in queue with wait time
 *  - generateAISummary: on-demand AI summary of last 5 messages (max 150 chars)
 *  - assignCustomer: create a support_chat token for a chosen customer
 *
 * DESIGN: AI summary is on-demand (called for each customer in /queue endpoint)
 * so the operator can decide who to handle based on urgency.
 */

// ============================================================================
// IMPORTS
// ============================================================================
import axios from "axios"
import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import { getLLMConfig } from "../../config/llm.config"
import { SecureTokenService } from "./secure-token.service"

// ============================================================================
// TYPES
// ============================================================================

export interface QueueEntry {
  customerId: string
  name: string
  phone: string | null
  channel: string | null
  position: number
  waitMinutes: number
  aiSummary: string
}

export interface AssignResult {
  token: string
  chatUrl: string
}

// ============================================================================
// SERVICE
// ============================================================================

export class OperatorQueueService {
  private readonly secureTokenService: SecureTokenService

  constructor(private readonly prisma: PrismaClient) {
    this.secureTokenService = new SecureTokenService()
  }

  /**
   * Returns all customers waiting in the operator queue, ordered by position.
   * Enriches each entry with waitMinutes calculated from operatorQueueEnteredAt.
   */
  async getWaitingCustomers(workspaceId: string): Promise<Omit<QueueEntry, "aiSummary">[]> {
    const customers = await this.prisma.customers.findMany({
      where: {
        workspaceId,
        activeChatbot: false,
        operatorQueuePosition: { not: null },
        deletedAt: null,
      },
      orderBy: { operatorQueuePosition: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        originChannel: true,
        operatorQueuePosition: true,
        operatorQueueEnteredAt: true,
      },
    })

    const now = new Date()

    return customers.map((c) => ({
      customerId: c.id,
      name: c.name,
      phone: c.phone,
      channel: c.originChannel,
      position: c.operatorQueuePosition!,
      waitMinutes: c.operatorQueueEnteredAt
        ? Math.floor((now.getTime() - c.operatorQueueEnteredAt.getTime()) / 60_000)
        : 0,
    }))
  }

  /**
   * Generates an AI summary of the last 5 user messages for a customer.
   * Max 150 characters. Falls back gracefully if LLM fails.
   */
  async generateAISummary(workspaceId: string, customerId: string): Promise<string> {
    try {
      // Fetch last 5 user messages from the active session
      const session = await this.prisma.chatSession.findFirst({
        where: { customerId, status: "active" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })

      if (!session) {
        return "Customer request (no session found)"
      }

      const messages = await this.prisma.conversationMessage.findMany({
        where: {
          conversationId: session.id,
          role: "user",
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { content: true },
      })

      if (messages.length === 0) {
        return "Customer request (no messages found)"
      }

      // Reverse to chronological order
      const history = messages.reverse().map((m) => m.content).join("\n")

      // Call LLM via OpenRouter for a short summary
      const llmConfig = getLLMConfig("openai/gpt-4o-mini")

      const response = await axios.post(
        `${llmConfig.baseURL}/chat/completions`,
        {
          model: llmConfig.model,
          messages: [
            {
              role: "system",
              content:
                "You are a concise summarizer. Summarize the customer messages in one short sentence (max 150 characters). Focus on what they need. Respond in plain text only.",
            },
            {
              role: "user",
              content: `Customer messages:\n${history}\n\nSummary (max 150 chars):`,
            },
          ],
          max_tokens: 60,
          temperature: 0.3,
        },
        {
          headers: {
            Authorization: `Bearer ${llmConfig.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 8000,
        }
      )

      const summary: string =
        response.data?.choices?.[0]?.message?.content?.trim() || ""

      if (!summary) {
        return "Customer request (no summary available)"
      }

      // Truncate to 150 chars just in case
      return summary.length > 150 ? summary.slice(0, 147) + "..." : summary
    } catch (error) {
      logger.warn("[OperatorQueue] ⚠️ AI summary generation failed, using fallback", {
        workspaceId,
        customerId,
        error: error instanceof Error ? error.message : error,
      })
      return "Customer request (no summary available)"
    }
  }

  /**
   * Creates a support_chat token for the chosen customer so the operator can
   * open the direct chat page without logging in.
   *
   * Returns the token string and the ready-to-open chat URL.
   */
  async assignCustomer(workspaceId: string, customerId: string): Promise<AssignResult> {
    // Verify customer is still in queue (workspace-isolated)
    const customer = await this.prisma.customers.findFirst({
      where: {
        id: customerId,
        workspaceId,
        activeChatbot: false,
        operatorQueuePosition: { not: null },
        deletedAt: null,
      },
      select: { id: true, originChannel: true },
    })

    if (!customer) {
      throw new Error("CUSTOMER_NOT_IN_QUEUE")
    }

    const activeSession = await this.prisma.chatSession.findFirst({
      where: { customerId, status: "active" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })

    const token = await this.secureTokenService.createToken(
      "support_chat",
      workspaceId,
      {
        customerId,
        sessionId: activeSession?.id,
        channel: customer.originChannel ?? "widget",
      },
      "48h",
      undefined,
      undefined,
      undefined,
      customerId
    )

    const frontendUrl = process.env.FRONTEND_URL || "https://www.echatbot.ai"
    const chatUrl = `${frontendUrl}/support-chat?token=${token}`

    logger.info("[OperatorQueue] ✅ Customer assigned, support_chat token created", {
      workspaceId,
      customerId,
      chatUrl,
    })

    return { token, chatUrl }
  }
}
