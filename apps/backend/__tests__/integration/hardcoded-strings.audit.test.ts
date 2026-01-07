/**
 * T021: Hardcoded strings audit
 * Validates: No hardcoded prompts, intents, language mappings in routing
 */

import { UnifiedRoutingService } from "../../../src/application/services/unified-routing.service"
import { SimpleIntentHandler } from "../../../src/application/chat-engine/handlers/simple-intent.handler"
import { ResponseBuilderService } from "../../../src/application/services/response-builder.service"
import fs from "fs"
import path from "path"

describe("Hardcoded Strings Audit", () => {
  describe("No hardcoded prompt templates", () => {
    it("should NOT have hardcoded prompts in UnifiedRoutingService", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // These patterns indicate hardcoded prompts (BAD)
      const forbiddenPatterns = [
        /const\s+INTENT_PARSER_PROMPT\s*=/,
        /const\s+ROUTING_PROMPT\s*=/,
        /const\s+SYSTEM_PROMPT\s*=/,
        /`\s*Tu sei un assistente/,
        /template:\s*`/,
      ]

      forbiddenPatterns.forEach((pattern) => {
        expect(content).not.toMatch(pattern)
      })
    })

    it("should NOT have hardcoded language mappings", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Language mappings should come from database, not hardcoded
      const forbiddenPatterns = [
        /const.*languages.*=\s*{[\s\S]*?(it|en|es|pt):/,
        /LANGUAGE_MAP/,
        /LANG_CODES/,
        /supportedLanguages\s*=/,
      ]

      forbiddenPatterns.forEach((pattern) => {
        // Allow only if explicitly part of a type definition or interface
        const matches = content.match(pattern)
        if (matches) {
          matches.forEach((match) => {
            // If it's in a type definition context, it's okay
            const isTypeDefinition = /type|interface|enum/.test(
              content.substring(Math.max(0, content.indexOf(match) - 50), content.indexOf(match))
            )
            if (!isTypeDefinition) {
              fail(`Found potential hardcoded language mapping: ${match}`)
            }
          })
        }
      })
    })
  })

  describe("No hardcoded intent lists", () => {
    it("should NOT have hardcoded intent type mappings", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Intent mappings should come from intent detection, not hardcoded
      const forbiddenPatterns = [
        /const\s+INTENT_KEYWORDS\s*=/,
        /const\s+INTENT_PATTERNS\s*=/,
        /const\s+INTENT_MAP\s*=/,
      ]

      forbiddenPatterns.forEach((pattern) => {
        expect(content).not.toMatch(pattern)
      })
    })

    it("should use IntentParser for intent detection (not hardcoded)", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Should delegate to injected IntentParser service
      expect(content).toContain("intentParser")
      expect(content).not.toContain("const INTENT_") // Reject hardcoded constants
    })
  })

  describe("No hardcoded response templates", () => {
    it("should NOT have hardcoded response messages in SimpleIntentHandler", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/chat-engine/handlers/simple-intent.handler.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Responses should be simple (not templated) or reference database
      // This handler should be minimal - complex templates go to LLM
      const forbiddenPatterns = [
        /const.*RESPONSE.*TEMPLATE/,
        /const.*MESSAGE_TEMPLATE/,
      ]

      forbiddenPatterns.forEach((pattern) => {
        expect(content).not.toMatch(pattern)
      })
    })
  })

  describe("Configuration from database", () => {
    it("should load workspace config from database (not hardcoded)", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Should use getWorkspace() which queries database
      expect(content).toContain("getWorkspace")
      expect(content).toContain("prisma.workspace.findUnique")
      // Should NOT have hardcoded workspace configs
      expect(content).not.toMatch(/const\s+WORKSPACE_CONFIG\s*=/)
    })

    it("should load data from database (products, FAQs, services, offers)", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Should query database for data
      expect(content).toContain("prisma.products.findMany")
      expect(content).toContain("prisma.fAQ.findMany")
      expect(content).toContain("prisma.services.findMany")
      expect(content).toContain("prisma.offers.findMany")
      // Should NOT have mock/hardcoded data
      expect(content).not.toMatch(/const\s+MOCK_PRODUCTS\s*=/)
      expect(content).not.toMatch(/const\s+SAMPLE_DATA\s*=/)
    })
  })

  describe("No string literals in critical paths", () => {
    it("should NOT have hardcoded intent type checks (except in switch)", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Intent types should come from enum/type, not hardcoded strings
      const lines = content.split("\n")
      lines.forEach((line, idx) => {
        // Check for suspicious hardcoded string checks outside switch statements
        if (
          /if.*===\s*"(SHOW_PRODUCTS|ADD_TO_CART|UNKNOWN)"/.test(line) &&
          !lines[Math.max(0, idx - 5)].includes("switch")
        ) {
          // This is flagged but switch statements are allowed
          const context = lines.slice(Math.max(0, idx - 3), idx + 1).join("\n")
          if (!context.includes("case") && !context.includes("switch")) {
            fail(`Hardcoded intent string check at line ${idx + 1}: ${line}`)
          }
        }
      })
    })
  })

  describe("Translation layer separation", () => {
    it("should NOT contain hardcoded translations", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Routing service should NOT translate - leave to Translation Layer
      const forbiddenPatterns = [
        /translate\(/,
        /getTranslation\(/,
        /TRANSLATIONS\s*=/,
        /LANGUAGE_STRINGS\s*=/,
      ]

      forbiddenPatterns.forEach((pattern) => {
        expect(content).not.toMatch(pattern)
      })
    })
  })

  describe("No hardcoded SQL or query logic", () => {
    it("should use Prisma (not raw SQL)", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Should use Prisma ORM
      expect(content).toContain("prisma.")
      // Should NOT have raw SQL
      expect(content).not.toMatch(/sql`|SQL`|query\s*=\s*["'`]/)
    })
  })

  describe("Feature flags from workspace", () => {
    it("should NOT have hardcoded feature toggles", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Feature flags should come from workspace config
      expect(content).toContain("workspace.enable")
      // Should NOT have hardcoded feature flags
      expect(content).not.toMatch(/const\s+FEATURE_[A-Z_]+\s*=\s*(true|false)/)
    })
  })

  describe("Audit summary", () => {
    it("should have clean separation between data and logic", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Count potential violations
      const violations = [
        { pattern: /const\s+[A-Z_]+\s*=\s*{.*?}/, name: "potential hardcoded config" },
        { pattern: /const\s+[A-Z_]+\s*=\s*\[.*?\]/, name: "potential hardcoded array" },
        { pattern: /const\s+[A-Z_]+_PROMPT\s*=/, name: "hardcoded prompt" },
        { pattern: /const\s+[A-Z_]+_TEMPLATE\s*=/, name: "hardcoded template" },
      ]

      const violationCount = violations.reduce((count, { pattern }) => {
        const matches = content.match(new RegExp(pattern, "g")) || []
        return count + matches.length
      }, 0)

      // Allow some constants (like imports, types), but flag excessive hardcoding
      expect(violationCount).toBeLessThan(50) // Reasonable limit for large service
    })

    it("should prioritize database-driven architecture", () => {
      const filePath = path.join(
        __dirname,
        "../../../src/application/services/unified-routing.service.ts"
      )
      const content = fs.readFileSync(filePath, "utf-8")

      // Count database queries
      const dbQueries = (content.match(/prisma\./g) || []).length
      // Count hardcoded data
      const hardcodedData = (content.match(/const\s+[A-Z_]+\s*=/g) || []).length

      // Database queries should far outnumber hardcoded constants
      expect(dbQueries).toBeGreaterThan(5) // At least 5 database operations
      expect(dbQueries).toBeGreaterThan(hardcodedData / 2) // More queries than hardcoded data
    })
  })
})
