import { describe, it, expect } from '@jest/globals'

/**
 * Registration Prompt Level Calculator
 * 
 * BUSINESS RULES:
 * - Messages 1-5: No prompt (level 0)
 * - Messages 6-8: First gentle invite (level 1)
 * - Messages 9-11: Second more insistent invite (level 2)
 * - Messages 12-14: Final warning - will be blocked (level 3)
 * - Messages 15+: BLOCK user (level 4 = blocked)
 * 
 * ONLY for unregistered users (isRegistered = false)
 * Registered users ALWAYS get level 0 (no prompt)
 */

export function getRegistrationPromptLevel(
  messageCount: number,
  isRegistered: boolean
): number {
  // Registered users never get prompted
  if (isRegistered) return 0

  // Unregistered users: progressive levels
  if (messageCount >= 15) return 4 // BLOCK
  if (messageCount >= 12) return 3 // Final warning
  if (messageCount >= 9) return 2  // Second invite
  if (messageCount >= 6) return 1  // First invite
  return 0 // No prompt yet
}

describe('Registration Prompt Level Calculator', () => {
  describe('SCENARIO: Unregistered user progression', () => {
    it('RULE: Messages 1-5 → No prompt (level 0)', () => {
      // GIVEN: Unregistered user with 1-5 messages
      expect(getRegistrationPromptLevel(1, false)).toBe(0)
      expect(getRegistrationPromptLevel(5, false)).toBe(0)
    })

    it('RULE: Messages 6-8 → First gentle invite (level 1)', () => {
      // GIVEN: Unregistered user with 6-8 messages
      // WHEN: Checking registration prompt level
      // THEN: Should return level 1 (first invite)
      expect(getRegistrationPromptLevel(6, false)).toBe(1)
      expect(getRegistrationPromptLevel(7, false)).toBe(1)
      expect(getRegistrationPromptLevel(8, false)).toBe(1)
    })

    it('RULE: Messages 9-11 → Second insistent invite (level 2)', () => {
      // GIVEN: Unregistered user with 9-11 messages
      // WHEN: Checking registration prompt level
      // THEN: Should return level 2 (second invite)
      expect(getRegistrationPromptLevel(9, false)).toBe(2)
      expect(getRegistrationPromptLevel(10, false)).toBe(2)
      expect(getRegistrationPromptLevel(11, false)).toBe(2)
    })

    it('RULE: Messages 12-14 → Final warning before block (level 3)', () => {
      // GIVEN: Unregistered user with 12-14 messages
      // WHEN: Checking registration prompt level
      // THEN: Should return level 3 (final warning)
      expect(getRegistrationPromptLevel(12, false)).toBe(3)
      expect(getRegistrationPromptLevel(13, false)).toBe(3)
      expect(getRegistrationPromptLevel(14, false)).toBe(3)
    })

    it('RULE: Messages 15+ → BLOCK user (level 4)', () => {
      // GIVEN: Unregistered user with 15+ messages
      // WHEN: Checking registration prompt level
      // THEN: Should return level 4 (block user)
      expect(getRegistrationPromptLevel(15, false)).toBe(4)
      expect(getRegistrationPromptLevel(20, false)).toBe(4)
      expect(getRegistrationPromptLevel(100, false)).toBe(4)
    })
  })

  describe('SCENARIO: Registered user - no prompts ever', () => {
    it('RULE: Registered users NEVER get registration prompts', () => {
      // GIVEN: Registered user with ANY number of messages
      // WHEN: Checking registration prompt level
      // THEN: Should ALWAYS return level 0 (no prompt)
      expect(getRegistrationPromptLevel(1, true)).toBe(0)
      expect(getRegistrationPromptLevel(6, true)).toBe(0)
      expect(getRegistrationPromptLevel(12, true)).toBe(0)
      expect(getRegistrationPromptLevel(20, true)).toBe(0)
      expect(getRegistrationPromptLevel(100, true)).toBe(0)
    })
  })

  describe('SCENARIO: Edge cases', () => {
    it('RULE: Exactly at threshold boundaries', () => {
      // GIVEN: Message count exactly at threshold
      // THEN: Should trigger level change
      expect(getRegistrationPromptLevel(5, false)).toBe(0) // Just before first
      expect(getRegistrationPromptLevel(6, false)).toBe(1) // Exactly at first
      expect(getRegistrationPromptLevel(8, false)).toBe(1) // Last of first
      expect(getRegistrationPromptLevel(9, false)).toBe(2) // Exactly at second
      expect(getRegistrationPromptLevel(11, false)).toBe(2) // Last of second
      expect(getRegistrationPromptLevel(12, false)).toBe(3) // Exactly at warning
      expect(getRegistrationPromptLevel(14, false)).toBe(3) // Last warning
      expect(getRegistrationPromptLevel(15, false)).toBe(4) // Block threshold
    })

    it('RULE: Zero messages should return level 0', () => {
      // GIVEN: User with 0 messages (edge case)
      // THEN: Should return no prompt
      expect(getRegistrationPromptLevel(0, false)).toBe(0)
      expect(getRegistrationPromptLevel(0, true)).toBe(0)
    })
  })
})

/**
 * Generate registration prompt text based on level
 */
export function getRegistrationPromptText(level: number): string {
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

describe('Registration Prompt Text Generator', () => {
  describe('SCENARIO: Generate appropriate prompt for each level', () => {
    it('RULE: Level 0 → Empty string (no prompt)', () => {
      const prompt = getRegistrationPromptText(0)
      expect(prompt).toBe("")
    })

    it('RULE: Level 1 → Gentle friendly invitation', () => {
      const prompt = getRegistrationPromptText(1)
      expect(prompt).toContain("friendly")
      expect(prompt).toContain("[LINK_REGISTRATION]")
      expect(prompt).toContain("6-8")
    })

    it('RULE: Level 2 → More insistent with benefits', () => {
      const prompt = getRegistrationPromptText(2)
      expect(prompt).toContain("insistent")
      expect(prompt).toContain("benefits")
      expect(prompt).toContain("[LINK_REGISTRATION]")
      expect(prompt).toContain("9-11")
    })

    it('RULE: Level 3 → Urgent warning about block', () => {
      const prompt = getRegistrationPromptText(3)
      expect(prompt).toContain("URGENT")
      expect(prompt).toContain("BLOCKED")
      expect(prompt).toContain("[LINK_REGISTRATION]")
      expect(prompt).toContain("12-14")
      expect(prompt).toContain("15 messages")
    })

    it('RULE: Invalid levels return empty string', () => {
      expect(getRegistrationPromptText(-1)).toBe("")
      expect(getRegistrationPromptText(5)).toBe("")
      expect(getRegistrationPromptText(999)).toBe("")
    })
  })
})
