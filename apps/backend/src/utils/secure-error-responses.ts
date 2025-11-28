/**
 * 🔒 SECURE ERROR RESPONSES
 *
 * POLICY: Non esporre mai dettagli interni dell'API per sicurezza
 * - Log completi sul server (per debug)
 * - Messaggi generici al client (per sicurezza)
 *
 * Questo protegge da:
 * - Information disclosure attacks
 * - API structure enumeration
 * - Technology stack fingerprinting
 */

import { Response } from "express"
import logger from "./logger"

export class SecureErrorResponses {
  /**
   * 400 Bad Request - Richiesta malformata
   * NON esporre quali campi mancano o quali validazioni falliscono
   */
  static badRequest(res: Response, internalMessage?: string): Response {
    if (internalMessage) {
      logger.warn(`⚠️ Bad Request: ${internalMessage}`)
    }
    return res.status(400).json({
      error: "Bad Request",
    })
  }

  /**
   * 401 Unauthorized - Autenticazione fallita o mancante
   * NON esporre se è sessione/token/password/header mancante
   */
  static unauthorized(res: Response, internalMessage?: string): Response {
    if (internalMessage) {
      logger.warn(`⚠️ Unauthorized: ${internalMessage}`)
    }
    return res.status(401).json({
      error: "Unauthorized",
    })
  }

  /**
   * 403 Forbidden - Autenticato ma non autorizzato
   * NON esporre quali permessi mancano
   */
  static forbidden(res: Response, internalMessage?: string): Response {
    if (internalMessage) {
      logger.warn(`⚠️ Forbidden: ${internalMessage}`)
    }
    return res.status(403).json({
      error: "Forbidden",
    })
  }

  /**
   * 404 Not Found - Risorsa non trovata
   * OK esporre questo (è lo scopo dell'endpoint)
   */
  static notFound(
    res: Response,
    resourceType?: string,
    internalMessage?: string
  ): Response {
    if (internalMessage) {
      logger.warn(`⚠️ Not Found: ${internalMessage}`)
    }
    return res.status(404).json({
      error: "Not Found",
      message: resourceType ? `${resourceType} not found` : undefined,
    })
  }

  /**
   * 409 Conflict - Risorsa già esistente
   * OK esporre questo (è lo scopo della validazione)
   */
  static conflict(res: Response, message: string): Response {
    logger.warn(`⚠️ Conflict: ${message}`)
    return res.status(409).json({
      error: "Conflict",
      message,
    })
  }

  /**
   * 422 Unprocessable Entity - Validazione fallita
   * OK esporre quali validazioni falliscono (utile per l'utente)
   */
  static validationError(
    res: Response,
    errors: Record<string, string>
  ): Response {
    logger.warn(`⚠️ Validation Error:`, errors)
    return res.status(422).json({
      error: "Validation Error",
      errors,
    })
  }

  /**
   * 500 Internal Server Error
   * NON esporre mai stack trace o dettagli interni
   */
  static internalError(res: Response, error?: Error | unknown): Response {
    // Log completo sul server
    if (error instanceof Error) {
      logger.error(`❌ Internal Error: ${error.message}`)
      logger.error(`❌ Stack: ${error.stack}`)
    } else {
      logger.error(`❌ Internal Error:`, error)
    }

    // Messaggio generico al client
    return res.status(500).json({
      error: "Internal Server Error",
    })
  }

  /**
   * 503 Service Unavailable - Servizio temporaneamente non disponibile
   */
  static serviceUnavailable(res: Response, internalMessage?: string): Response {
    if (internalMessage) {
      logger.error(`❌ Service Unavailable: ${internalMessage}`)
    }
    return res.status(503).json({
      error: "Service Unavailable",
    })
  }
}
