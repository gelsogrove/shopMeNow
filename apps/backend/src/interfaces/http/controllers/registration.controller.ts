import { NextFunction, Request, Response } from "express"
import { RegistrationService } from "../../../application/services/registration.service"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import { WelcomeService } from "../../../application/services/welcome.service"
import { prisma } from "../../../lib/prisma"
import logger from "../../../utils/logger"

/**
 * RegistrationController class
 * Handles HTTP requests related to customer registration
 */
export class RegistrationController {
  private secureTokenService: SecureTokenService
  private welcomeService: WelcomeService
  private registrationService: RegistrationService

  constructor() {
    this.secureTokenService = new SecureTokenService()
    this.welcomeService = new WelcomeService()
    this.registrationService = new RegistrationService()
  }

  /**
   * Validate registration token
   */
  async validateToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params

      if (!token) {
        return res.status(400).json({ error: "Token is required" })
      }

      // Use SecureTokenService for unified token validation
      const validation = await this.secureTokenService.validateToken(token)

      if (!validation.valid) {
        return res.status(404).json({ error: "Invalid or expired token" })
      }

      const tokenData = validation.data

      if (!tokenData) {
        return res.status(404).json({ error: "Invalid or expired token" })
      }

      // Fetch workspace branding for registration page (logo, name)
      const workspace = await prisma.workspace.findUnique({
        where: { id: tokenData.workspaceId },
        select: { name: true, logoUrl: true, registrationPage: true },
      })

      res.status(200).json({
        valid: true,
        phoneNumber: tokenData.phoneNumber,
        workspaceId: tokenData.workspaceId,
        expiresAt: tokenData.expiresAt,
        workspaceName: workspace?.name,
        workspaceLogoUrl: workspace?.logoUrl || null,
        customRegistrationPage: workspace?.registrationPage || null,
      })
    } catch (error) {
      logger.error("Error validating token:", error)
      next(error)
    }
  }

  /**
   * Register a new customer
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        token,
        first_name,
        last_name,
        company,
        email,
        phone,
        workspace_id,
        language,
        currency,
        gdpr_consent,
        push_notifications_consent,
      } = req.body

      // 🔍 DEBUG: Log all received parameters
      logger.info("[REGISTRATION] 📝 Received registration request:", {
        token: token ? `${token.substring(0, 20)}...` : "MISSING",
        first_name,
        last_name,
        company,
        email,
        phone,
        workspace_id,
        language,
        currency,
        gdpr_consent: gdpr_consent,
        gdpr_consent_type: typeof gdpr_consent,
        push_notifications_consent,
        all_body_keys: Object.keys(req.body),
      })

      // Validate required fields
      if (
        !token ||
        !first_name ||
        !last_name ||
        !company ||
        !email ||
        !phone ||
        !workspace_id ||
        gdpr_consent !== true // ✅ Must be explicitly true
      ) {
        logger.error("[REGISTRATION] ❌ Validation failed:", {
          has_token: !!token,
          has_first_name: !!first_name,
          has_last_name: !!last_name,
          has_company: !!company,
          has_email: !!email,
          has_phone: !!phone,
          has_workspace_id: !!workspace_id,
          gdpr_consent_value: gdpr_consent,
          gdpr_consent_check: gdpr_consent !== true,
        })
        return res.status(400).json({ error: "Missing required fields" })
      }

      // Use SecureTokenService for unified token validation
      const validation = await this.secureTokenService.validateToken(token)

      if (!validation.valid) {
        return res
          .status(401)
          .json({ error: "Invalid or expired registration token" })
      }

      const tokenData = validation.data

      if (
        !tokenData ||
        tokenData.phoneNumber !== phone ||
        tokenData.workspaceId !== workspace_id
      ) {
        logger.error(
          `[REGISTRATION] Token validation failed. TokenData:`,
          tokenData
            ? {
                phoneNumber: tokenData.phoneNumber,
                workspaceId: tokenData.workspaceId,
                phone,
                workspace_id,
              }
            : "No token data"
        )
        return res
          .status(401)
          .json({ error: "Invalid or expired registration token" })
      }

      // Check if workspace exists
      const workspace = await prisma.workspace.findUnique({
        where: {
          id: workspace_id,
        },
        select: {
          id: true,
          requireManualApproval: true,
        },
      })

      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" })
      }

      // Determine activation status based on workspace settings
      // If requireManualApproval is true, customer goes to PENDING_APPROVAL
      // Otherwise, customer is activated immediately
      const shouldActivateImmediately = !workspace.requireManualApproval
      const registrationStatus = shouldActivateImmediately ? "ACTIVE" : "PENDING_APPROVAL"
      const isActive = shouldActivateImmediately

      // Check if customer exists by phone number
      const existingCustomer = await prisma.customers.findFirst({
        where: {
          phone,
          workspaceId: workspace_id,
        },
      })

      // Check if email already exists for another customer in the same workspace
      const existingEmailCustomer = await prisma.customers.findFirst({
        where: {
          email: email,
          workspaceId: workspace_id,
          id: { not: existingCustomer?.id }, // Exclude current customer if updating
        },
      })

      if (existingEmailCustomer) {
        return res.status(409).json({
          error: "Email già registrata",
          message:
            "Questo indirizzo email è già registrato nel sistema. Utilizza un'altra email o contatta il supporto.",
          field: "email",
        })
      }

      let customer

      if (existingCustomer) {
        // Update existing customer - activation depends on workspace settings
        customer = await prisma.customers.update({
          where: {
            id: existingCustomer.id,
          },
          data: {
            name: `${first_name} ${last_name}`,
            email: email, // Use the email provided by the user
            company,
            language: language || "en",
            currency: currency || "EUR",
            last_privacy_version_accepted: "1.0.0", // Current privacy policy version
            privacy_accepted_at: new Date(),
            push_notifications_consent: push_notifications_consent || false,
            push_notifications_consent_at: push_notifications_consent
              ? new Date()
              : null,
            isActive, // Based on workspace.requireManualApproval
            registrationStatus, // ACTIVE or PENDING_APPROVAL based on workspace settings
            isBlacklisted: false, // 🆕 Feature 174: User NOT blocked after registration (can chat freely)
            activeChatbot: true, // 🆕 Feature 174: Chatbot ENABLED after registration
          },
        })
      } else {
        // Create new customer with provided email
        try {
          customer = await prisma.customers.create({
            data: {
              name: `${first_name} ${last_name}`,
              email: email, // Use the email provided by the user
              phone,
              company,
              workspaceId: workspace_id,
              language: language || "en",
              currency: currency || "EUR",
              last_privacy_version_accepted: "1.0.0", // Current privacy policy version
              privacy_accepted_at: new Date(),
              push_notifications_consent: push_notifications_consent || false,
              push_notifications_consent_at: push_notifications_consent
                ? new Date()
                : null,
              isActive, // Based on workspace.requireManualApproval
              registrationStatus, // ACTIVE or PENDING_APPROVAL based on workspace settings
              isBlacklisted: false, // 🆕 Feature 174: User NOT blocked after registration (can chat freely)
              activeChatbot: true, // 🆕 Feature 174: Chatbot ENABLED after registration
            },
          })
        } catch (createError: any) {
          // P2002: Unique constraint violation (phone or email already exists)
          if (createError.code === "P2002") {
            logger.error(
              `[REGISTRATION] Unique constraint violation during customer creation. Phone: ${phone}, Email: ${email}`,
              createError
            )

            // Fetch the existing customer (race condition: another request created it)
            customer = await prisma.customers.findFirst({
              where: {
                phone,
                workspaceId: workspace_id,
              },
            })

            if (!customer) {
              // This should never happen, but handle it gracefully
              return res.status(409).json({
                error: "Numero di telefono o email già registrati",
                message:
                  "Questo numero di telefono o email è già presente nel sistema.",
              })
            }

            // Update the existing customer found
            customer = await prisma.customers.update({
              where: {
                id: customer.id,
              },
              data: {
                name: `${first_name} ${last_name}`,
                email: email,
                company,
                language: language || "en",
                currency: currency || "EUR",
                last_privacy_version_accepted: "1.0.0",
                privacy_accepted_at: new Date(),
                push_notifications_consent: push_notifications_consent || false,
                push_notifications_consent_at: push_notifications_consent
                  ? new Date()
                  : null,
                isActive: true,
                isBlacklisted: false,
                activeChatbot: true,
              },
            })

            logger.info(
              `[REGISTRATION] ✅ Race condition handled - updated existing customer ${customer.id}`
            )
          } else {
            // Different error, rethrow
            throw createError
          }
        }
      }

      // 🔧 CRITICAL FIX: Update token with customerId for TOKEN-ONLY system
      await prisma.secureToken.update({
        where: { token },
        data: {
          customerId: customer.id,
          userId: customer.id, // For backward compatibility
        },
      })

      logger.info(
        `[REGISTRATION] ✅ Token updated with customerId: ${customer.id}`
      )

      // Mark token as used using SecureTokenService
      await this.secureTokenService.markTokenAsUsed(token)

      // 🆕 Feature 174: Removed clearAttempts - RegistrationAttempts no longer used

      // 💰 NOTE: Registration cost ($1.00) is already tracked in welcome message
      // No additional charge for registration form submission
      logger.info(
        `[REGISTRATION] ✅ Registration completed for ${customer.id} - cost already tracked in welcome message`
      )

      // 🚨 REMOVED: sendWelcomeMessage() - was duplicate with sendAfterRegistrationMessage
      // Only send ONE message after registration to avoid spam

      // Send after-registration message asynchronously (uses workspace-specific settings)
      // Only send if customer is fully activated (not pending approval)
      if (isActive) {
        this.registrationService
          .sendAfterRegistrationMessage(customer.id)
          .then((success) => {
            if (success) {
              logger.info(
                `After-registration message sent successfully to customer ${customer.id}`
              )
            } else {
              logger.error(
                `Failed to send after-registration message to customer ${customer.id}`
              )
            }
          })
          .catch((error) => {
            logger.error("Error sending after-registration message:", error)
          })
      } else {
        logger.info(
          `[REGISTRATION] Customer ${customer.id} is pending approval - skipping after-registration message`
        )
      }

      res.status(200).json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          registrationStatus: registrationStatus,
        },
        message: isActive 
          ? "Registration successful" 
          : "Registration submitted - awaiting admin approval",
        requiresApproval: !isActive,
      })
    } catch (error) {
      logger.error("Error registering customer:", error)
      next(error)
    }
  }

  /**
   * Get data protection information
   */
  async getDataProtectionInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { lang } = req.query

      // Default language is English
      const language = lang?.toString() || "en"

      // This would ideally come from a database or translation files
      let content

      switch (language.toLowerCase()) {
        case "it":
          content = {
            title: "Come proteggiamo i tuoi dati",
            content:
              "Il nostro sistema utilizza tecniche avanzate di tokenizzazione per proteggere i tuoi dati personali. Quando invii un messaggio, i tuoi dati personali vengono sostituiti con token casuali prima di essere elaborati dai nostri modelli di intelligenza artificiale. Questi token vengono poi sostituiti con i dati originali solo quando il messaggio viene inviato a te.",
            sections: [
              {
                title: "Il nostro processo di sicurezza",
                content:
                  "Ogni dato sensibile viene criptato e protetto secondo gli standard più elevati.",
              },
              {
                title: "Conformità GDPR",
                content:
                  "Siamo pienamente conformi alle normative GDPR per la protezione dei dati personali.",
              },
            ],
          }
          break
        default: // English as default
          content = {
            title: "How we protect your data",
            content:
              "Our system uses advanced tokenization techniques to protect your personal data. When you send a message, your personal data is replaced with random tokens before being processed by our AI models. These tokens are then replaced with the original data only when the message is sent back to you.",
            sections: [
              {
                title: "Our security process",
                content:
                  "Every sensitive piece of data is encrypted and protected according to the highest standards.",
              },
              {
                title: "GDPR compliance",
                content:
                  "We are fully compliant with GDPR regulations for the protection of personal data.",
              },
            ],
          }
      }

      res.status(200).json(content)
    } catch (error) {
      logger.error("Error getting data protection info:", error)
      next(error)
    }
  }

  /**
   * Send registration confirmation message to user
   */
  private async sendRegistrationConfirmationMessage(
    phoneNumber: string,
    workspaceId: string,
    language: string,
    customerName: string
  ): Promise<void> {
    try {
      // Get workspace settings for after-registration messages
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { afterRegistrationMessages: true },
      })

      if (!workspace?.afterRegistrationMessages) {
        logger.warn(
          `[REGISTRATION_CONFIRMATION] No after-registration messages configured for workspace ${workspaceId}`
        )
        return
      }

      const messages = workspace.afterRegistrationMessages as any
      let confirmationMessage =
        messages[language] || messages["en"] || messages["it"]

      if (!confirmationMessage) {
        logger.warn(
          `[REGISTRATION_CONFIRMATION] No message found for language ${language} in workspace ${workspaceId}`
        )
        return
      }

      // Replace [nome] placeholder with actual customer name
      confirmationMessage = confirmationMessage.replace(
        /\[nome\]/g,
        customerName
      )

      // TODO: Send message via WhatsApp API
      // For now, just log the message
      logger.info(
        `[REGISTRATION_CONFIRMATION] Would send to ${phoneNumber}: ${confirmationMessage}`
      )

      // In a real implementation, you would send this via WhatsApp API
      // await whatsappService.sendMessage(phoneNumber, confirmationMessage, workspaceId);
    } catch (error) {
      logger.error(
        `[REGISTRATION_CONFIRMATION] Error sending confirmation message to ${phoneNumber}:`,
        error
      )
    }
  }
}
