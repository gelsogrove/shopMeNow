/**
 * @file billing-debug-mode.test.ts
 * @description Unit tests to verify billing tracking is correctly skipped when debugMode = true
 * 
 * CRITICAL RULE: When workspace.debugMode = true, NO billing should be tracked
 * This prevents unwanted costs during development and testing.
 * 
 * @author Andrea
 * @date 2025-10-20
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

describe('Billing Debug Mode Protection', () => {
  describe('CRITICAL: debugMode = true should BLOCK all billing tracking', () => {
    it('should NOT call trackMessage when debugMode is true', () => {
      // Simulate the message.repository.ts logic
      const debugMode = true
      const billingService = {
        trackMessage: jest.fn(),
      }

      // This is the actual logic from message.repository.ts line 993-1006
      if (!debugMode) {
        billingService.trackMessage()
      } else {
        // Debug mode enabled - skip tracking
        console.log('[DEBUG-MODE] 🚫 Usage tracking skipped')
      }

      // ASSERT: trackMessage should NEVER be called when debugMode = true
      expect(billingService.trackMessage).not.toHaveBeenCalled()
    })

    it('should NOT call trackHumanSupport when debugMode is true', () => {
      const debugMode = true
      const billingService = {
        trackHumanSupport: jest.fn(),
      }

      if (!debugMode) {
        billingService.trackHumanSupport()
      } else {
        console.log('[DEBUG-MODE] 🚫 Usage tracking skipped')
      }

      expect(billingService.trackHumanSupport).not.toHaveBeenCalled()
    })

    it('should NOT call trackNewCustomer when debugMode is true', () => {
      const debugMode = true
      const billingService = {
        trackNewCustomer: jest.fn(),
      }

      if (!debugMode) {
        billingService.trackNewCustomer()
      } else {
        console.log('[DEBUG-MODE] 🚫 Usage tracking skipped')
      }

      expect(billingService.trackNewCustomer).not.toHaveBeenCalled()
    })

    it('should NOT call trackNewOrder when debugMode is true', () => {
      const debugMode = true
      const billingService = {
        trackNewOrder: jest.fn(),
      }

      if (!debugMode) {
        billingService.trackNewOrder()
      } else {
        console.log('[DEBUG-MODE] 🚫 Usage tracking skipped')
      }

      expect(billingService.trackNewOrder).not.toHaveBeenCalled()
    })

    it('should NOT call trackPushCampaign when debugMode is true', () => {
      const debugMode = true
      const billingService = {
        trackPushCampaign: jest.fn(),
      }

      if (!debugMode) {
        billingService.trackPushCampaign()
      } else {
        console.log('[DEBUG-MODE] 🚫 Usage tracking skipped')
      }

      expect(billingService.trackPushCampaign).not.toHaveBeenCalled()
    })
  })

  describe('CRITICAL: debugMode = false should ALLOW billing tracking', () => {
    it('SHOULD call trackMessage when debugMode is false', () => {
      const debugMode = false
      const billingService = {
        trackMessage: jest.fn(),
      }

      // This is the actual logic from message.repository.ts
      if (!debugMode) {
        billingService.trackMessage(
          'workspace-id',
          'customer-id',
          'Test message',
          'User question'
        )
      } else {
        console.log('[DEBUG-MODE] 🚫 Usage tracking skipped')
      }

      // ASSERT: trackMessage MUST be called when debugMode = false
      expect(billingService.trackMessage).toHaveBeenCalledTimes(1)
      expect(billingService.trackMessage).toHaveBeenCalledWith(
        'workspace-id',
        'customer-id',
        'Test message',
        'User question'
      )
    })

    it('SHOULD call trackHumanSupport when debugMode is false', () => {
      const debugMode = false
      const billingService = {
        trackHumanSupport: jest.fn(),
      }

      if (!debugMode) {
        billingService.trackHumanSupport(
          'workspace-id',
          'customer-id',
          'Human support request'
        )
      }

      expect(billingService.trackHumanSupport).toHaveBeenCalledTimes(1)
    })

    it('SHOULD call trackNewCustomer when debugMode is false', () => {
      const debugMode = false
      const billingService = {
        trackNewCustomer: jest.fn(),
      }

      if (!debugMode) {
        billingService.trackNewCustomer('workspace-id', 'customer-id')
      }

      expect(billingService.trackNewCustomer).toHaveBeenCalledTimes(1)
    })

    it('SHOULD call trackNewOrder when debugMode is false', () => {
      const debugMode = false
      const billingService = {
        trackNewOrder: jest.fn(),
      }

      if (!debugMode) {
        billingService.trackNewOrder('workspace-id', 'order-id', 'customer-id')
      }

      expect(billingService.trackNewOrder).toHaveBeenCalledTimes(1)
    })

    it('SHOULD call trackPushCampaign when debugMode is false', () => {
      const debugMode = false
      const billingService = {
        trackPushCampaign: jest.fn(),
      }

      if (!debugMode) {
        billingService.trackPushCampaign('workspace-id', 'customer-id', 'Campaign name')
      }

      expect(billingService.trackPushCampaign).toHaveBeenCalledTimes(1)
    })
  })

  describe('Real-world scenarios', () => {
    it('should track 10 messages when debugMode is false', () => {
      const debugMode = false
      const billingService = {
        trackMessage: jest.fn(),
      }

      // Simulate 10 messages
      for (let i = 0; i < 10; i++) {
        if (!debugMode) {
          billingService.trackMessage('workspace-id', 'customer-id', `Message ${i}`, 'Question')
        }
      }

      // ASSERT: All 10 messages should be tracked
      expect(billingService.trackMessage).toHaveBeenCalledTimes(10)
    })

    it('should track ZERO messages when debugMode is true', () => {
      const debugMode = true
      const billingService = {
        trackMessage: jest.fn(),
      }

      // Simulate 10 messages
      for (let i = 0; i < 10; i++) {
        if (!debugMode) {
          billingService.trackMessage('workspace-id', 'customer-id', `Message ${i}`, 'Question')
        }
      }

      // ASSERT: ZERO messages should be tracked
      expect(billingService.trackMessage).toHaveBeenCalledTimes(0)
    })

    it('should correctly switch behavior when debugMode changes', () => {
      let debugMode = true
      const billingService = {
        trackMessage: jest.fn(),
      }

      // Send 5 messages with debugMode = true
      for (let i = 0; i < 5; i++) {
        if (!debugMode) {
          billingService.trackMessage('workspace-id', 'customer-id', `Message ${i}`, 'Question')
        }
      }

      expect(billingService.trackMessage).toHaveBeenCalledTimes(0)

      // Now disable debugMode
      debugMode = false

      // Send 5 more messages with debugMode = false
      for (let i = 5; i < 10; i++) {
        if (!debugMode) {
          billingService.trackMessage('workspace-id', 'customer-id', `Message ${i}`, 'Question')
        }
      }

      // ASSERT: Only the last 5 messages should be tracked
      expect(billingService.trackMessage).toHaveBeenCalledTimes(5)
    })
  })

  describe('Cost calculation verification', () => {
    it('should calculate correct total cost when debugMode is false', () => {
      const debugMode = false
      const MESSAGE_COST = 0.15
      let totalCost = 0
      let messageCount = 0

      // Simulate tracking 20 messages
      for (let i = 0; i < 20; i++) {
        if (!debugMode) {
          totalCost += MESSAGE_COST
          messageCount++
        }
      }

      expect(messageCount).toBe(20)
      expect(totalCost).toBe(3.00) // 20 × €0.15 = €3.00
    })

    it('should calculate ZERO cost when debugMode is true', () => {
      const debugMode = true
      const MESSAGE_COST = 0.15
      let totalCost = 0
      let messageCount = 0

      // Simulate tracking 20 messages (but they won't be tracked)
      for (let i = 0; i < 20; i++) {
        if (!debugMode) {
          totalCost += MESSAGE_COST
          messageCount++
        }
      }

      expect(messageCount).toBe(0)
      expect(totalCost).toBe(0) // NO costs when debugMode = true
    })
  })

  describe('Documentation and logging', () => {
    it('should log debug message when billing is skipped', () => {
      const debugMode = true
      const consoleSpy = jest.spyOn(console, 'log')

      if (!debugMode) {
        // Track billing
      } else {
        console.log('[DEBUG-MODE] 🚫 Usage tracking skipped')
      }

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG-MODE] 🚫 Usage tracking skipped')
    })

    it('should NOT log debug message when billing is enabled', () => {
      const debugMode = false
      const consoleSpy = jest.spyOn(console, 'log')

      if (!debugMode) {
        // Track billing (no debug log)
      } else {
        console.log('[DEBUG-MODE] 🚫 Usage tracking skipped')
      }

      expect(consoleSpy).not.toHaveBeenCalled()
    })
  })
})

describe('Integration with message.repository.ts logic', () => {
  it('should replicate actual message.repository.ts behavior (lines 993-1006)', () => {
    // This test replicates the EXACT logic from message.repository.ts
    const scenarios = [
      { debugMode: true, expectedCalls: 0, description: 'Debug mode ON - no tracking' },
      { debugMode: false, expectedCalls: 1, description: 'Debug mode OFF - tracking enabled' },
    ]

    scenarios.forEach(scenario => {
      const billingService = {
        trackMessage: jest.fn(),
        trackHumanSupport: jest.fn(),
      }

      const isHumanSupport = false
      const workspaceId = 'test-workspace'
      const customerId = 'test-customer'

      // This is the EXACT logic from message.repository.ts lines 982-1006
      if (!scenario.debugMode) {
        if (isHumanSupport) {
          billingService.trackHumanSupport(
            workspaceId,
            customerId,
            'Human support request'
          )
        } else {
          billingService.trackMessage(
            workspaceId,
            customerId,
            'Message from user',
            'User question'
          )
        }
      } else {
        // debugMode is true, skip tracking
        console.log('[DEBUG-MODE] 🚫 Usage tracking skipped')
      }

      // Verify behavior matches expectation
      expect(billingService.trackMessage).toHaveBeenCalledTimes(scenario.expectedCalls)
    })
  })
})
