/**
 * OperatorRelayService
 *
 * Core engine for the WhatsApp relay tunnel between customers and the human operator.
 *
 * ARCHITECTURE (sequential queue, "Philosophy 1"):
 * ─────────────────────────────────────────────────
 *  Customer A requests operator
 *    → contactOperator calls assignQueuePosition() → position 1 (served immediately)
 *    → Operator is notified via WhatsApp by contactOperator (existing logic)
 *    → All subsequent messages from Customer A are forwarded to operator (via webhook)
 *    → Operator replies from phone → relayed back to Customer A
 *
 *  Customer B requests operator (while A is active)
 *    → assignQueuePosition() → position 2
 *    → Customer B receives "You are #2 in queue" message
 *    → Operator is NOT yet notified (will be notified after A is done)
 *
 *  Operator sends "END"
 *    → Customer A: chatbot re-enabled + confirmation message sent
 *    → Queue is reordered (B becomes position 1)
 *    → Operator is notified about Customer B (summary + relay activated)
 *
 *  Customer B is now active:
 *    → Same relay loop starts
 *
 * OPERATOR IDENTIFICATION:
 *  The operator is identified by Workspace.operatorWhatsappNumber.
 *  Every inbound WA message from that number is intercepted BEFORE ChatEngine
 *  and routed to handleOperatorMessage().
 *
 * RELAY ROUTING:
 *  operator → customer: if originChannel="whatsapp" → WhatsAppQueue
 *                        if originChannel="widget"    → ConversationMessage (widget polling)
 *  customer → operator: always via WhatsAppQueue to operatorWhatsappNumber
 */

// ============================================================================
// IMPORTS
// ============================================================================

// External dependencies
import { PrismaClient } from "@echatbot/database"

// Internal
import logger from "../../utils/logger"
import { SecureTokenService } from "./secure-token.service"

const secureTokenService = new SecureTokenService()

// ============================================================================
// TYPES
// ============================================================================

/** Minimal customer projection used internally */
interface QueuedCustomer {
  id: string
  name: string
  phone: string | null
  originChannel: string | null
  operatorQueuePosition: number | null
  operatorQueueEnteredAt: Date | null
}

export interface AssignQueueResult {
  /** The assigned queue position (1 = served immediately, >1 = waiting) */
  position: number
}

// ============================================================================
// SERVICE
// ============================================================================

export class OperatorRelayService {
  constructor(private readonly prisma: PrismaClient) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Queue Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Assigns the next available queue position to a customer who just requested
   * human operator support.
   *
   * WHEN TO CALL: right after contactOperator() disables the chatbot
   * (i.e. after setting activeChatbot=false and operatorRequestedAt).
   *
   * SIDE EFFECTS:
   *  - Updates customers.operatorQueuePosition + operatorQueueEnteredAt
   *  - Returns position AND a localised message for the customer
   *
   * @param workspaceId - Workspace scope (security)
   * @param customerId  - Customer entering the queue
   * @returns AssignQueueResult with position and customer message
   */
  async assignQueuePosition(
    workspaceId: string,
    customerId: string
  ): Promise<AssignQueueResult> {
    // Find the highest current queue position in this workspace
    const aggregate = await this.prisma.customers.aggregate({
      where: {
        workspaceId,
        activeChatbot: false,
        operatorQueuePosition: { not: null },
      },
      _max: { operatorQueuePosition: true },
    })

    // Next position = max + 1 (first entry → position 1)
    const nextPosition = (aggregate._max.operatorQueuePosition ?? 0) + 1

    await this.prisma.customers.update({
      where: { id: customerId },
      data: {
        operatorQueuePosition: nextPosition,
        operatorQueueEnteredAt: new Date(),
      },
    })

    logger.info("[OperatorRelay] 📋 Customer assigned queue position", {
      workspaceId,
      customerId,
      position: nextPosition,
    })

    return { position: nextPosition }
  }

  /**
   * Returns the customer currently being served by the operator (lowest queue position).
   * Returns null if the queue is empty.
   */
  async getActiveCustomer(workspaceId: string): Promise<QueuedCustomer | null> {
    return this.prisma.customers.findFirst({
      where: {
        workspaceId,
        activeChatbot: false,
        operatorQueuePosition: { not: null },
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
  }

  /**
   * Returns all customers currently waiting in queue, ordered by position (FIFO).
   */
  async getQueuedCustomers(workspaceId: string): Promise<QueuedCustomer[]> {
    return this.prisma.customers.findMany({
      where: {
        workspaceId,
        activeChatbot: false,
        operatorQueuePosition: { not: null },
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
  }

  /**
   * Re-enables chatbot for a specific customer and processes the next one in queue.
   *
   * Used by the web app's POST /support-chat/done endpoint, where the operator
   * explicitly closes a conversation for a known customerId (not via "END" in WA).
   *
   * STEPS:
   *  1. Clear all queue / operator fields for the given customer
   *  2. Send confirmation message to the customer
   *  3. Reorder remaining queue
   *  4. Notify operator about next customer (if any)
   *
   * @param workspaceId  - Workspace scope
   * @param customerId   - The customer whose session is being closed
   */
  async releaseCustomerAndProcessNext(
    workspaceId: string,
    customerId: string
  ): Promise<void> {
    // Load the customer before clearing (need name/phone/originChannel for notification)
    const customer = await this.prisma.customers.findFirst({
      where: { id: customerId, workspaceId },
      select: {
        id: true,
        name: true,
        phone: true,
        originChannel: true,
        operatorQueuePosition: true,
        operatorQueueEnteredAt: true,
      },
    })

    if (!customer) {
      logger.warn("[OperatorRelay] releaseCustomerAndProcessNext: customer not found", {
        customerId,
        workspaceId,
      })
      return
    }

    // 1. Re-enable chatbot and clear all operator/queue metadata
    await this.prisma.customers.update({
      where: { id: customerId },
      data: {
        activeChatbot: true,
        operatorRequestedAt: null,
        operatorQueuePosition: null,
        operatorQueueEnteredAt: null,
        originChannel: null,
      },
    })

    // 2. Notify customer that the session ended
    await this.relayToCustomer(
      customer,
      workspaceId,
      "✅ The operator session has ended. You can now continue chatting with the assistant. Have a great day! 😊"
    )

    logger.info("[OperatorRelay] ✅ Customer released via web app done endpoint", {
      customerId,
      workspaceId,
    })

    // 3. Reorder remaining queue
    await this.reorderQueue(workspaceId)

    // 4. Notify operator about queue status (empty or dashboard link)
    const remaining = await this.getQueuedCustomers(workspaceId)
    if (remaining.length === 0) {
      logger.info("[OperatorRelay] Queue empty after web app done", { workspaceId })
      await this.sendMessageToOperator(workspaceId, "✅ All done! Queue empty.", customerId)
    } else {
      await this.sendDashboardLinkToOperator(workspaceId, remaining.length, customerId)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Operator-side message handling
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Entry point for messages arriving FROM the operator's WhatsApp number.
   *
   * Called by the WhatsApp webhook controller BEFORE the normal ChatEngine flow,
   * whenever the inbound sender matches Workspace.operatorWhatsappNumber.
   *
   * RULES:
   *  - "END" (case-insensitive) → processEndCommand()
   *  - Any other text → relay to the currently active customer
   *
   * @param workspaceId  - Workspace scope
   * @param messageText  - Raw message from operator
   */
  async handleOperatorMessage(
    workspaceId: string,
    messageText: string
  ): Promise<void> {
    const trimmed = messageText.trim()

    logger.info("[OperatorRelay] 📩 Message from operator", {
      workspaceId,
      messageLength: trimmed.length,
      isEnd: trimmed.toUpperCase() === "END",
    })

    // "END" terminates the current session and moves to the next customer
    if (trimmed.toUpperCase() === "END") {
      await this.processEndCommand(workspaceId)
      return
    }

    // Regular reply: relay to the customer currently being served
    const activeCustomer = await this.getActiveCustomer(workspaceId)

    if (!activeCustomer) {
      logger.warn(
        "[OperatorRelay] ⚠️ Operator sent message but queue is empty",
        { workspaceId }
      )
      // Optionally notify operator — we do nothing silently to avoid noise
      return
    }

    await this.relayToCustomer(activeCustomer, workspaceId, trimmed)
  }

  /**
   * Processes the "END" command sent by the operator.
   *
   * STEPS:
   *  1. Re-enable chatbot for the currently active customer (position 1)
   *  2. Send confirmation message to that customer
   *  3. Remove their queue entry
   *  4. If queue has more customers: reorder positions + notify operator
   *
   * @param workspaceId - Workspace scope
   */
  async processEndCommand(workspaceId: string): Promise<void> {
    const activeCustomer = await this.getActiveCustomer(workspaceId)

    if (!activeCustomer) {
      logger.info("[OperatorRelay] END command received but queue is empty", {
        workspaceId,
      })
      return
    }

    logger.info("[OperatorRelay] 🔓 END command — releasing customer from queue", {
      workspaceId,
      customerId: activeCustomer.id,
      customerName: activeCustomer.name,
    })

    // 1. Re-enable chatbot and clear all queue/operator metadata
    await this.prisma.customers.update({
      where: { id: activeCustomer.id },
      data: {
        activeChatbot: true,
        operatorRequestedAt: null,
        operatorQueuePosition: null,
        operatorQueueEnteredAt: null,
        originChannel: null,
      },
    })

    // 2. Notify the customer that the operator session has ended
    await this.relayToCustomer(
      activeCustomer,
      workspaceId,
      "✅ The operator session has ended. You can now continue chatting with the assistant. Have a great day! 😊"
    )

    logger.info("[OperatorRelay] ✅ Chatbot re-enabled for customer", {
      customerId: activeCustomer.id,
    })

    // 3. Get remaining queue AFTER releasing the active customer
    //    (the update above cleared operatorQueuePosition, so they no longer appear)
    const remaining = await this.getQueuedCustomers(workspaceId)

    if (remaining.length === 0) {
      logger.info("[OperatorRelay] 🎉 Queue empty — all customers served", {
        workspaceId,
      })
      await this.sendMessageToOperator(workspaceId, "✅ All done! Queue empty.", activeCustomer.id)
      return
    }

    // 4. Reorder positions (1, 2, 3...) and send dashboard link to operator
    await this.reorderQueue(workspaceId)
    await this.sendDashboardLinkToOperator(workspaceId, remaining.length, activeCustomer.id)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Customer-side message relay
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Relays a customer message to the operator's WhatsApp number.
   *
   * Called from the webhook controller when a customer with activeChatbot=false
   * sends a new message (their messages must go to the operator, not the LLM).
   *
   * ROUTE: always via WhatsAppQueue → operator's phone
   *
   * @param workspaceId - Workspace scope
   * @param customer    - Minimal customer data (id, name, phone)
   * @param messageText - The customer's raw message
   */
  async relayCustomerMessageToOperator(
    workspaceId: string,
    customer: { id: string; name: string; phone: string | null },
    messageText: string
  ): Promise<void> {
    // Fetch workspace operator number AND the customer's assigned sales agent phone.
    // PRIORITY (mirrors contactOperator.ts):
    //  1. Sales agent's phone (if customer has salesId)
    //  2. Workspace generic operator number
    const [workspace, fullCustomer] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { operatorWhatsappNumber: true },
      }),
      this.prisma.customers.findUnique({
        where: { id: customer.id },
        select: { salesId: true, sales: { select: { phone: true } } },
      }),
    ])

    const targetPhone =
      (fullCustomer?.salesId && fullCustomer.sales?.phone) ||
      workspace?.operatorWhatsappNumber ||
      null

    if (!targetPhone) {
      logger.warn(
        "[OperatorRelay] ⚠️ Cannot relay customer message — no operator phone configured",
        { workspaceId, customerId: customer.id }
      )
      return
    }

    // Format message so operator knows who is writing
    const relayMessage = `📩 *${customer.name}* (${customer.phone ?? "widget"}):\n\n${messageText}`

    await this.prisma.whatsAppQueue.create({
      data: {
        workspaceId,
        customerId: customer.id,        // used for billing reference
        phoneNumber: targetPhone,
        messageContent: relayMessage,
        status: "pending",
        channel: "whatsapp",
        skipSecurityCheck: true,        // internal relay — no security checks needed
      },
    })

    logger.info("[OperatorRelay] 📤 Customer message relayed to operator", {
      workspaceId,
      customerId: customer.id,
      targetPhone,
      via: fullCustomer?.salesId ? "sales_agent" : "workspace_operator",
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Relay operator message to customer
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Delivers a message from the operator to the customer.
   *
   * ROUTING LOGIC:
   *  - originChannel="whatsapp" → enqueue in WhatsAppQueue (scheduler sends it)
   *  - originChannel="widget" (or null) → insert ConversationMessage (widget polls for it)
   *
   * @param customer    - QueuedCustomer (includes originChannel)
   * @param workspaceId - Workspace scope
   * @param message     - Text to deliver to customer
   */
  async relayToCustomer(
    customer: QueuedCustomer | { id: string; name: string; phone: string | null; originChannel: string | null },
    workspaceId: string,
    message: string
  ): Promise<void> {
    const channel = customer.originChannel ?? "widget"

    if (channel === "whatsapp" && customer.phone) {
      // ── WhatsApp customer ──────────────────────────────────────────────
      await this.prisma.whatsAppQueue.create({
        data: {
          workspaceId,
          customerId: customer.id,
          phoneNumber: customer.phone,
          messageContent: message,
          status: "pending",
          channel: "whatsapp",
          skipSecurityCheck: true, // operator replies bypass security
        },
      })

      logger.info("[OperatorRelay] 📨 Operator reply enqueued for WhatsApp customer", {
        customerId: customer.id,
        phone: customer.phone,
      })
    } else {
      // ── Widget customer ────────────────────────────────────────────────
      const session = await this.prisma.chatSession.findFirst({
        where: { customerId: customer.id, status: "active" },
        orderBy: { createdAt: "desc" },
      })

      if (!session) {
        logger.warn(
          "[OperatorRelay] ⚠️ No active session for widget customer — cannot relay",
          { customerId: customer.id }
        )
        return
      }

      await this.prisma.conversationMessage.create({
        data: {
          conversationId: session.id,
          customerId: customer.id,
          workspaceId,
          role: "assistant",
          content: message,
        },
      })

      logger.info("[OperatorRelay] 📨 Operator reply saved to ConversationMessage for widget customer", {
        customerId: customer.id,
        sessionId: session.id,
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Renumbers all queued customers starting from 1 (FIFO order preserved by
   * operatorQueueEnteredAt as secondary sort).
   * Called after a customer exits the queue (END command).
   */
  private async reorderQueue(workspaceId: string): Promise<void> {
    // Re-fetch remaining queue ordered by current position + entry time
    const remaining = await this.prisma.customers.findMany({
      where: {
        workspaceId,
        activeChatbot: false,
        operatorQueuePosition: { not: null },
      },
      orderBy: [
        { operatorQueuePosition: "asc" },
        { operatorQueueEnteredAt: "asc" },
      ],
      select: { id: true },
    })

    // Assign positions 1, 2, 3, ...
    for (let i = 0; i < remaining.length; i++) {
      await this.prisma.customers.update({
        where: { id: remaining[i].id },
        data: { operatorQueuePosition: i + 1 },
      })
    }

    logger.info("[OperatorRelay] 🔢 Queue reordered", {
      workspaceId,
      queueLength: remaining.length,
    })
  }

  /**
   * Sends a WhatsApp message directly to the operator's phone number.
   * Reads operatorWhatsappNumber from workspace (with agentPhone fallback if available).
   *
   * @param workspaceId - Workspace scope
   * @param message     - Text to send to operator
   */
  private async sendMessageToOperator(
    workspaceId: string,
    message: string,
    customerId: string
  ): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { operatorWhatsappNumber: true },
    })

    if (!workspace?.operatorWhatsappNumber) {
      logger.warn(
        "[OperatorRelay] ⚠️ Cannot send message to operator — operatorWhatsappNumber not configured",
        { workspaceId }
      )
      return
    }

    await this.prisma.whatsAppQueue.create({
      data: {
        workspaceId,
        customerId,
        phoneNumber: workspace.operatorWhatsappNumber,
        messageContent: message,
        status: "pending",
        channel: "whatsapp",
        skipSecurityCheck: true,
      },
    })

    logger.info("[OperatorRelay] 📤 Message sent to operator", {
      workspaceId,
      operatorPhone: workspace.operatorWhatsappNumber,
    })
  }

  /**
   * Generates an operator_dashboard token and sends the dashboard URL to the operator.
   * Called after END or done when there are still customers waiting in queue.
   *
   * @param workspaceId  - Workspace scope
   * @param queueLength  - Number of customers still waiting
   */
  private async sendDashboardLinkToOperator(
    workspaceId: string,
    queueLength: number,
    customerId: string
  ): Promise<void> {
    try {
      const dashboardToken = await secureTokenService.createToken(
        "operator_dashboard",
        workspaceId,
        { workspaceId },
        "48h"
      )

      const frontendUrl = process.env.FRONTEND_URL || "https://www.echatbot.ai"
      const dashboardUrl = `${frontendUrl}/operator-dashboard?token=${dashboardToken}`

      const message = [
        "✅ Chat closed.",
        `👥 ${queueLength} customer(s) waiting.`,
        `Choose next: ${dashboardUrl}`,
      ].join("\n")

      await this.sendMessageToOperator(workspaceId, message, customerId)

      logger.info("[OperatorRelay] 📊 Dashboard link sent to operator", {
        workspaceId,
        queueLength,
        dashboardUrl,
      })
    } catch (error) {
      logger.error("[OperatorRelay] ❌ Failed to send dashboard link to operator", {
        workspaceId,
        error,
      })
    }
  }
}
