import { prisma, PrismaClient } from "@echatbot/database"
import crypto from "crypto"
import logger from "../../utils/logger"

/**
 * Service for managing all types of secure tokens
 */
export class SecureTokenService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  /**
   * Generate a secure token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex")
  }

  /**
   * Encrypt sensitive payload data
   */
  private encryptPayload(payload: any): string {
    const key =
      process.env.TOKEN_ENCRYPTION_KEY || "default-key-change-in-production"
    const cipher = crypto.createCipher("aes-256-cbc", key)
    let encrypted = cipher.update(JSON.stringify(payload), "utf8", "hex")
    encrypted += cipher.final("hex")
    return encrypted
  }

  /**
   * Decrypt payload data
   */
  private decryptPayload(encryptedPayload: string): any {
    try {
      const key =
        process.env.TOKEN_ENCRYPTION_KEY || "default-key-change-in-production"
      const decipher = crypto.createDecipher("aes-256-cbc", key)
      let decrypted = decipher.update(encryptedPayload, "hex", "utf8")
      decrypted += decipher.final("utf8")
      return JSON.parse(decrypted)
    } catch (error) {
      logger.error("Error decrypting payload:", error)
      return null
    }
  }

  /**
   * 🚀 KISS SOLUTION - UN SOLO TOKEN PER CLIENTE (Andrea's Request)
   * Genera nuovo token SOLO se scaduto per cliente+workspace
   */
  async createToken(
    type:
      | "registration"
      | "checkout"
      | "invoice"
      | "cart"
      | "password_reset"
      | "email_verification"
      | "orders"
      | "profile"
      | "any"
      | "universal",
    workspaceId: string,
    payload?: any,
    expiresIn?: string,
    userId?: string,
    phoneNumber?: string,
    ipAddress?: string,
    customerId?: string
  ): Promise<string> {
    try {
      // Special case: registration tokens don't need customerId (customer doesn't exist yet)
      if (!customerId && type !== "registration") {
        throw new Error("KISS TOKEN: customerId è obbligatorio")
      }

      logger.info(
        `[KISS-TOKEN] 🔍 Controllo token per customerId="${customerId}", phoneNumber="${phoneNumber}", workspaceId="${workspaceId}"`
      )

      // 1. Cerca token esistente NON SCADUTO per questo cliente+workspace
      let existingToken
      if (type === "registration" && phoneNumber) {
        // For registration tokens, search by phoneNumber
        existingToken = await this.prisma.secureToken.findFirst({
          where: {
            phoneNumber,
            workspaceId,
            type: "registration",
            expiresAt: {
              gt: new Date(), // NON scaduto
            },
          },
        })
      } else if (customerId) {
        // For other tokens, search by customerId AND type
        existingToken = await this.prisma.secureToken.findFirst({
          where: {
            customerId,
            workspaceId,
            type, // 🔧 FIX: Filtra anche per tipo di token!
            expiresAt: {
              gt: new Date(), // NON scaduto
            },
          },
        })
      }

      // 2. Se esiste token valido → RIUTILIZZA
      if (existingToken) {
        logger.info(
          `[KISS-TOKEN] ✅ RIUTILIZZO token esistente: ${existingToken.token.substring(0, 10)}... (scade: ${existingToken.expiresAt})`
        )

        // Aggiorna payload se necessario
        if (
          payload &&
          JSON.stringify(payload) !== JSON.stringify(existingToken.payload)
        ) {
          await this.prisma.secureToken.update({
            where: { id: existingToken.id },
            data: { payload: payload },
          })
          logger.info(`[KISS-TOKEN] 🔄 Payload aggiornato`)
        }

        return existingToken.token
      }

      // 3. Nessun token valido → CREA NUOVO
      logger.info(
        `[KISS-TOKEN] 🆕 Creo nuovo token (nessun token valido trovato)`
      )

      // Pulisci token scaduti + elimina token esistenti dello stesso tipo per evitare conflitti
      if (type === "registration" && phoneNumber) {
        // For registration tokens, clean by phoneNumber
        logger.info(`[KISS-TOKEN] 🗑️ Deleting old registration tokens by phoneNumber: ${phoneNumber}`)
        await this.prisma.secureToken.deleteMany({
          where: {
            phoneNumber,
            workspaceId,
            type: "registration",
          },
        })
      } else if (customerId) {
        // For other tokens, clean by customerId AND type (inclusi quelli non scaduti)
        logger.info(`[KISS-TOKEN] 🗑️ Deleting old ${type} tokens by customerId: ${customerId}`)
        await this.prisma.secureToken.deleteMany({
          where: {
            customerId,
            workspaceId,
            type, // 🔧 FIX: Elimina tutti i token dello stesso tipo per evitare conflitti
          },
        })
      }

      // Genera nuovo token
      const token = this.generateSecureToken()
      const expiresAt = new Date()
      // Use env variable directly to allow runtime changes (important for testing)
      const effectiveExpiresIn =
        expiresIn || process.env.TOKEN_EXPIRATION || "1h"

      // Parse duration correctly for both hours (h) and minutes (m)
      const match = effectiveExpiresIn.match(/^(\d+)([hm])$/)
      if (!match) {
        // Fallback to 1 hour if format is invalid
        expiresAt.setHours(expiresAt.getHours() + 1)
      } else {
        const value = parseInt(match[1], 10)
        const unit = match[2]

        if (unit === "m") {
          // Minutes
          expiresAt.setMinutes(expiresAt.getMinutes() + value)
        } else {
          // Hours
          expiresAt.setHours(expiresAt.getHours() + value)
        }
      }

      // Crea token del tipo specificato
      logger.info(`[KISS-TOKEN] 💾 Creating new token in database`, {
        type,
        workspaceId: workspaceId.substring(0, 8) + "...",
        customerId: customerId?.substring(0, 8) + "..." || "none",
        userId: userId?.substring(0, 8) + "..." || "none",
        phoneNumber: phoneNumber || "none",
        expiresAt
      })
      
      await this.prisma.secureToken.create({
        data: {
          token,
          type, // 🔧 FIX: Usa il tipo passato come parametro invece di 'universal'
          workspaceId,
          customerId,
          userId,
          phoneNumber,
          payload: payload,
          expiresAt,
          ipAddress,
        },
      })

      logger.info(
        `[KISS-TOKEN] ✅ NUOVO token di tipo '${type}' creato - scade: ${expiresAt}`
      )
      return token
    } catch (error) {
      logger.error(`[KISS-TOKEN] ❌ Errore creazione token:`, error)

      // Re-throw validation errors as-is to preserve the specific error message
      if (error instanceof Error && error.message.includes("KISS TOKEN:")) {
        throw error
      }

      // For other errors, wrap with generic message
      throw new Error(`Errore creazione token di tipo '${type}'`)
    }
  }

  /**
   * Validate a token with workspace isolation
   * If type is not specified, accepts any valid token type
   */
  async validateToken(
    token: string,
    workspaceId?: string
  ): Promise<{ valid: boolean; data?: any; payload?: any }> {
    try {
      logger.info(
        `[KISS-TOKEN] 🔍 Validazione token: ${token.substring(0, 10)}... per workspace: ${workspaceId}`
      )

      // KISS: Cerca token ESISTENTE + NON SCADUTO + WORKSPACE CORRETTO
      const secureToken = await this.prisma.secureToken.findFirst({
        where: {
          token,
          expiresAt: { gt: new Date() }, // NON scaduto
          ...(workspaceId && { workspaceId }), // Workspace se specificato
        },
      })

      if (!secureToken) {
        logger.warn(
          `[KISS-TOKEN] ❌ Token non valido o scaduto: ${token.substring(0, 10)}...`
        )
        return { valid: false }
      }

      logger.info(
        `[KISS-TOKEN] ✅ Token valido per customer: ${secureToken.customerId}, workspace: ${secureToken.workspaceId}`
      )

      return {
        valid: true,
        data: {
          id: secureToken.id,
          type: secureToken.type,
          workspaceId: secureToken.workspaceId,
          customerId: secureToken.customerId || secureToken.userId, // 🔧 Fallback per compatibilità
          userId: secureToken.userId,
          phoneNumber: secureToken.phoneNumber,
          expiresAt: secureToken.expiresAt,
          createdAt: secureToken.createdAt,
        },
        payload: secureToken.payload,
      }
    } catch (error) {
      logger.error("[KISS-TOKEN] ❌ Errore validazione token:", error)
      return { valid: false }
    }
  }

  /**
   * DEPRECATED: Token marking removed - tokens remain valid until expiration
   * This function is kept for backward compatibility but does nothing
   */
  async markTokenAsUsed(token: string): Promise<boolean> {
    // Tokens should not be marked as used - they remain valid until expiration
    logger.info(
      `Token marking disabled - token ${token.substring(0, 10)}... remains valid until expiration`
    )
    return true
  }

  /**
   * Revoke a token
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      await this.prisma.secureToken.update({
        where: { token },
        data: { expiresAt: new Date() },
      })

      logger.info(`Revoked token: ${token.substring(0, 10)}...`)
      return true
    } catch (error) {
      logger.error("Error revoking token:", error)
      return false
    }
  }

  /**
   * Cleanup expired tokens (cron job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 7) // Delete tokens expired more than 7 days ago

      const result = await this.prisma.secureToken.deleteMany({
        where: {
          expiresAt: {
            lt: cutoffDate,
          },
        },
      })

      logger.info(`Cleaned up ${result.count} expired secure tokens`)
      return result.count
    } catch (error) {
      logger.error("Error cleaning up expired tokens:", error)
      throw new Error("Failed to clean up expired tokens")
    }
  }

  /**
   * Get token statistics
   */
  async getTokenStats(workspaceId: string): Promise<any> {
    try {
      const stats = await this.prisma.secureToken.groupBy({
        by: ["type"],
        where: {
          workspaceId,
          expiresAt: {
            gt: new Date(),
          },
        },
        _count: {
          id: true,
        },
      })

      return stats.reduce(
        (acc, stat) => {
          acc[stat.type] = stat._count.id
          return acc
        },
        {} as Record<string, number>
      )
    } catch (error) {
      logger.error("Error getting token stats:", error)
      return {}
    }
  }
}
