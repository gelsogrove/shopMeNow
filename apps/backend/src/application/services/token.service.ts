import { PrismaClient } from "@prisma/client"
import crypto from "crypto"
import logger from "../../utils/logger"

/**
 * Service for managing registration tokens
 */
export class TokenService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Generate a secure random token
   * @returns A secure random token
   */
  private generateSecureToken(): string {
    // Generate 32 bytes of random data and convert to hex
    return crypto.randomBytes(32).toString("hex")
  }

  /**
   * Create a registration token for a phone number and workspace
   *
   * @param phoneNumber The phone number to create a token for
   * @param workspaceId The workspace ID
   * @returns The created registration token
   */
  async createRegistrationToken(
    phoneNumber: string,
    workspaceId: string
  ): Promise<string> {
    try {
      // 🧹 AUTO-CLEANUP: Remove expired registration tokens (older than 1 hour) for this workspace
      const oneHourAgo = new Date()
      oneHourAgo.setHours(oneHourAgo.getHours() - 1)
      
      const cleanupResult = await this.prisma.registrationToken.deleteMany({
        where: {
          workspaceId,
          expiresAt: {
            lt: oneHourAgo
          }
        }
      })

      if (cleanupResult.count > 0) {
        logger.info(`[REGISTRATION-TOKEN] 🧹 Auto-cleaned ${cleanupResult.count} expired registration tokens (older than 1 hour) for workspace ${workspaceId}`)
      }

      // First, invalidate any existing tokens for this phone number
      await this.prisma.registrationToken.updateMany({
        where: {
          phoneNumber,
          workspaceId,
          usedAt: null,
        },
        data: {
          expiresAt: new Date(),
        },
      })

      // Generate a new secure token
      const token = this.generateSecureToken()

      // Set expiration to 1 ora da adesso
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 1)

      // Save the token to the database
      await this.prisma.registrationToken.create({
        data: {
          token,
          phoneNumber,
          workspaceId,
          expiresAt,
        },
      })

      logger.info(
        `Created registration token for phone ${phoneNumber} in workspace ${workspaceId}`
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
   * @param token The token to validate
   * @returns The registration token data if valid, null otherwise
   */
  async validateToken(token: string): Promise<any> {
    try {
      // Find the token in the database
      const registrationToken = await this.prisma.registrationToken.findFirst({
        where: {
          token,
          expiresAt: {
            gt: new Date(), // Token expiration time must be in the future
          },
          usedAt: null, // Token must not have been used yet
        },
      })

      if (!registrationToken) {
        logger.warn(`Invalid or expired token: ${token.substring(0, 10)}...`)
        return null
      }

      logger.info(`Validated token for phone ${registrationToken.phoneNumber}`)
      return registrationToken
    } catch (error) {
      logger.error("Error validating registration token:", error)
      throw new Error("Failed to validate registration token")
    }
  }

  /**
   * Mark a token as used
   *
   * @param token The token to mark as used
   */
  async markTokenAsUsed(token: string): Promise<void> {
    try {
      await this.prisma.registrationToken.update({
        where: {
          token,
        },
        data: {
          usedAt: new Date(),
        },
      })

      logger.info(`Marked token as used: ${token.substring(0, 10)}...`)
    } catch (error) {
      logger.error("Error marking token as used:", error)
      throw new Error("Failed to mark token as used")
    }
  }

  /**
   * Clean up expired tokens
   *
   * @returns The number of tokens deleted
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      // Delete tokens that expired more than 7 days ago
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 7)

      const result = await this.prisma.registrationToken.deleteMany({
        where: {
          expiresAt: {
            lt: cutoffDate,
          },
        },
      })

      logger.info(`Cleaned up ${result.count} expired registration tokens`)
      return result.count
    } catch (error) {
      logger.error("Error cleaning up expired tokens:", error)
      throw new Error("Failed to clean up expired tokens")
    }
  }
}
