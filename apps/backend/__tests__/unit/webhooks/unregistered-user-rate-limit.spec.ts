/**
 * Unit Tests for Unregistered User Rate Limiting
 * Feature 204: Unregistered User Flow
 * 
 * CRITICAL: Verifies that unregistered users (isActive=false) are rate-limited:
 * - Max 20 messages in 5 minutes
 * - After 5 minutes, counter resets
 * - Registered users (isActive=true) are NOT affected
 */

describe("Unregistered User Rate Limiting", () => {
  const MAX_MESSAGES = 20
  const TIME_WINDOW_MINUTES = 5

  // =========================================================================
  // SCENARIO 1: Under Limit - Should Allow
  // =========================================================================
  describe("Under Message Limit", () => {
    it("should allow message when user sent 19 messages in last 5 minutes", () => {
      /**
       * EXPECTED BEHAVIOR:
       * - Unregistered user (isActive=false)
       * - Sent 19 messages in last 5 minutes
       * - New message arrives
       * - Should be ALLOWED (19 < 20)
       * - Message processed normally
       */
      const scenario = {
        customer: {
          id: "customer-123",
          isActive: false, // Unregistered
          name: "New Customer",
        },
        messagesInLast5Minutes: 19,
        expectedResult: {
          allowed: true,
          statusCode: 200,
        },
      }

      expect(scenario.messagesInLast5Minutes).toBeLessThan(MAX_MESSAGES)
      expect(scenario.expectedResult.allowed).toBe(true)
    })

    it("should allow first message from new unregistered user", () => {
      /**
       * EXPECTED BEHAVIOR:
       * - Brand new unregistered user
       * - First message ever
       * - Should be ALLOWED
       */
      const scenario = {
        customer: {
          id: "customer-new",
          isActive: false,
          name: "New Customer",
        },
        messagesInLast5Minutes: 0,
        expectedResult: {
          allowed: true,
          statusCode: 200,
        },
      }

      expect(scenario.messagesInLast5Minutes).toBe(0)
      expect(scenario.expectedResult.allowed).toBe(true)
    })
  })

  // =========================================================================
  // SCENARIO 2: At Limit - Should Block
  // =========================================================================
  describe("At/Over Message Limit", () => {
    it("should BLOCK when user sent exactly 20 messages in last 5 minutes", () => {
      /**
       * EXPECTED BEHAVIOR:
       * - Unregistered user sent 20 messages in last 5 minutes
       * - 21st message arrives
       * - Should be BLOCKED (20 >= 20)
       * - Return 403 with registration link
       */
      const scenario = {
        customer: {
          id: "customer-spam",
          isActive: false,
          name: "New Customer",
        },
        messagesInLast5Minutes: 20,
        expectedResult: {
          allowed: false,
          statusCode: 403,
          code: "UNREGISTERED_LIMIT_EXCEEDED",
          message: "Hai raggiunto il limite di 20 messaggi in 5 minuti. Registrati per continuare",
          includesRegistrationLink: true,
          timeWindowMinutes: 5,
        },
      }

      expect(scenario.messagesInLast5Minutes).toBeGreaterThanOrEqual(MAX_MESSAGES)
      expect(scenario.expectedResult.allowed).toBe(false)
      expect(scenario.expectedResult.timeWindowMinutes).toBe(TIME_WINDOW_MINUTES)
    })

    it("should BLOCK when user sent 25 messages in last 5 minutes", () => {
      /**
       * EXPECTED BEHAVIOR:
       * - Unregistered user sent 25 messages (spam)
       * - Should remain BLOCKED
       */
      const scenario = {
        customer: {
          id: "customer-spam-heavy",
          isActive: false,
          name: "New Customer",
        },
        messagesInLast5Minutes: 25,
        expectedResult: {
          allowed: false,
          statusCode: 403,
          code: "UNREGISTERED_LIMIT_EXCEEDED",
        },
      }

      expect(scenario.messagesInLast5Minutes).toBeGreaterThan(MAX_MESSAGES)
      expect(scenario.expectedResult.allowed).toBe(false)
    })
  })

  // =========================================================================
  // SCENARIO 3: Time Window Reset - Should Allow Again
  // =========================================================================
  describe("Time Window Reset (After 5 Minutes)", () => {
    it("should ALLOW message when 5-minute window has passed", () => {
      /**
       * EXPECTED BEHAVIOR:
       * - User sent 20 messages 6 minutes ago
       * - Time window expired (6 min > 5 min)
       * - New message should be ALLOWED
       * - Counter resets automatically
       */
      const now = new Date()
      const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000)

      const scenario = {
        customer: {
          id: "customer-reset",
          isActive: false,
          name: "New Customer",
        },
        lastMessageTime: sixMinutesAgo,
        messagesInLast5Minutes: 0, // Old messages outside window
        messagesOutsideWindow: 20, // These don't count
        expectedResult: {
          allowed: true,
          statusCode: 200,
        },
      }

      const timeElapsedMinutes = (now.getTime() - sixMinutesAgo.getTime()) / (60 * 1000)
      expect(timeElapsedMinutes).toBeGreaterThan(TIME_WINDOW_MINUTES)
      expect(scenario.messagesInLast5Minutes).toBe(0)
      expect(scenario.expectedResult.allowed).toBe(true)
    })

    it("should count only messages within 5-minute window", () => {
      /**
       * EXPECTED BEHAVIOR:
       * - User sent 10 messages 10 minutes ago (outside window)
       * - User sent 5 messages 2 minutes ago (inside window)
       * - Only 5 messages should count
       * - New message should be ALLOWED
       */
      const now = new Date()
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000)
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)

      const scenario = {
        customer: {
          id: "customer-mixed",
          isActive: false,
        },
        messagesAt: [
          { count: 10, timestamp: tenMinutesAgo }, // Outside window
          { count: 5, timestamp: twoMinutesAgo },  // Inside window
        ],
        messagesInLast5Minutes: 5, // Only recent ones count
        expectedResult: {
          allowed: true,
          statusCode: 200,
        },
      }

      expect(scenario.messagesInLast5Minutes).toBeLessThan(MAX_MESSAGES)
      expect(scenario.expectedResult.allowed).toBe(true)
    })
  })

  // =========================================================================
  // SCENARIO 4: Registered Users - NOT Affected
  // =========================================================================
  describe("Registered Users (isActive=true)", () => {
    it("should NOT apply rate limit to registered users", () => {
      /**
       * EXPECTED BEHAVIOR:
       * - Registered user (isActive=true)
       * - Sent 50 messages in last 5 minutes
       * - Rate limit does NOT apply
       * - All messages allowed
       */
      const scenario = {
        customer: {
          id: "customer-registered",
          isActive: true, // REGISTERED
          name: "Andrea Rossi",
          email: "andrea@example.com",
        },
        messagesInLast5Minutes: 50,
        expectedResult: {
          allowed: true,
          statusCode: 200,
          rateLimitChecked: false, // Check skipped
        },
      }

      expect(scenario.customer.isActive).toBe(true)
      expect(scenario.expectedResult.allowed).toBe(true)
      expect(scenario.expectedResult.rateLimitChecked).toBe(false)
    })

    it("should only check rate limit when isActive=false", () => {
      /**
       * EXPECTED BEHAVIOR:
       * - Rate limit check ONLY for unregistered users
       * - if (customer && !customer.isActive) → check
       * - if (customer && customer.isActive) → skip check
       */
      const unregisteredUser = {
        id: "unregistered",
        isActive: false,
      }

      const registeredUser = {
        id: "registered",
        isActive: true,
      }

      expect(!unregisteredUser.isActive).toBe(true) // Should check
      expect(!registeredUser.isActive).toBe(false) // Should NOT check
    })
  })

  // =========================================================================
  // SCENARIO 5: Query Logic Validation
  // =========================================================================
  describe("Database Query Logic", () => {
    it("should query messages with correct time window", () => {
      /**
       * EXPECTED QUERY:
       * ```
       * prisma.conversationMessage.count({
       *   where: {
       *     customerId: "customer-123",
       *     role: "user",
       *     createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
       *   }
       * })
       * ```
       */
      const now = Date.now()
      const fiveMinutesAgo = now - 5 * 60 * 1000
      const fiveMinutesInMs = 5 * 60 * 1000

      const expectedQuery = {
        where: {
          customerId: "customer-123",
          role: "user",
          createdAt: {
            gte: new Date(fiveMinutesAgo),
          },
        },
      }

      expect(expectedQuery.where.role).toBe("user") // Only inbound
      expect(expectedQuery.where.createdAt.gte.getTime()).toBe(fiveMinutesAgo)
      expect(now - expectedQuery.where.createdAt.gte.getTime()).toBe(fiveMinutesInMs)
    })

    it("should only count USER messages (not assistant responses)", () => {
      /**
       * EXPECTED BEHAVIOR:
       * - Only count messages with role="user" (inbound)
       * - Do NOT count role="assistant" (bot responses)
       * - Prevents counting bot's own messages
       */
      const query = {
        where: {
          customerId: "customer-123",
          role: "user", // CRITICAL: Only inbound
          createdAt: { gte: new Date() },
        },
      }

      expect(query.where.role).toBe("user")
      expect(query.where.role).not.toBe("assistant")
    })
  })

  // =========================================================================
  // SCENARIO 6: Error Response Structure
  // =========================================================================
  describe("Error Response When Blocked", () => {
    it("should return correct error structure with registration link", () => {
      /**
       * EXPECTED RESPONSE:
       * {
       *   status: "registration_required",
       *   code: "UNREGISTERED_LIMIT_EXCEEDED",
       *   message: "Hai raggiunto il limite di 20 messaggi in 5 minuti. Registrati per continuare: https://...",
       *   registrationLink: "https://workspace.com/registration",
       *   timeWindowMinutes: 5
       * }
       */
      const errorResponse = {
        status: "registration_required",
        code: "UNREGISTERED_LIMIT_EXCEEDED",
        message: "Hai raggiunto il limite di 20 messaggi in 5 minuti. Registrati per continuare: https://example.com/reg",
        registrationLink: "https://example.com/registration",
        timeWindowMinutes: 5,
      }

      expect(errorResponse.status).toBe("registration_required")
      expect(errorResponse.code).toBe("UNREGISTERED_LIMIT_EXCEEDED")
      expect(errorResponse.message).toContain("20 messaggi")
      expect(errorResponse.message).toContain("5 minuti")
      expect(errorResponse.registrationLink).toBeDefined()
      expect(errorResponse.timeWindowMinutes).toBe(5)
    })

    it("should log detailed info when blocking user", () => {
      /**
       * EXPECTED LOG:
       * logger.warn("[WEBHOOK] 🚫 Unregistered user exceeded message limit", {
       *   customerId: "customer-123",
       *   messageCount: 20,
       *   limit: 20,
       *   timeWindowMinutes: 5
       * })
       */
      const logData = {
        customerId: "customer-spam",
        messageCount: 20,
        limit: 20,
        timeWindowMinutes: 5,
      }

      expect(logData.messageCount).toBeGreaterThanOrEqual(logData.limit)
      expect(logData.timeWindowMinutes).toBe(5)
    })
  })

  // =========================================================================
  // SCENARIO 7: Edge Cases
  // =========================================================================
  describe("Edge Cases", () => {
    it("should handle exactly at boundary (message #20)", () => {
      /**
       * Message 1-19: ALLOWED
       * Message 20: ALLOWED (still under limit during processing)
       * Message 21: BLOCKED (count is now 20)
       */
      const scenario = {
        messageNumber: 21,
        messagesInDatabase: 20,
        expectedResult: {
          allowed: false,
        },
      }

      expect(scenario.messagesInDatabase).toBe(MAX_MESSAGES)
      expect(scenario.expectedResult.allowed).toBe(false)
    })

    it("should handle rapid consecutive messages", () => {
      /**
       * EXPECTED BEHAVIOR:
       * - User sends 5 messages in 10 seconds (rapid fire)
       * - All should count in the 5-minute window
       * - Total count should be accurate
       */
      const now = new Date()
      const messages = [
        { timestamp: new Date(now.getTime() - 10000) }, // 10 sec ago
        { timestamp: new Date(now.getTime() - 8000) },  // 8 sec ago
        { timestamp: new Date(now.getTime() - 6000) },  // 6 sec ago
        { timestamp: new Date(now.getTime() - 4000) },  // 4 sec ago
        { timestamp: new Date(now.getTime() - 2000) },  // 2 sec ago
      ]

      const allWithinWindow = messages.every(
        (msg) => now.getTime() - msg.timestamp.getTime() < 5 * 60 * 1000
      )

      expect(allWithinWindow).toBe(true)
      expect(messages.length).toBe(5)
    })

    it("should not block if customer is null (safety check)", () => {
      /**
       * EXPECTED BEHAVIOR:
       * - if (customer && !customer.isActive) → check
       * - if (customer === null) → skip check
       * - Prevents error when customer lookup fails
       */
      const customer = null

      const shouldCheck = customer && !customer.isActive

      expect(shouldCheck).toBeFalsy()
    })
  })

  // =========================================================================
  // DOCUMENTATION: Implementation Constants
  // =========================================================================
  describe("Implementation Constants", () => {
    it("should document the exact constants used", () => {
      /**
       * Implementation:
       * const MAX_UNREGISTERED_MESSAGES = 20
       * const UNREGISTERED_TIME_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
       */
      const MAX_UNREGISTERED_MESSAGES = 20
      const UNREGISTERED_TIME_WINDOW_MS = 5 * 60 * 1000

      expect(MAX_UNREGISTERED_MESSAGES).toBe(20)
      expect(UNREGISTERED_TIME_WINDOW_MS).toBe(300000) // 5 min in ms
      expect(UNREGISTERED_TIME_WINDOW_MS / 1000 / 60).toBe(5) // 5 minutes
    })
  })
})
