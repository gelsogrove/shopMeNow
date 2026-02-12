import { SecureTokenService } from "./secure-token.service"
import logger from "../../utils/logger"

/**
 * Service for managing registration tokens
 * 
 * 🔄 MIGRATED: Now delegates to SecureTokenService (secureToken table)
 * Previously wrote to registrationToken table, causing validation failures
 * because frontend validates via SecureTokenService which reads secureToken table.
 * 
 * This is a thin wrapper that preserves the same public interface for all callers:
 * - router-orchestration.service.ts
 * - llm.service.ts
 * - welcome-message.handler.ts
 * - link-replacement.service.ts
 */
export class TokenService {
  private secureTokenService: SecureTokenService

  constructor() {
    this.secureTokenService = new SecureTokenService()
  }

  /**
   * Create a registration token for a phone number and workspace
   * 
   * 🔄 MIGRATED: Now writes to secureToken table via SecureTokenService
   * SecureTokenService handles: cleanup, reuse of existing valid tokens, KISS logic
   *
   * @param phoneNumber The phone number to create a token for
   * @param workspaceId The workspace ID
   * @returns The created registration token string
   */
  async createRegistrationToken(
    phoneNumber: string,
    workspaceId: string
  ): Promise<string> {
    try {
      // Delegate to SecureTokenService which writes to secureToken table
      // This ensures tokens are findable by SecureTokenService.validateToken()
      // which is used by frontend POST /validate-secure-token
      const token = await this.secureTokenService.createToken(
        "registration",    // type
        workspaceId,       // workspaceId
        undefined,         // payload
        "7d",             // expiresIn: 7 days (registration links should last longer than default 1h)
        undefined,         // userId
        phoneNumber,       // phoneNumber
        undefined,         // ipAddress
        undefined          // customerId (not needed for registration - customer doesn't exist yet)
      )

      logger.info(
        `[REGISTRATION-TOKEN] ✅ Created registration token in secureToken table for phone ${phoneNumber} in workspace ${workspaceId}`
      )
      return token
    } catch (error) {
      logger.error("Error creating registration token:", error)
      throw new Error("Failed to create registration token")
    }
  }

  /**
   * Validate a registration token
   * 
   * 🔄 MIGRATED: Now reads from secureToken table via SecureTokenService
   *
   * @param token The token to validate
   * @returns The registration token data if valid, null otherwise
   */
  async validateToken(token: string): Promise<any> {
    try {
      const validation = await this.secureTokenService.validateToken(token)

      if (!validation.valid || !validation.data) {
        logger.warn(`Invalid or expired token: ${token.substring(0, 10)}...`)
        return null
      }

      logger.info(`Validated token for phone ${validation.data.phoneNumber}`)
      return validation.data
    } catch (error) {
      logger.error("Error validating registration token:", error)
      throw new Error("Failed to validate registration token")
    }
  }

  /**
   * Mark a token as used
   * 
   * 🔄 MIGRATED: Delegates to SecureTokenService (currently a no-op - tokens remain valid until expiry)
   *
   * @param token The token to mark as used
   */
  async markTokenAsUsed(token: string): Promise<void> {
    try {
      await this.secureTokenService.markTokenAsUsed(token)
      logger.info(`Marked token as used: ${token.substring(0, 10)}...`)
    } catch (error) {
      logger.error("Error marking token as used:", error)
      throw new Error("Failed to mark token as used")
    }
  }

  /**
   * Clean up expired tokens
   * 
   * 🔄 MIGRATED: Delegates to SecureTokenService
   *
   * @returns The number of tokens deleted
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const count = await this.secureTokenService.cleanupExpiredTokens()
      logger.info(`Cleaned up ${count} expired registration tokens`)
      return count
    } catch (error) {
      logger.error("Error cleaning up expired tokens:", error)
      throw new Error("Failed to clean up expired tokens")
    }
  }
}
