/**
 * Registration Prompt Service
 * 
 * Manages progressive registration invitations for unregistered users
 * 
 * BUSINESS LOGIC:
 * - Messages 1-5: No prompt
 * - Messages 6-8: First gentle invite
 * - Messages 9-11: Second insistent invite
 * - Messages 12-14: Final warning (will be blocked)
 * - Messages 15+: User should be blocked
 * 
 * SECURITY:
 * - Only applies to unregistered users (isRegistered = false)
 * - Registered users never see prompts
 * - Prevents spam and bot abuse
 */

export class RegistrationPromptService {
  /**
   * Calculate registration prompt level based on message count
   * 
   * @param messageCount - Total number of messages sent by customer
   * @param isRegistered - Whether customer has completed registration
   * @returns Level (0-4): 0=no prompt, 1-3=invite levels, 4=should block
   */
  getPromptLevel(messageCount: number, isRegistered: boolean): number {
    // Registered users never get prompted
    if (isRegistered) return 0

    // Unregistered users: progressive levels
    if (messageCount >= 15) return 4 // BLOCK threshold
    if (messageCount >= 12) return 3 // Final warning
    if (messageCount >= 9) return 2  // Second invite
    if (messageCount >= 6) return 1  // First invite
    return 0 // No prompt yet
  }

  /**
   * Get system prompt text for Router LLM based on level
   * 
   * @param level - Prompt level (0-3)
   * @returns System prompt text to append to Router prompt
   */
  getPromptText(level: number): string {
    switch (level) {
      case 1:
        return "\n\n[SYSTEM NOTE: Customer is NOT registered. Message count: 6-8. Naturally encourage registration with [LINK_REGISTRATION] in a friendly, conversational way. Example: 'By the way, if you register you can save your orders and checkout faster!' Keep it light and optional.]"
      
      case 2:
        return "\n\n[SYSTEM NOTE: Customer STILL NOT registered. Message count: 9-11. Be more insistent: highlight concrete benefits of registration (saved orders, faster checkout, exclusive offers, order tracking). Include [LINK_REGISTRATION]. Example: 'I notice you're not registered yet - you're missing out on exclusive discounts and easy order tracking!']"
      
      case 3:
        return "\n\n[SYSTEM URGENT: FINAL WARNING! Customer NOT registered. Message count: 12-14. Warn that chat will be BLOCKED after 15 messages. Urgent but polite tone. Include [LINK_REGISTRATION]. Example: 'Important: You need to register to continue chatting. After 15 messages, unregistered accounts are blocked for security. Register now to keep access!']"
      
      default:
        return ""
    }
  }

  /**
   * Check if user should be blocked due to max messages without registration
   * 
   * @param messageCount - Total messages sent
   * @param isRegistered - Registration status
   * @returns True if user should be blocked
   */
  shouldBlockUser(messageCount: number, isRegistered: boolean): boolean {
    return !isRegistered && messageCount >= 15
  }
}

// Export singleton
export const registrationPromptService = new RegistrationPromptService()
