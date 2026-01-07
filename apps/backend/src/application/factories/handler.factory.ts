/**
 * Handler Factory (T007)
 * Creates appropriate handler instances based on routing path
 */

import logger from "../../utils/logger"
import { RoutingPath } from "../../domain/entities/routing.entity"
import { IntentHandler } from "../../domain/interfaces/intent-handler.interface"

export class HandlerFactory {
  /**
   * Create handler instance based on routing path
   * @param path - SIMPLE, LLM, or FAQ
   * @returns Handler instance for the given path
   */
  createHandler(path: RoutingPath): IntentHandler<any> {
    logger.info("[HandlerFactory] Creating handler", { path })

    switch (path) {
      case "SIMPLE":
        // Import will happen in PHASE 3
        // return new SimpleIntentHandler(...)
        throw new Error("SimpleIntentHandler not yet available in PHASE 2")

      case "LLM":
        // Import will happen in PHASE 3
        // return new LLMIntentHandler(...)
        throw new Error("LLMIntentHandler not yet available in PHASE 2")

      case "FAQ":
        // FAQ handler placeholder
        throw new Error("FAQ handler not yet implemented")

      default:
        throw new Error(`Unknown routing path: ${path}`)
    }
  }

  /**
   * Validate that handler implements IntentHandler interface
   */
  validateHandler(handler: any): boolean {
    const hasHandle = typeof handler.handle === "function"
    if (!hasHandle) {
      logger.error("[HandlerFactory] Invalid handler", {
        missingMethod: "handle",
      })
      return false
    }
    return true
  }
}
