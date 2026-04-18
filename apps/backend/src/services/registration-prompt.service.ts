/**
 * Registration Prompt Service
 *
 * Manages progressive registration invitations for unregistered users.
 *
 * BUSINESS LOGIC:
 * - Messages 1-5:  No prompt
 * - Messages 6-8:  First gentle invite (level 1)
 * - Messages 9-11: Second invite, highlight benefits (level 2)
 * - Messages 12+:  Repeated invite (level 3)
 * - Chat is NEVER blocked — unregistered users can always ask general/FAQ questions.
 *   Restricted actions (orders, cart, appointments, prices) are gated individually
 *   by FunctionExecutor and the data layer, not by a message-count hard block.
 *
 * SECURITY:
 * - Only applies to unregistered users (isRegistered = false)
 * - Registered users never see prompts
 */

export class RegistrationPromptService {
  /**
   * Calculate registration prompt level based on message count.
   *
   * @param messageCount - Total number of messages sent by customer
   * @param isRegistered - Whether customer has completed registration
   * @returns Level 0-3: 0=no prompt, 1-3=invite levels
   */
  getPromptLevel(messageCount: number, isRegistered: boolean): number {
    if (isRegistered) return 0

    if (messageCount >= 12) return 3 // Repeated invite
    if (messageCount >= 9) return 2  // More insistent invite
    if (messageCount >= 6) return 1  // First gentle invite
    return 0
  }

  /**
   * Get system prompt text for Router LLM based on level.
   *
   * @param level - Prompt level (1-3)
   * @returns System note to append to Router prompt
   */
  getPromptText(level: number): string {
    switch (level) {
      case 1:
        return "\n\n[SYSTEM NOTE: Customer is NOT registered. Naturally mention that registering unlocks order tracking, faster checkout and exclusive offers. Include [LINK_REGISTRATION] in a friendly, optional way.]"

      case 2:
        return "\n\n[SYSTEM NOTE: Customer STILL NOT registered. Highlight concrete benefits (saved orders, faster checkout, exclusive offers). Include [LINK_REGISTRATION]. Keep a helpful tone — the chat stays open regardless.]"

      case 3:
        return "\n\n[SYSTEM NOTE: Customer has been chatting without registering. Remind them that to access prices, place orders or book appointments they need to register. Include [LINK_REGISTRATION]. Be polite — they can still ask general questions without registering.]"

      default:
        return ""
    }
  }

  /**
   * @deprecated Chat is never blocked — this always returns false.
   * Kept for backward compatibility and test contracts.
   */
  shouldBlockUser(_messageCount: number, _isRegistered: boolean): boolean {
    return false
  }
}

// Export singleton
export const registrationPromptService = new RegistrationPromptService()
