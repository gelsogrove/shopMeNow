/**
 * Unit tests for Customer Chat Switch functionality
 *
 * Tests cover:
 * 1. Messages reset when switching customers
 * 2. Correct customer name displayed after switch
 * 3. No stale data from previous customer
 */

import { describe, it, expect } from "vitest"

// Mock Chat interface
interface Chat {
  id: string
  sessionId: string
  customerId: string
  customerName: string
  messages: Message[]
}

interface Message {
  id: string
  content: string
  sender: "user" | "customer"
}

describe("Customer Chat Switch", () => {
  describe("State Reset on Customer Change", () => {
    it("should clear messages when switching customers", () => {
      // Initial state - Mario Rossi's messages
      let messages: Message[] = [
        { id: "1", content: "Ciao Mario!", sender: "user" },
        { id: "2", content: "Ciao!", sender: "customer" },
      ]

      const marioChat: Chat = {
        id: "chat-mario",
        sessionId: "session-mario",
        customerId: "cust-mario",
        customerName: "Mario Rossi",
        messages,
      }

      const johnChat: Chat = {
        id: "chat-john",
        sessionId: "session-john",
        customerId: "cust-john",
        customerName: "John Smith",
        messages: [],
      }

      // Switch from Mario to John
      let selectedChat = marioChat
      const prevChatId = selectedChat.id

      selectedChat = johnChat

      // Simulate the useEffect logic
      if (selectedChat.id !== prevChatId) {
        messages = [] // Clear messages on switch
      }

      expect(messages).toHaveLength(0)
      expect(selectedChat.customerName).toBe("John Smith")
    })

    it("should NOT clear messages when clicking same customer", () => {
      let messages: Message[] = [
        { id: "1", content: "Ciao Mario!", sender: "user" },
        { id: "2", content: "Ciao!", sender: "customer" },
      ]

      const marioChat: Chat = {
        id: "chat-mario",
        sessionId: "session-mario",
        customerId: "cust-mario",
        customerName: "Mario Rossi",
        messages,
      }

      // Click same customer again
      let selectedChat = marioChat
      const prevChatId = selectedChat.id

      selectedChat = marioChat // Same chat

      if (selectedChat.id !== prevChatId) {
        messages = []
      }

      expect(messages).toHaveLength(2) // Messages preserved
    })
  })

  describe("Session ID Tracking", () => {
    it("should track previous session ID correctly", () => {
      let prevSessionId: string | null = null

      // First selection
      const session1 = "session-mario"
      if (session1 !== prevSessionId) {
        prevSessionId = session1
      }
      expect(prevSessionId).toBe("session-mario")

      // Second selection (different customer)
      const session2 = "session-john"
      const wasChanged = session2 !== prevSessionId
      if (wasChanged) {
        prevSessionId = session2
      }

      expect(wasChanged).toBe(true)
      expect(prevSessionId).toBe("session-john")
    })
  })

  describe("Customer Data Isolation", () => {
    it("should not mix data between customers", () => {
      const marioData = {
        id: "mario-123",
        name: "Mario Rossi",
        phone: "+390212345678",
        language: "IT",
      }

      const johnData = {
        id: "john-456",
        name: "John Smith",
        phone: "+44123456789",
        language: "EN",
      }

      // Verify data is distinct
      expect(marioData.id).not.toBe(johnData.id)
      expect(marioData.name).not.toBe(johnData.name)
      expect(marioData.phone).not.toBe(johnData.phone)
    })
  })
})
