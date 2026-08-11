import { prisma } from "@echatbot/database"
import { randomUUID } from "crypto"
import logger from "../../utils/logger"
import { config } from "../../config"

/**
 * Durata di default di una sessione admin del backoffice.
 *
 * Deliberatamente SEPARATA da TOKEN_EXPIRATION: quella variabile governa la
 * scadenza dei link sicuri inviati ai clienti su WhatsApp (checkout, fatture,
 * profilo), che ha vincoli di sicurezza completamente diversi. Allungare la
 * sessione dell'admin non deve allungare la vita di quei link.
 */
const DEFAULT_ADMIN_SESSION_DURATION = "2h"

/**
 * Converte una durata in formato "15m" | "2h" | "7d" in millisecondi.
 *
 * Il parser precedente faceva `parseInt(value.replace("h", ""))` e trattava il
 * risultato come ore: con "30m" restituiva 30 ORE invece di 30 minuti.
 *
 * @param value - durata con suffisso di unita' (m/h/d)
 * @param fallback - durata usata se `value` e' assente o malformato
 * @returns durata in millisecondi
 */
function parseDurationToMs(
  value: string | undefined,
  fallback: string
): number {
  const UNIT_TO_MS: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }

  const parse = (input: string): number | null => {
    const match = /^(\d+)\s*([mhd])$/i.exec(input.trim())
    if (!match) return null

    const amount = parseInt(match[1], 10)
    if (!Number.isFinite(amount) || amount <= 0) return null

    return amount * UNIT_TO_MS[match[2].toLowerCase()]
  }

  if (value) {
    const parsed = parse(value)
    if (parsed !== null) return parsed

    logger.warn(
      `⚠️ Invalid ADMIN_SESSION_DURATION "${value}" - expected formats: 15m, 2h, 7d. Falling back to ${fallback}`
    )
  }

  // Il fallback e' una costante interna: se non parsa e' un bug, non input utente.
  const parsedFallback = parse(fallback)
  if (parsedFallback === null) {
    throw new Error(`Invalid fallback duration: ${fallback}`)
  }
  return parsedFallback
}

export class AdminSessionService {
  /**
   * Legge la durata configurata della sessione admin.
   *
   * Letta a ogni chiamata (non memoizzata) perche' i test modificano
   * process.env a runtime.
   */
  private getSessionDurationMs(): number {
    return parseDurationToMs(
      process.env.ADMIN_SESSION_DURATION,
      DEFAULT_ADMIN_SESSION_DURATION
    )
  }

  /**
   * Crea una nuova sessione admin al login
   * POLICY: Una sola sessione attiva per user, la vecchia viene revocata
   *
   * @param userId - ID utente
   * @param workspaceId - ID workspace selezionato (opzionale)
   * @param ipAddress - IP address del client
   * @param userAgent - User agent del browser
   * @returns sessionId generato
   */
  async createSession(
    userId: string,
    workspaceId: string | null,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    try {
      // 1. Revoca tutte le sessioni esistenti per questo user
      await prisma.adminSession.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      })

      logger.info(`🔒 Revoked existing sessions for user ${userId}`)

      // 2. Genera nuovo sessionId univoco
      const sessionId = randomUUID()

      // 3. Calcola scadenza: durata configurabile da ADMIN_SESSION_DURATION env
      const now = new Date()
      const expiresAt = new Date(now.getTime() + this.getSessionDurationMs())

      // 4. Crea nuova sessione
      await prisma.adminSession.create({
        data: {
          sessionId,
          userId,
          workspaceId,
          expiresAt,
          lastActivityAt: now,
          ipAddress: ipAddress?.substring(0, 45), // Limita lunghezza IP
          userAgent: userAgent?.substring(0, 1000), // Limita user agent
          isActive: true,
        },
      })

      logger.info(
        `🔐 Admin session created for user ${userId}: ${sessionId.substring(0, 8)}... (expires: ${expiresAt.toISOString()})`
      )

      return sessionId
    } catch (error) {
      logger.error("❌ Error creating admin session:", error)
      throw new Error("Failed to create session")
    }
  }

  /**
   * Valida una sessione esistente
   * Verifica: esistenza, isActive, non scaduta
   * Aggiorna lastActivityAt se valida
   *
   * @param sessionId - ID sessione da validare
   * @returns { valid: boolean, session?: AdminSession, error?: string }
   */
  async validateSession(sessionId: string): Promise<{
    valid: boolean
    session?: any
    error?: string
  }> {
    try {
      const session = await prisma.adminSession.findUnique({
        where: { sessionId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              firstName: true,
              lastName: true,
            },
          },
          workspace: { select: { id: true, name: true, slug: true } },
        },
      })

      // 1. Sessione non trovata
      if (!session) {
        logger.warn(`⚠️ Session not found: ${sessionId.substring(0, 8)}...`)
        return { valid: false, error: "Session not found" }
      }

      // 2. Sessione disattivata
      if (!session.isActive) {
        logger.warn(`⚠️ Session revoked: ${sessionId.substring(0, 8)}...`)
        return { valid: false, error: "Session revoked" }
      }

      // 3. Sessione scaduta (inattiva oltre ADMIN_SESSION_DURATION)
      if (session.expiresAt < new Date()) {
        logger.warn(
          `⚠️ Session expired: ${sessionId.substring(0, 8)}... (expired: ${session.expiresAt.toISOString()})`
        )

        // Auto-revoca sessione scaduta
        await prisma.adminSession.update({
          where: { id: session.id },
          data: { isActive: false },
        })

        return { valid: false, error: "Session expired" }
      }

      // 4. Sessione valida → sliding window: rinnova lastActivityAt E expiresAt
      //
      // expiresAt viene ricalcolato dall'istante corrente, non dal login. La
      // sessione diventa cosi' un timeout di INATTIVITA': chi lavora senza
      // pause non viene mai disconnesso, chi resta inattivo oltre la durata
      // configurata deve rifare login.
      const now = new Date()
      const renewedExpiresAt = new Date(now.getTime() + this.getSessionDurationMs())

      await prisma.adminSession.update({
        where: { id: session.id },
        data: {
          lastActivityAt: now,
          expiresAt: renewedExpiresAt,
        },
      })

      logger.debug(
        `✅ Session valid for user ${session.user.email} (${sessionId.substring(0, 8)}...)`
      )

      return { valid: true, session }
    } catch (error) {
      logger.error("❌ Error validating session:", error)
      return { valid: false, error: "Validation error" }
    }
  }

  /**
   * Revoca una sessione (logout)
   *
   * @param sessionId - ID sessione da revocare
   */
  async revokeSession(sessionId: string): Promise<void> {
    try {
      await prisma.adminSession.updateMany({
        where: { sessionId },
        data: { isActive: false },
      })

      logger.info(`🔒 Session revoked: ${sessionId.substring(0, 8)}...`)
    } catch (error) {
      logger.error("❌ Error revoking session:", error)
      throw new Error("Failed to revoke session")
    }
  }

  /**
   * Cleanup automatico sessioni scadute
   * Chiamato da scheduler (ogni 1h) o manualmente
   *
   * @returns Numero di sessioni eliminate
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.adminSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } }, // Scadute
            { isActive: false }, // Revocate
          ],
        },
      })

      if (result.count > 0) {
        logger.info(
          `🧹 Cleaned up ${result.count} expired/revoked admin sessions`
        )
      }

      return result.count
    } catch (error) {
      logger.error("❌ Error cleaning up sessions:", error)
      return 0
    }
  }

  /**
   * Ottiene statistiche sessioni attive
   * Utile per monitoring
   *
   * @returns Numero di sessioni attive totali
   */
  async getActiveSessionsCount(): Promise<number> {
    try {
      const count = await prisma.adminSession.count({
        where: {
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      })

      return count
    } catch (error) {
      logger.error("❌ Error counting active sessions:", error)
      return 0
    }
  }
}

export const adminSessionService = new AdminSessionService()
