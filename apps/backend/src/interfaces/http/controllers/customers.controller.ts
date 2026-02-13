import { prisma } from "@echatbot/database"
import { NextFunction, Request, Response } from "express"
import { BillingService } from "../../../application/services/billing.service"
import { CustomerService } from "../../../application/services/customer.service"
import { RegistrationService } from "../../../application/services/registration.service"
import { pushMessagingService } from "../../../services/push-messaging.service"
import { websocketService } from "../../../services/websocket.service"
import { normalizeTags } from "../../../utils/tag-normalizer"
import logger from "../../../utils/logger"

// prisma imported

export class CustomersController {
  private customerService: CustomerService
  private billingService: BillingService
  private registrationService: RegistrationService
  private pushMessagingService = pushMessagingService

  constructor() {
    this.customerService = new CustomerService()
    this.billingService = new BillingService(prisma)
    this.registrationService = new RegistrationService()
  }

  async getCustomersForWorkspace(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { workspaceId } = req.params

      const customers =
        await this.customerService.getActiveForWorkspace(workspaceId)

      res.json({ data: customers })
    } catch (error) {
      logger.error("Error getting customers:", error)
      next(error)
    }
  }

  async getCustomerById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, workspaceId } = req.params

      const customer = await this.customerService.getById(id, workspaceId)

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" })
      }

      res.json(customer)
    } catch (error) {
      const id = req.params.id
      logger.error(`Error getting customer ${id}:`, error)
      next(error)
    }
  }

  async createCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params
      const {
        name,
        email,
        phone,
        address,
        company,
        discount,
        language,
        notes,
        tags,
        serviceIds,
        isActive,
        last_privacy_version_accepted,
        push_notifications_consent,
        gdprConsent,
        pushNotificationsConsent,
        activeChatbot,
        isBlacklisted,
        invoiceAddress,
        salesId,
      } = req.body

      const customerData = {
        name,
        email,
        phone,
        address,
        company,
        discount,
        language,
        notes,
        tags: normalizeTags(tags),
        serviceIds,
        workspaceId,
        isActive: isActive !== undefined ? isActive : true,
        activeChatbot: activeChatbot !== undefined ? activeChatbot : true,
        isBlacklisted: isBlacklisted !== undefined ? isBlacklisted : false,
        last_privacy_version_accepted: gdprConsent
          ? "v1.0"
          : last_privacy_version_accepted,
        push_notifications_consent:
          pushNotificationsConsent !== undefined
            ? pushNotificationsConsent
            : push_notifications_consent || false,
        push_notifications_consent_at:
          pushNotificationsConsent || push_notifications_consent
            ? new Date()
            : undefined,
        privacy_accepted_at: gdprConsent
          ? new Date()
          : last_privacy_version_accepted
            ? new Date()
            : undefined,
        invoiceAddress,
        salesId: salesId || undefined,
      }

      const customer = await this.customerService.create(customerData)

      res.status(201).json(customer)
    } catch (error: any) {
      logger.error("Error creating customer:", error)
      if (
        error.message === "A customer with this email already exists" ||
        error.message === "A customer with this phone number already exists" ||
        error.message === "Invalid customer data"
      ) {
        return res.status(400).json({ message: error.message })
      }
      next(error)
    }
  }

  async updateCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, workspaceId } = req.params

      logger.info("=== CONTROLLER RAW BODY ===")
      logger.info("typeof req.body:", typeof req.body)
      logger.info("req.body:", req.body)
      logger.info("req.body.salesId:", req.body.salesId)
      logger.info("'salesId' in req.body:", "salesId" in req.body)
      logger.info("Object.keys(req.body):", Object.keys(req.body))
      logger.info("===========================")
      const {
        name,
        email,
        phone,
        address,
        isActive,
        company,
        discount,
        language,
        notes,
        tags,
        serviceIds,
        last_privacy_version_accepted,
        push_notifications_consent,
        gdprConsent,
        pushNotificationsConsent,
        activeChatbot,
        invoiceAddress,
        isBlacklisted,
        salesId,
      } = req.body

      logger.info("=== AFTER DESTRUCTURING ===")
      logger.info("salesId variable:", salesId)
      logger.info("typeof salesId:", typeof salesId)
      logger.info("salesId === undefined:", salesId === undefined)
      logger.info("salesId === null:", salesId === null)
      logger.info("===========================")
      // Get original customer data to compare changes
      const originalCustomer = await this.customerService.getById(
        id,
        workspaceId
      )
      if (!originalCustomer) {
        return res.status(404).json({ message: "Customer not found" })
      }

      // Validate required fields if attempting to update them
      if (name !== undefined && (!name || name.trim() === "")) {
        return res.status(400).json({ message: "Name is required" })
      }

      if (email !== undefined && (!email || email.trim() === "")) {
        return res.status(400).json({ message: "Email is required" })
      }

      // If no valid update fields are provided, return 400
      if (Object.keys(req.body).length === 0) {
        return res
          .status(400)
          .json({ message: "No valid update data provided" })
      }

      // Prepare update data with only defined values
      const customerData: any = {}

      if (name !== undefined) customerData.name = name
      if (email !== undefined) customerData.email = email
      if (phone !== undefined) customerData.phone = phone
      if (address !== undefined) customerData.address = address
      if (isActive !== undefined) customerData.isActive = isActive

      // 🔄 AUTO-ACTIVATE: If customer was inactive (temporary from new channel)
      // and is being updated with a valid name AND real email, activate them automatically
      // 🚨 CRITICAL: Do NOT auto-activate if email is still temporary (temp_*@pending.com)
      // This prevents showing prices to non-registered users (Rule #4)
      const hasRealEmail = email 
        ? !email.includes('@pending.com')
        : originalCustomer.email && !originalCustomer.email.includes('@pending.com')
      
      if (
        originalCustomer.isActive === false &&
        isActive === undefined &&
        name !== undefined &&
        name.trim() !== "" &&
        name !== "New Customer" &&
        hasRealEmail // 🔒 NEW: Require real email for auto-activation
      ) {
        customerData.isActive = true
        logger.info(`Auto-activating customer ${id} - valid name AND real email provided`)
      }
      if (company !== undefined) customerData.company = company
      if (discount !== undefined) customerData.discount = discount
      if (language !== undefined) customerData.language = language
      if (notes !== undefined) customerData.notes = notes
      if (tags !== undefined) customerData.tags = normalizeTags(tags)
      if (serviceIds !== undefined) customerData.serviceIds = serviceIds
      if (last_privacy_version_accepted !== undefined) {
        customerData.last_privacy_version_accepted =
          last_privacy_version_accepted
        customerData.privacy_accepted_at = new Date()
      }
      if (gdprConsent !== undefined) {
        customerData.last_privacy_version_accepted = gdprConsent
          ? "v1.0"
          : undefined
        customerData.privacy_accepted_at = gdprConsent ? new Date() : undefined
      }
      if (push_notifications_consent !== undefined) {
        customerData.push_notifications_consent = push_notifications_consent
        if (push_notifications_consent) {
          customerData.push_notifications_consent_at = new Date()
        }
      }
      if (pushNotificationsConsent !== undefined) {
        customerData.push_notifications_consent = pushNotificationsConsent
        if (pushNotificationsConsent) {
          customerData.push_notifications_consent_at = new Date()
        }
      }
      if (activeChatbot !== undefined)
        customerData.activeChatbot = activeChatbot
      if (invoiceAddress !== undefined)
        customerData.invoiceAddress = invoiceAddress
      if (isBlacklisted !== undefined)
        customerData.isBlacklisted = isBlacklisted
      if (salesId !== undefined) customerData.salesId = salesId

      logger.info("=== UPDATE CUSTOMER DEBUG ===")
      logger.info("salesId from req.body:", salesId)
      logger.info("salesId in customerData:", customerData.salesId)
      logger.info("Updating customer with data:", {
        id,
        workspaceId,
        ...customerData,
      })
      logger.info("=============================")

      const updatedCustomer = await this.customerService.update(
        id,
        workspaceId,
        customerData
      )

      // 🔔 CRITICAL: Notify WebSocket clients if customer blocked/unblocked
      if (
        isBlacklisted !== undefined &&
        originalCustomer.isBlacklisted !== isBlacklisted
      ) {
        const eventName = isBlacklisted ? "user-blocked" : "user-unblocked"
        websocketService.notifyUserBlocked(workspaceId, {
          customerId: id,
          customerName: updatedCustomer.name || "Unknown",
          customerPhone: updatedCustomer.phone || "",
          isBlacklisted: isBlacklisted,
          timestamp: new Date().toISOString(),
        })

        logger.info(
          `[CUSTOMER-UPDATE] 🔔 WebSocket ${eventName} event sent for customer ${id}`
        )
      }

      // 🔔 Feature 127: Notify WebSocket clients if chatbot enabled/disabled
      if (
        activeChatbot !== undefined &&
        originalCustomer.activeChatbot !== activeChatbot
      ) {
        // Emit chat-updated event to refresh customer list UI
        websocketService.notifyChatUpdated(workspaceId, {
          customerId: id,
          customerName: updatedCustomer.name || "Unknown",
          activeChatbot: activeChatbot,
          timestamp: new Date().toISOString(),
        })

        logger.info(
          `[CUSTOMER-UPDATE] 🔔 WebSocket chat-updated event sent for customer ${id} (chatbot: ${activeChatbot})`
        )
      }

      // Handle automatic push messages for relevant changes
      await this.handleAutomaticPushMessages(originalCustomer, updatedCustomer)

      res.json({ data: updatedCustomer })
    } catch (error) {
      logger.error("Error updating customer:", error)
      next(error)
    }
  }

  /**
   * Handle automatic push messages when customer data changes
   *
   * 🚨 DISABLED: All notifications now handled via /push/system-notification
   *    with frontend confirmation popup (Feature 127)
   *    - Discount notifications: via popup confirmation
   *    - Chatbot reactivation: via popup confirmation  
   *    - Account activation: via popup confirmation
   */
  private async handleAutomaticPushMessages(
    originalCustomer: any,
    updatedCustomer: any
  ) {
    try {
      // Check if chatbot status changed - LOG ONLY (notification handled by frontend popup)
      if (originalCustomer.activeChatbot !== updatedCustomer.activeChatbot) {
        logger.info(
          `Customer chatbot status changed from ${originalCustomer.activeChatbot} to ${updatedCustomer.activeChatbot}`,
          {
            customerId: updatedCustomer.id,
            workspaceId: updatedCustomer.workspaceId,
          }
        )

        // 🚨 DISABLED: Push notification now handled by frontend confirmation popup
        // The frontend will show a dialog asking admin if they want to notify the customer
        // If confirmed, it calls POST /push/system-notification with CHATBOT_REACTIVATED type
        if (!originalCustomer.activeChatbot && updatedCustomer.activeChatbot) {
          logger.info(
            `[PUSH-DISABLED] Chatbot reactivation for customer ${updatedCustomer.id} - notification handled by frontend popup`
          )
        }
      }
    } catch (error) {
      logger.error("Error handling automatic push messages:", error)
      // Don't throw error - automatic push failures shouldn't break customer update
    }
  }

  async deleteCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, workspaceId } = req.params

      logger.info("Starting customer deletion process:", { id, workspaceId })

      try {
        const success = await this.customerService.delete(id, workspaceId)

        if (!success) {
          return res.status(404).json({ message: "Customer not found" })
        }

        logger.info("Customer deletion completed successfully")
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "Customer not found") {
          return res.status(404).json({ message: "Customer not found" })
        }
        throw error
      }
    } catch (error) {
      logger.error("Error deleting customer:", error)
      // Send a more detailed error response
      res.status(500).json({
        message: "Failed to delete customer",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * Block a customer (set isBlacklisted to true)
   */
  async blockCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, workspaceId } = req.params

      // Rileva se si tratta dell'endpoint alternativo con 'bloc'
      const isAlternativeEndpoint =
        req.originalUrl.includes("/bloc") && !req.originalUrl.includes("/block")

      logger.info("⛔ Blocking customer API call received:", {
        id,
        workspaceId,
        originalUrl: req.originalUrl,
        method: req.method,
        path: req.path,
        params: req.params,
        route: req.route,
        isAlternativeEndpoint,
      })

      try {
        const customer = await this.customerService.blockCustomer(
          id,
          workspaceId
        )

        logger.info("Customer blocked successfully")
        return res.status(200).json({
          message: "Customer blocked successfully",
          customer,
        })
      } catch (error: any) {
        if (error.message === "Customer not found") {
          return res.status(404).json({ message: "Customer not found" })
        }
        throw error
      }
    } catch (error) {
      logger.error("Error blocking customer:", error)
      next(error)
    }
  }

  /**
   * Unblock a customer (set isBlacklisted to false)
   */
  async unblockCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, workspaceId } = req.params

      logger.info("✅ Unblocking customer API call received:", {
        id,
        workspaceId,
        originalUrl: req.originalUrl,
        method: req.method,
        path: req.path,
        params: req.params,
        route: req.route,
      })

      try {
        const customer = await this.customerService.unblockCustomer(
          id,
          workspaceId
        )

        // Note: NEW_CUSTOMER billing (€1.00) is now tracked at registration time
        // not when admin unblocks, since new users are no longer blocked by default

        logger.info("Customer unblocked successfully")
        return res.status(200).json({
          message: "Customer unblocked successfully",
          customer,
        })
      } catch (error: any) {
        if (error.message === "Customer not found") {
          return res.status(404).json({ message: "Customer not found" })
        }
        throw error
      }
    } catch (error) {
      logger.error("Error unblocking customer:", error)
      next(error)
    }
  }

  // 🆕 Feature 174: Removed deleteRegistrationAttempt() - RegistrationAttempts table no longer used


  /**
   * Count all "Unknown Customer" records in a workspace
   */
  async countUnknownCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params

      const count =
        await this.customerService.countUnknownCustomers(workspaceId)

      res.json({ count })
    } catch (error) {
      logger.error("Error counting unknown customers:", error)
      next(error)
    }
  }

  /**
   * TASK 3: Operator Control Release Mechanism
   *
   * Endpoint specifico per gestire il controllo del chatbot.
   * Permette agli operatori di rilasciare/riprendere il controllo AI.
   *
   * PUT /api/workspaces/:workspaceId/customers/:customerId/chatbot-control
   * Body: { activeChatbot: boolean, reason?: string }
   */
  async updateChatbotControl(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId, workspaceId } = req.params
      const { activeChatbot, reason } = req.body

      // Validazione input
      if (typeof activeChatbot !== "boolean") {
        return res.status(400).json({
          message: "activeChatbot must be a boolean value",
        })
      }

      logger.info(
        `[TASK3] CHATBOT_CONTROL_CHANGE_REQUEST: customer-${customerId} activeChatbot=${activeChatbot} in workspace-${workspaceId}`,
        {
          customerId,
          workspaceId,
          activeChatbot,
          reason: reason || "No reason provided",
          requestedBy: req.user?.id || req.user?.userId || "unknown", // Compatibility with different token formats
        }
      )

      // Verifica che il customer esista
      const existingCustomer = await this.customerService.getById(
        customerId,
        workspaceId
      )
      if (!existingCustomer) {
        logger.warn(
          `[TASK3] CHATBOT_CONTROL_CHANGE_FAILED: customer-${customerId} not found in workspace-${workspaceId}`
        )
        return res.status(404).json({ message: "Customer not found" })
      }

      // Aggiorna solo il campo activeChatbot
      const updateData = {
        activeChatbot,
        // Aggiungiamo metadata per tracking
        chatbotControlChangedAt: new Date(),
        chatbotControlChangedBy: req.user?.id || req.user?.userId || "unknown",
        chatbotControlChangeReason: reason || null,
      }

      const updatedCustomer = await this.customerService.update(
        customerId,
        workspaceId,
        updateData
      )

      // Logging dettagliato per audit
      logger.info(
        `[TASK3] CHATBOT_CONTROL_CHANGED: customer-${customerId} activeChatbot=${activeChatbot} by user-${(req as any).user?.id || (req as any).user?.userId || "unknown"}`,
        {
          customerId,
          workspaceId,
          previousState: existingCustomer.activeChatbot,
          newState: activeChatbot,
          reason: reason || "No reason provided",
          changedBy: (req as any).user?.id || (req as any).user?.userId || "unknown",
          timestamp: new Date().toISOString(),
        }
      )

      // Risposta con informazioni utili
      res.json({
        success: true,
        customer: {
          id: updatedCustomer.id,
          name: updatedCustomer.name,
          phone: updatedCustomer.phone,
          activeChatbot: updatedCustomer.activeChatbot,
        },
        change: {
          previousState: existingCustomer.activeChatbot,
          newState: activeChatbot,
          reason: reason || null,
          changedAt: new Date().toISOString(),
          changedBy: (req as any).user?.id || (req as any).user?.userId || "unknown",
        },
        message: activeChatbot
          ? "Chatbot control activated - AI will handle messages"
          : "Chatbot control deactivated - Manual operator control active",
      })
    } catch (error: any) {
      logger.error(
        `[TASK3] CHATBOT_CONTROL_CHANGE_ERROR: customer-${req.params.customerId}:`,
        error
      )

      if (error.message === "Customer not found") {
        return res.status(404).json({ message: "Customer not found" })
      }

      next(error)
    }
  }

  /**
   * Check if phone number already exists in workspace
   * Used for frontend real-time validation
   */
  async checkPhoneExists(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params
      const { phone } = req.query

      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ error: "Phone number is required" })
      }

      const existingCustomer = await prisma.customers.findFirst({
        where: {
          phone: phone as string,
          workspaceId,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })

      res.json({
        exists: !!existingCustomer,
        customer: existingCustomer || null,
      })
    } catch (error) {
      logger.error("Error checking phone existence:", error)
      next(error)
    }
  }

  /**
   * Check if email already exists in workspace
   * Used for frontend real-time validation
   */
  async checkEmailExists(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params
      const { email } = req.query

      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" })
      }

      const existingCustomer = await prisma.customers.findFirst({
        where: {
          email: email as string,
          workspaceId,
        },
        select: {
          id: true,
          name: true,
          phone: true,
        },
      })

      res.json({
        exists: !!existingCustomer,
        customer: existingCustomer || null,
      })
    } catch (error) {
      logger.error("Error checking email existence:", error)
      next(error)
    }
  }

  /**
   * Approve a customer registration (set registrationStatus to ACTIVE)
   * 
   * Called when workspace has requireManualApproval=true and admin approves
   * a customer in PENDING_APPROVAL status.
   * 
   * POST /api/workspaces/:workspaceId/customers/:id/approve
   */
  async approveCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, workspaceId } = req.params

      logger.info("✅ Approving customer registration:", { id, workspaceId })

      // Get customer to verify current status
      const customer = await prisma.customers.findFirst({
        where: { id, workspaceId },
        select: { 
          id: true, 
          name: true, 
          phone: true, 
          email: true,
          registrationStatus: true,
          isActive: true,
        },
      })

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" })
      }

      // Verify customer is in PENDING_APPROVAL status
      if (customer.registrationStatus !== "PENDING_APPROVAL") {
        return res.status(400).json({ 
          message: `Customer is not pending approval. Current status: ${customer.registrationStatus || "NEW"}`,
        })
      }

      // Update customer to ACTIVE status
      const updatedCustomer = await prisma.customers.update({
        where: { id },
        data: {
          isActive: true,
          registrationStatus: "ACTIVE",
        },
      })

      // Send approval message via RegistrationService
      // ✅ Goes through WhatsAppQueueService (dedup check)
      // ✅ Goes through Security & Translation layer
      // ✅ Saves to conversationMessage history
      this.registrationService.sendApprovalMessage(id).catch(error => {
        logger.error("Error sending approval message:", error)
      })

      logger.info("Customer approved successfully:", { 
        customerId: id, 
        customerName: customer.name,
      })

      return res.status(200).json({
        message: "Customer approved successfully",
        customer: updatedCustomer,
        approvalMessageSent: true,
      })
    } catch (error) {
      logger.error("Error approving customer:", error)
      next(error)
    }
  }
}
