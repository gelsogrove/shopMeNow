/**
 * Intent Handler Interface
 * Common contract for all handler implementations
 */

import { HandlerResult, Intent } from "../entities/routing.entity"

/**
 * Generic IntentHandler interface
 * All handlers must implement this to be compatible with HandlerFactory
 */
export interface IntentHandler<T> {
  /**
   * Process an intent and return a result
   * @param intent - The detected intent with type and confidence
   * @param context - Handler-specific context data
   * @returns Formatted response ready for customer
   */
  handle(intent: Intent, context: T): Promise<HandlerResult>
}

/**
 * Type-safe handler union
 */
export type AnyIntentHandler = IntentHandler<any>
