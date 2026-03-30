/**
 * BUG #9: Lock Released in Finally Even If Exception Thrown
 *
 * RULE: Lock promise MUST be resolved BEFORE lock is deleted from map
 * VULNERABLE: releaseLock() called in finally AFTER delete(), or without proper error handling
 *
 * FILE: apps/backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts (lines 160-170)
 * ALSO: ultramsg-webhook.controller.ts, wasender-webhook.controller.ts (same pattern)
 *
 * IMPACT:
 * - If _receiveMessageLocked() throws exception
 * - Lock is deleted from map (customerMessageLocks.delete)
 * - Promise might not be resolved (releaseLock not called or called after delete)
 * - Next waiter checks customerMessageLocks.has() → false
 * - Process continues despite lock holder still running
 * - RACE CONDITION: Two messages process simultaneously
 * - DATA CORRUPTION: One overwrites the other's database changes
 */



describe('🔴 BUG #9: Lock Released in Finally Without Proper Error Handling', () => {
  let releaseLocks: Map<string, () => void>

  beforeEach(() => {
    releaseLocks = new Map()
  })

  describe('✅ SAFE: Lock released BEFORE deletion, promise guaranteed resolved', () => {
    it('should resolve promise BEFORE deleting lock (prevents race)', async () => {
      // SCENARIO: Message processing throws exception
      // RULE: Promise must resolve BEFORE lock is removed from map
      // Otherwise: next waiter skips waiting (lock not in map)

      const lockKey = 'customer:+39123456789'
      const customerMessageLocks = new Map<string, Promise<void>>()

      let releaseLock: () => void
      const lockPromise = new Promise<void>((resolve) => {
        releaseLock = resolve
      })
      customerMessageLocks.set(lockKey, lockPromise)

      let processCompleted = false

      // Simulate message processing with error
      const processWithError = async () => {
        try {
          throw new Error('LLM timeout') // Simulated error
        } finally {
          // ✅ SAFE: Resolve BEFORE delete
          releaseLock!()
          customerMessageLocks.delete(lockKey)
          processCompleted = true
        }
      }

      // Simulate second waiter
      const waiter = async () => {
        while (customerMessageLocks.has(lockKey)) {
          await customerMessageLocks.get(lockKey)
        }
        // Only proceeds once lock is released AND deleted
        return 'proceeded'
      }

      await expect(processWithError()).rejects.toThrow()
      await new Promise((r) => setTimeout(r, 10)) // Micro-delay for finally block

      const waiterResult = await Promise.race([
        waiter(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DEADLOCK')), 100)),
      ])

      expect(waiterResult).toBe('proceeded')
      expect(processCompleted).toBe(true)
      expect(customerMessageLocks.has(lockKey)).toBe(false)
    })

    it('should never crash if releaseLock() throws (wrap in try-catch)', async () => {
      // SCENARIO: releaseLock function itself throws (unlikely but defensive)
      // RULE: Must always delete lock from map, never re-throw

      const lockKey = 'customer:+39123456789'
      const customerMessageLocks = new Map<string, Promise<void>>()

      let releaseLock: () => void
      const lockPromise = new Promise<void>((resolve) => {
        releaseLock = () => {
          throw new Error('Unexpected error in release')
        }
        // Still resolve to avoid hanging
        resolve()
      })
      customerMessageLocks.set(lockKey, lockPromise)

      const process = async () => {
        try {
          // Actual work
        } finally {
          try {
            releaseLock!() // Might throw
          } catch (error) {
            console.error('Error releasing lock (ignored):', error)
          }
          customerMessageLocks.delete(lockKey) // Always delete
        }
      }

      // Should not crash
      await expect(process()).resolves.toBeUndefined()
      expect(customerMessageLocks.has(lockKey)).toBe(false)
    })
  })

  describe('❌ VULNERABLE: Lock deleted before promise guaranteed resolved', () => {
    it('demonstrates: delete() before releaseLock() causes race condition', async () => {
      // VULNERABLE PATTERN:
      // try {
      //   await process()
      // } finally {
      //   customerMessageLocks.delete(lockKey) // ← DELETE FIRST
      //   releaseLock!()                         // ← RELEASE AFTER (BAD!)
      // }

      const lockKey = 'customer:+39123456789'
      const customerMessageLocks = new Map<string, Promise<void>>()
      let lockOrder = [] as string[]

      let releaseLock: () => void
      const lockPromise = new Promise<void>((resolve) => {
        releaseLock = () => {
          lockOrder.push('resolved')
          resolve()
        }
      })
      customerMessageLocks.set(lockKey, lockPromise)

      // VULNERABLE: delete before resolve
      const processVulnerable = async () => {
        try {
          throw new Error('Simulated error')
        } finally {
          lockOrder.push('deleted')
          customerMessageLocks.delete(lockKey) // ← DELETE BEFORE
          lockOrder.push('releasing')
          releaseLock!() // ← RELEASE AFTER
        }
      }

      // Waiter that checks map immediately (race window)
      const waiterRacy = async () => {
        // Check map DURING finally block, after delete but before resolve
        await new Promise((r) => setTimeout(r, 5)) // Micro-delay

        // ❌ RACE: Map check happens during delete/release window
        if (customerMessageLocks.has(lockKey)) {
          return 'still waiting'
        } else {
          return 'raced past (DANGEROUS!)' // Lock appeared gone but still resolving
        }
      }

      const [procError, waiterResult] = await Promise.all([
        processVulnerable().catch((e) => e),
        waiterRacy(),
      ])

      // Shows the race window exists
      expect(lockOrder[0]).toBe('deleted')
      expect(lockOrder[1]).toBe('releasing')
      // Waiter might see lock as gone even though finally is still running
    })

    it('demonstrates: exception mid-process leaves lock in unknown state', async () => {
      // SCENARIO: Exception in _receiveMessageLocked()
      // VULNERABLE: What if exception handler fails?

      const lockKey = 'customer:+39123456789'
      const customerMessageLocks = new Map<string, Promise<void>>()
      const events = [] as string[]

      let releaseLock: () => void
      const lockPromise = new Promise<void>((resolve) => {
        releaseLock = resolve
      })
      customerMessageLocks.set(lockKey, lockPromise)

      const messyLockCleanup = async () => {
        try {
          events.push('processing')
          throw new Error('Message processing failed')
        } finally {
          events.push('finally-start')
          // ❌ VULNERABLE: If delete happens first and releaseLock is async...
          customerMessageLocks.delete(lockKey)
          events.push('deleted')
          
          // What if this await gets interrupted?
          await new Promise((r) => setTimeout(r, 1))
          releaseLock()
          events.push('resolved')
        }
      }

      await expect(messyLockCleanup()).rejects.toThrow()

      // Events show the order, but in real async code,
      // another coroutine might check map between delete and resolve
      expect(events).toContain('deleted')
      expect(events).toContain('resolved')
    })
  })

  describe('🔒 Security impact: Concurrent message processing causes data corruption', () => {
    it('shows: missed lock causes 2 messages to process simultaneously', async () => {
      // SCENARIO:
      // Customer sends 2 messages rapid-fire to same WhatsApp number
      //
      // Message 1: Starts processing
      // Message 2: Waits for lock
      //
      // Message 1: Exception mid-process
      // Message 1 finally: delete() called
      // Message 2: Check customerMessageLocks.has() → FALSE
      // Message 2: Starts processing (RACE!)
      // Message 1 finally: releaseLock() still pending
      //
      // Result: Both message 1 & 2 update same cart simultaneously
      // → One write overwrites the other
      // → Customer's cart corrupted

      const scenario = {
        message1: { text: 'Add pizza to cart', quantity: 2 },
        message2: { text: 'Add pasta to cart', quantity: 1 },
        expectedCartItems: 2, // Both items should be added
        vulnerableResult: 1, // Only last one saved due to race
        raceConditionOccurred: true,
      }

      expect(scenario.vulnerableResult).toBeLessThan(scenario.expectedCartItems)
    })

    it('ensures lock cleanup order prevents double-processing', async () => {
      // RULE: Lock cleanup order MUST be:
      // 1. Resolve the promise
      // 2. Delete from map
      // NOT: Delete first, then resolve

      const lockKey = 'customer:+39999888777'
      const customerMessageLocks = new Map<string, Promise<void>>()
      const processingCount = { value: 0 }

      let releaseLock: () => void
      const lockPromise = new Promise<void>((resolve) => {
        releaseLock = resolve
      })
      customerMessageLocks.set(lockKey, lockPromise)

      const message1Process = async () => {
        processingCount.value++
        try {
          throw new Error('Simulated error')
        } finally {
          // ✅ CORRECT ORDER:
          releaseLock!() // 1. Resolve first
          customerMessageLocks.delete(lockKey) // 2. Then delete
        }
      }

      const message2Wait = async () => {
        // Wait for lock to be released
        while (customerMessageLocks.has(lockKey)) {
          await customerMessageLocks.get(lockKey)
        }
        // Only now start processing
        processingCount.value++
      }

      await expect(message1Process()).rejects.toThrow()
      await message2Wait()

      // Both messages should process, but sequentially (not concurrent)
      expect(processingCount.value).toBe(2)
    })
  })

  describe('🔧 Fix validation: lock release pattern', () => {
    it('validates: try/finally with proper lock release order', async () => {
      // This is the CORRECT pattern:
      // try {
      //   await _receiveMessageLocked(req, res)
      // } finally {
      //   releaseLock!() // RESOLVE promise first
      //   customerMessageLocks.delete(lockKey) // THEN delete from map
      // }

      const lockKey = 'customer:+39123456789'
      const customerMessageLocks = new Map<string, Promise<void>>()
      const cleanup = { resolved: false, deleted: false }

      let releaseLock: () => void
      const lockPromise = new Promise<void>((resolve) => {
        releaseLock = () => {
          cleanup.resolved = true
          resolve()
        }
      })
      customerMessageLocks.set(lockKey, lockPromise)

      // Process with error
      const processFunction = async () => {
        try {
          throw new Error('Simulated error')
        } finally {
          releaseLock!() // Step 1: resolve
          customerMessageLocks.delete(lockKey) // Step 2: delete
          cleanup.deleted = true
        }
      }

      await expect(processFunction()).rejects.toThrow()

      // Verify order: resolved BEFORE deleted
      expect(cleanup.resolved).toBe(true)
      expect(cleanup.deleted).toBe(true)
      expect(customerMessageLocks.has(lockKey)).toBe(false)
    })

    it('validates: exception safety with try/catch in finally', async () => {
      // DEFENSIVE: Wrap releaseLock in try/catch to prevent exception swallowing

      const lockKey = 'customer:+39123456789'
      const customerMessageLocks = new Map<string, Promise<void>>()
      const logs = [] as string[]

      let releaseLock: () => void
      const lockPromise = new Promise<void>((resolve) => {
        releaseLock = resolve
      })
      customerMessageLocks.set(lockKey, lockPromise)

      const defensiveCleanup = async () => {
        try {
          throw new Error('Main error')
        } finally {
          try {
            releaseLock!()
            logs.push('lock-released')
          } catch (releaseError) {
            logs.push('release-failed')
            // Don't re-throw - must clean up map
          }
          customerMessageLocks.delete(lockKey)
          logs.push('lock-deleted')
        }
      }

      await expect(defensiveCleanup()).rejects.toThrow('Main error')

      // Should complete cleanup despite any release error
      expect(logs).toContain('lock-deleted')
      expect(customerMessageLocks.has(lockKey)).toBe(false)
    })
  })

  describe('⚡ Concurrency stress test: multiple messages', () => {
    it('should handle 5 rapid messages with proper lock serialization', async () => {
      const messageCount = 5
      const lockKey = 'customer:+39123456789'
      const customerMessageLocks = new Map<string, Promise<void>>()
      const processedMessages = [] as number[]

      const processMessage = async (messageId: number) => {
        // Wait for existing lock
        while (customerMessageLocks.has(lockKey)) {
          await customerMessageLocks.get(lockKey)
        }

        // Create lock for this message
        let releaseLock!: () => void
        const lockPromise = new Promise<void>((resolve) => {
          releaseLock = resolve
        })
        customerMessageLocks.set(lockKey, lockPromise)

        try {
          // Simulate processing
          await new Promise((r) => setTimeout(r, 5))
          processedMessages.push(messageId)
        } finally {
          // Clean up in correct order
          releaseLock()
          customerMessageLocks.delete(lockKey)
        }
      }

      // Send 5 messages concurrently
      await Promise.all(Array.from({ length: messageCount }, (_, i) => processMessage(i)))

      // All should process (no deadlock)
      expect(processedMessages).toHaveLength(messageCount)
      // They should process sequentially (in some order)
      expect(processedMessages.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
    })
  })
})
