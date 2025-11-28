import { Request, Response } from "express"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import logger from "../../../utils/logger"

/**
 * Controller for managing cart view tokens
 * Used by support interface to generate tokens for viewing customer carts
 */
export class CartTokenController {
  private secureTokenService = new SecureTokenService()

  /**
   * Generate or retrieve token for customer cart access
   * Riutilizza token esistenti quando possibile (KISS strategy)
   */
  async getCartToken(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, customerId } = req.body

      // Validazione parametri
      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: "workspaceId is required",
        })
        return
      }

      if (!customerId) {
        res.status(400).json({
          success: false,
          error: "customerId is required",
        })
        return
      }

      logger.info(
        `[CART-TOKEN] 🎯 Richiesta token per customer: ${customerId}, workspace: ${workspaceId}`
      )

      // Debug: log customer details
      logger.info(
        `[CART-TOKEN] 🔍 DEBUG - customerId ricevuto: "${customerId}", tipo: ${typeof customerId}`
      )
      logger.info(
        `[CART-TOKEN] 🔍 DEBUG - workspaceId ricevuto: "${workspaceId}", tipo: ${typeof workspaceId}`
      )

      // Utilizza SecureTokenService con strategia KISS
      // Se esiste token valido lo riutilizza, altrimenti ne crea uno nuovo
      const token = await this.secureTokenService.createToken(
        "cart", // tipo token
        workspaceId,
        { purpose: "cart_view", access: "read_only", customerId }, // 🔧 FIX: Include customerId nel payload!
        "24h", // durata 24 ore
        undefined, // userId (non necessario per cart view)
        undefined, // phoneNumber (non necessario)
        req.ip, // IP address per sicurezza
        customerId // customerId
      )

      logger.info(
        `[CART-TOKEN] ✅ Token generato/riutilizzato per customer ${customerId}`
      )

      // Debug: log token details
      logger.info(
        `[CART-TOKEN] 🔍 DEBUG - Token generato: ${token.substring(0, 10)}...${token.substring(-10)} (length: ${token.length})`
      )

      res.status(200).json({
        success: true,
        data: {
          token,
          customerId,
          workspaceId,
          expiresIn: "24h",
          purpose: "cart_view",
        },
      })
    } catch (error) {
      logger.error(`[CART-TOKEN] ❌ Errore generazione token:`, error)
      res.status(500).json({
        success: false,
        error: "Internal server error while generating cart token",
      })
    }
  }

  /**
   * Validate a cart token (optional endpoint for debugging)
   */
  async validateCartToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params

      if (!token) {
        res.status(400).json({
          success: false,
          error: "Token is required",
        })
        return
      }

      const validation = await this.secureTokenService.validateToken(token)

      if (!validation.valid) {
        res.status(401).json({
          success: false,
          error: "Invalid or expired token",
        })
        return
      }

      res.status(200).json({
        success: true,
        data: {
          isValid: true,
          customerId: validation.data?.customerId,
          workspaceId: validation.data?.workspaceId,
          expiresAt: validation.data?.expiresAt,
          payload: validation.payload,
        },
      })
    } catch (error) {
      logger.error(`[CART-TOKEN] ❌ Errore validazione token:`, error)
      res.status(500).json({
        success: false,
        error: "Internal server error while validating token",
      })
    }
  }
}
