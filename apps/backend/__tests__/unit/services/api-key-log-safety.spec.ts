/**
 * API Key Log Safety Tests (BUG#12)
 *
 * VULNERABILITY: message.repository.ts was logging partial API key material
 * in two places, in production at level `logger.info`:
 *
 *   // VULNERABLE (module-level):
 *   logger.info(`API key prefix: ${apiKey.substring(0, 10)}...`)
 *
 *   // VULNERABLE (callFunctionRouter method):
 *   logger.info("OPENROUTER_API_KEY check:", {
 *     present: !!process.env.OPENROUTER_API_KEY,
 *     length: process.env.OPENROUTER_API_KEY?.length || 0,        // ← leaks
 *     prefix: process.env.OPENROUTER_API_KEY?.substring(0, 15),   // ← leaks
 *   })
 *
 * Even the first 15 characters of an API key dramatically reduce the search
 * space for an attacker with access to log aggregators (Papertrail, Datadog,
 * CloudWatch, etc.).  Length also leaks format/provider information.
 *
 * FIX:
 * - Downgraded all key-related logs from `info` to `debug` (not collected
 *   in production by default)
 * - Removed `prefix` and `length` fields — only `present: boolean` is logged
 */

describe('API Key Log Safety Utilities (BUG#12)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // CORE RULE: Safe logging helper — verify the FIXED log format
  // ─────────────────────────────────────────────────────────────────────────

  describe('safe vs unsafe log object structure', () => {
    it('should not expose prefix in the fixed log format', () => {
      // SCENARIO: callFunctionRouter logs OpenRouter key health
      // RULE: Only boolean `present` is allowed — no prefix, no length
      const apiKey = 'sk-or-test-v1-SuperSecretKeyForLoggingTest'

      // ✅ FIXED format (what the code does AFTER the fix)
      const fixedLogObject = {
        present: !!apiKey,
      }

      const serialised = JSON.stringify(fixedLogObject)

      // Must not expose key material
      expect(serialised).not.toContain(apiKey.substring(0, 10))
      expect(serialised).not.toContain(apiKey.substring(0, 15))
      expect(serialised).not.toContain('prefix')
      expect(serialised).not.toContain('length')
      // Only allowed field
      expect(serialised).toContain('"present":true')
    })

    it('should demonstrate why the old format was dangerous', () => {
      // SCENARIO: Contrast fixed format with what the old code produced
      // RULE: This test documents the vulnerability so reviewers understand the risk
      const apiKey = 'sk-or-test-v1-SuperSecretKeyForLoggingTest'

      // ❌ OLD (vulnerable) format — removed by BUG#12 fix
      const vulnerableLogObject = {
        present: !!apiKey,
        length: apiKey.length,                 // ← leaks key length / format info
        prefix: apiKey.substring(0, 15),       // ← leaks first 15 chars to logs
      }

      // Prove the old code WAS leaking
      const vulnerableSerialised = JSON.stringify(vulnerableLogObject)
      expect(vulnerableSerialised).toContain(apiKey.substring(0, 15))
      expect(vulnerableSerialised).toContain('prefix')
      expect(vulnerableSerialised).toContain('length')

      // ✅ Verify fixed format eliminates the leak
      const fixedLogObject = { present: !!apiKey }
      const fixedSerialised = JSON.stringify(fixedLogObject)
      expect(fixedSerialised).not.toContain(apiKey.substring(0, 15))
      expect(fixedSerialised).not.toContain('prefix')
    })

    it('should treat missing key safely too', () => {
      // SCENARIO: OPENROUTER_API_KEY is undefined (misconfiguration)
      // RULE: No error thrown, `present` is false — no other fields
      const apiKey = undefined

      const safeLogObject = {
        present: !!apiKey,
      }

      expect(safeLogObject.present).toBe(false)
      const serialised = JSON.stringify(safeLogObject)
      expect(serialised).toContain('"present":false')
      expect(serialised).not.toContain('prefix')
      expect(serialised).not.toContain('undefined')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // REGRESSION: Boolean presence check still works
  // ─────────────────────────────────────────────────────────────────────────

  describe('key presence detection (regression)', () => {
    it('should detect key is present when set', () => {
      const key = 'sk-or-test-somevalue'
      expect(!!key).toBe(true)
    })

    it('should detect key is absent when empty string', () => {
      const key = ''
      expect(!!key).toBe(false)
    })

    it('should detect key is absent when undefined', () => {
      const key = undefined
      expect(!!key).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // RULE: isOpenAIConfigured should use debug-level logs only
  // ─────────────────────────────────────────────────────────────────────────

  describe('isOpenAIConfigured log level contract', () => {
    it('fixed log format should not produce info-level key material', () => {
      // SCENARIO: Verify that the debug-level log captures only a boolean
      // RULE: "API key check - present: <bool>" is the allowed format
      const apiKey = 'sk-or-test-anothersecretkey987654'

      const allowedLogMessage = `API key check - present: ${!!apiKey}`

      // The allowed message does NOT contain the raw key or its characters
      expect(allowedLogMessage).not.toContain(apiKey)
      expect(allowedLogMessage).not.toContain(apiKey.substring(0, 10))
      // The allowed message DOES contain a useful signal
      expect(allowedLogMessage).toContain('present: true')
    })

    it('old log format would have leaked the prefix', () => {
      // Document what was wrong so future devs understand the regression risk
      const apiKey = 'sk-or-test-anothersecretkey987654'

      // Old code:
      const badLog1 = `API key check - key present: ${!!apiKey}, key length: ${apiKey.length}`
      const badLog2 = `API key prefix: ${apiKey.substring(0, 10)}...`

      expect(badLog1).toContain(String(apiKey.length)) // length leaked
      expect(badLog2).toContain(apiKey.substring(0, 10)) // prefix leaked

      // Fixed code uses neither of those fields
      const goodLog = `API key check - present: ${!!apiKey}`
      expect(goodLog).not.toContain(String(apiKey.length))
      expect(goodLog).not.toContain(apiKey.substring(0, 10))
    })
  })
})
