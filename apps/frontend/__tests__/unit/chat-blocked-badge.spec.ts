/**
 * Chat History - Blocked Badge Logic Tests
 *
 * SCENARIO: When a message has deliveryStatus="blocked", the admin chat page
 * should display a red "BLOCKED" badge and "Not sent to customer" indicator.
 *
 * WHY: The Security Agent can block outgoing messages containing unsafe content.
 * These messages are saved in ConversationMessage with deliveryStatus="blocked"
 * but were invisible in the admin UI - Andrea couldn't see WHY messages weren't sent.
 *
 * RULE: deliveryStatus="blocked" → red styling + BLOCKED badge + "Not sent" indicator
 */

describe('Chat History - Blocked Badge Logic', () => {
  // Test the classification logic used in ChatPage.tsx message rendering
  const classifyMessage = (message: {
    sender: 'user' | 'customer'
    deliveryStatus?: string
    metadata?: {
      agentSelected?: string
      isOperatorMessage?: boolean
      isOperatorControl?: boolean
      sentBy?: string
    }
    agentName?: string
  }) => {
    const isAgentMessage = message.sender === 'user'
    const isBlockedMessage = message.deliveryStatus === 'blocked'

    const isOperatorMessage =
      isAgentMessage &&
      (message.metadata?.agentSelected === 'MANUAL_OPERATOR' ||
        message.metadata?.isOperatorMessage === true ||
        message.metadata?.sentBy === 'HUMAN_OPERATOR')

    const isOperatorControl = message.metadata?.isOperatorControl === true

    // Mirror getMessageStyle logic from ChatPage.tsx
    const getStyle = () => {
      if (isBlockedMessage) {
        return 'blocked'
      }
      if (!isAgentMessage) {
        return isOperatorControl ? 'customer-under-control' : 'customer'
      }
      if (
        message.metadata?.agentSelected === 'CHATBOT' ||
        message.metadata?.agentSelected?.startsWith('CHATBOT_') ||
        message.metadata?.agentSelected === 'AI' ||
        message.metadata?.agentSelected === 'LLM' ||
        message.agentName
      ) {
        return 'chatbot'
      }
      if (message.metadata?.agentSelected === 'MANUAL_OPERATOR') {
        return 'operator'
      }
      return 'default'
    }

    return {
      isBlockedMessage,
      isAgentMessage,
      isOperatorMessage,
      isOperatorControl,
      style: getStyle(),
      needsTopPadding: isOperatorMessage || isOperatorControl || isBlockedMessage,
    }
  }

  describe('deliveryStatus=blocked detection', () => {
    // SCENARIO: Outbound message blocked by Security Agent
    it('should identify blocked messages correctly', () => {
      const result = classifyMessage({
        sender: 'user',
        deliveryStatus: 'blocked',
        metadata: { agentSelected: 'CHATBOT' },
      })

      expect(result.isBlockedMessage).toBe(true)
      expect(result.style).toBe('blocked')
      expect(result.needsTopPadding).toBe(true)
    })

    // SCENARIO: Normal sent message should NOT be blocked
    it('should not mark sent messages as blocked', () => {
      const result = classifyMessage({
        sender: 'user',
        deliveryStatus: 'sent',
        metadata: { agentSelected: 'CHATBOT' },
      })

      expect(result.isBlockedMessage).toBe(false)
      expect(result.style).toBe('chatbot')
    })

    // SCENARIO: Pending messages should NOT be blocked
    it('should not mark pending messages as blocked', () => {
      const result = classifyMessage({
        sender: 'user',
        deliveryStatus: 'pending',
        metadata: { agentSelected: 'CHATBOT' },
      })

      expect(result.isBlockedMessage).toBe(false)
      expect(result.style).toBe('chatbot')
    })

    // SCENARIO: Messages without deliveryStatus should NOT be blocked
    it('should not mark messages without deliveryStatus as blocked', () => {
      const result = classifyMessage({
        sender: 'user',
        metadata: { agentSelected: 'CHATBOT' },
      })

      expect(result.isBlockedMessage).toBe(false)
    })

    // SCENARIO: not_queued (widget messages) should not be blocked
    it('should not mark not_queued messages as blocked', () => {
      const result = classifyMessage({
        sender: 'user',
        deliveryStatus: 'not_queued',
        metadata: { agentSelected: 'CHATBOT' },
      })

      expect(result.isBlockedMessage).toBe(false)
      expect(result.style).toBe('chatbot')
    })

    // SCENARIO: Error messages should NOT show blocked badge
    it('should not mark error deliveryStatus as blocked', () => {
      const result = classifyMessage({
        sender: 'user',
        deliveryStatus: 'error',
        metadata: { agentSelected: 'CHATBOT' },
      })

      expect(result.isBlockedMessage).toBe(false)
    })
  })

  describe('Blocked style priority', () => {
    // SCENARIO: Blocked style takes priority over chatbot style
    // RULE: A blocked chatbot message should show RED, not GREEN
    it('should show blocked style even for chatbot messages', () => {
      const result = classifyMessage({
        sender: 'user',
        deliveryStatus: 'blocked',
        metadata: { agentSelected: 'CHATBOT' },
        agentName: 'ProductAgent',
      })

      expect(result.style).toBe('blocked')
      expect(result.isBlockedMessage).toBe(true)
    })

    // SCENARIO: Blocked operator message should show RED, not BLUE
    it('should show blocked style even for operator messages', () => {
      const result = classifyMessage({
        sender: 'user',
        deliveryStatus: 'blocked',
        metadata: {
          agentSelected: 'MANUAL_OPERATOR',
          isOperatorMessage: true,
          sentBy: 'HUMAN_OPERATOR',
        },
      })

      expect(result.style).toBe('blocked')
      expect(result.isBlockedMessage).toBe(true)
      expect(result.isOperatorMessage).toBe(true)
    })

    // SCENARIO: Customer inbound messages with blocked status
    // RULE: Blocked customer messages should also show blocked style
    it('should show blocked style for customer messages too', () => {
      const result = classifyMessage({
        sender: 'customer',
        deliveryStatus: 'blocked',
      })

      expect(result.isBlockedMessage).toBe(true)
      expect(result.style).toBe('blocked')
    })
  })

  describe('Message data mapping', () => {
    // SCENARIO: deliveryStatus must be mapped from API response
    // RULE: Frontend Message type must include deliveryStatus field
    it('Message type should support all deliveryStatus values', () => {
      const validStatuses = ['not_queued', 'pending', 'sent', 'error', 'blocked']

      for (const status of validStatuses) {
        const result = classifyMessage({
          sender: 'user',
          deliveryStatus: status,
          metadata: { agentSelected: 'CHATBOT' },
        })

        // Should not throw or produce undefined results
        expect(result.isBlockedMessage).toBe(status === 'blocked')
      }
    })

    // SCENARIO: API message mapping should include deliveryStatus
    it('should correctly map API response to frontend Message', () => {
      // Simulate the mapping done in ChatPage.tsx fetchMessagesForChat
      const apiMessage = {
        id: 'msg-1',
        content: 'Hello!',
        direction: 'OUTBOUND',
        createdAt: '2025-01-01T00:00:00Z',
        deliveryStatus: 'blocked',
        metadata: { agentName: 'ChatBot', agentSelected: 'CHATBOT' },
      }

      // This is the transformation done in ChatPage.tsx
      const transformed = {
        id: apiMessage.id,
        content: apiMessage.content,
        sender: apiMessage.direction === 'INBOUND' ? 'customer' : 'user' as const,
        timestamp: apiMessage.createdAt,
        agentName: apiMessage.metadata?.agentName || undefined,
        deliveryStatus: apiMessage.deliveryStatus,
        metadata: apiMessage.metadata,
      }

      expect(transformed.deliveryStatus).toBe('blocked')
      expect(transformed.sender).toBe('user')
    })
  })
})
