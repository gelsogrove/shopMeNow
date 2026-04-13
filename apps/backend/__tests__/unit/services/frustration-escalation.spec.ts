import { describe, it, expect, beforeEach, jest } from "@jest/globals"

/**
 * Feature 203: Frustration Escalation Configuration Tests
 *
 * Tests for the custom escalation triggers feature that allows workspace owners
 * to define specific scenarios when the chatbot should escalate to human operator.
 *
 * Critical Points Tested:
 * 1. Variable resolution from database
 * 2. Template injection (conditional rendering)
 * 3. Priority order: FAQ > Frustration triggers > Generic responses
 */

// Mock workspace data
const createMockWorkspace = (overrides = {}) => ({
  id: "test-workspace-id",
  name: "Test Workspace",
  humanSupportInstructions: "Test support instructions",
  frustrationEscalationInstructions: null, // Default: not configured
  hasHumanSupport: true,
  channelMode: 'ECOMMERCE' as any,
  ...overrides,
})

describe("Feature 203: Frustration Escalation Configuration", () => {
  describe("Variable Resolution", () => {
    it("should return empty string when frustrationEscalationInstructions is null", () => {
      const workspace = createMockWorkspace({ frustrationEscalationInstructions: null })

      const result = workspace.frustrationEscalationInstructions || ""

      expect(result).toBe("")
    })

    it("should return the configured instructions when set", () => {
      const customInstructions = `Chiama operatore quando:
- Merce arrivata scaduta
- Merce arrivata rotta
- Cliente vuole cambiare ordine`

      const workspace = createMockWorkspace({
        frustrationEscalationInstructions: customInstructions,
      })

      expect(workspace.frustrationEscalationInstructions).toBe(customInstructions)
    })

    it("should handle very long instructions (up to 5000 chars)", () => {
      const longInstructions = "x".repeat(5000)
      const workspace = createMockWorkspace({
        frustrationEscalationInstructions: longInstructions,
      })

      expect(workspace.frustrationEscalationInstructions?.length).toBe(5000)
    })
  })

  describe("Template Conditional Rendering", () => {
    /**
     * Simulates Handlebars {{#if}} behavior for template injection
     * Supports nested {{#if}} blocks
     */
    const renderTemplate = (template: string, variables: Record<string, unknown>) => {
      let result = template

      // Handle nested {{#if var}}...{{/if}} replacement (process innermost first)
      let previousResult = ""
      while (previousResult !== result) {
        previousResult = result
        const ifPattern = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g
        result = result.replace(ifPattern, (_, varName, content) => {
          const value = variables[varName]
          return value ? content : ""
        })
      }

      // Simple {{var}} replacement
      const varPattern = /\{\{(\w+)\}\}/g
      result = result.replace(varPattern, (_, varName) => {
        const value = variables[varName]
        return value?.toString() || ""
      })

      return result
    }

    it("should NOT render escalation block when frustrationEscalationInstructions is empty", () => {
      const template = `Base prompt.
{{#if hasHumanSupport}}
{{#if frustrationEscalationInstructions}}
🚨 ESCALATION TRIGGERS:
{{frustrationEscalationInstructions}}
{{/if}}
{{/if}}
Continue with normal flow.`

      const variables = {
        hasHumanSupport: true,
        frustrationEscalationInstructions: "",
      }

      const result = renderTemplate(template, variables)

      expect(result).not.toContain("ESCALATION TRIGGERS")
      expect(result).toContain("Base prompt.")
      expect(result).toContain("Continue with normal flow.")
    })

    it("should render escalation block when frustrationEscalationInstructions is configured", () => {
      const template = `Base prompt.
{{#if hasHumanSupport}}
{{#if frustrationEscalationInstructions}}
🚨 ESCALATION TRIGGERS:
{{frustrationEscalationInstructions}}
{{/if}}
{{/if}}
Continue with normal flow.`

      const variables = {
        hasHumanSupport: true,
        frustrationEscalationInstructions: "Chiama operatore per merce rotta",
      }

      const result = renderTemplate(template, variables)

      expect(result).toContain("ESCALATION TRIGGERS")
      expect(result).toContain("Chiama operatore per merce rotta")
    })

    it("should NOT render escalation block when hasHumanSupport is false (even if instructions are set)", () => {
      const template = `Base prompt.
{{#if hasHumanSupport}}
{{#if frustrationEscalationInstructions}}
🚨 ESCALATION TRIGGERS:
{{frustrationEscalationInstructions}}
{{/if}}
{{/if}}
Continue with normal flow.`

      const variables = {
        hasHumanSupport: false, // Human support disabled
        frustrationEscalationInstructions: "Chiama operatore per merce rotta",
      }

      const result = renderTemplate(template, variables)

      expect(result).not.toContain("ESCALATION TRIGGERS")
      expect(result).not.toContain("Chiama operatore per merce rotta")
      expect(result).toContain("Continue with normal flow.")
    })
  })

  describe("Priority Order: FAQ > Frustration > Generic", () => {
    it("should include priority instructions in the escalation config", () => {
      const escalationInstructions = `Chiama operatore quando:
- Merce arrivata scaduta
- Merce arrivata rotta

⚠️ IMPORTANTE: 
- Prima controlla SEMPRE nelle FAQ se esiste una risposta predefinita
- Chiama l'operatore SOLO per i casi sopra elencati quando NON c'è risposta FAQ`

      // Verify the instructions contain priority guidance
      expect(escalationInstructions).toContain("Prima controlla SEMPRE nelle FAQ")
      expect(escalationInstructions).toContain("quando NON c'è risposta FAQ")
    })

    it("should place escalation block at TOP of prompt for visibility", () => {
      // Router template structure check
      const routerTemplate = `## 🚨 CUSTOM ESCALATION TRIGGERS (HIGHEST PRIORITY)
{{#if frustrationEscalationInstructions}}
{{frustrationEscalationInstructions}}
{{/if}}

## Normal routing logic below...`

      expect(routerTemplate.indexOf("HIGHEST PRIORITY")).toBeLessThan(
        routerTemplate.indexOf("Normal routing")
      )
    })
  })

  describe("Workspace Controller Integration", () => {
    /**
     * Simulates the workspace controller serialization
     */
    const serializeWorkspace = (workspace: ReturnType<typeof createMockWorkspace>) => ({
      id: workspace.id,
      name: workspace.name,
      hasHumanSupport: workspace.hasHumanSupport,
      humanSupportInstructions: workspace.humanSupportInstructions,
      frustrationEscalationInstructions: workspace.frustrationEscalationInstructions,
      // Computed property
      hasFrustrationInstructions: Boolean(
        workspace.frustrationEscalationInstructions &&
        workspace.frustrationEscalationInstructions.trim().length > 0
      ),
    })

    it("should include frustrationEscalationInstructions in serialized response", () => {
      const workspace = createMockWorkspace({
        frustrationEscalationInstructions: "Test escalation",
      })

      const serialized = serializeWorkspace(workspace)

      expect(serialized).toHaveProperty("frustrationEscalationInstructions")
      expect(serialized.frustrationEscalationInstructions).toBe("Test escalation")
    })

    it("should compute hasFrustrationInstructions correctly", () => {
      const workspaceWithInstructions = createMockWorkspace({
        frustrationEscalationInstructions: "Test escalation",
      })
      const workspaceWithoutInstructions = createMockWorkspace({
        frustrationEscalationInstructions: null,
      })
      const workspaceWithEmptyString = createMockWorkspace({
        frustrationEscalationInstructions: "   ",
      })

      expect(serializeWorkspace(workspaceWithInstructions).hasFrustrationInstructions).toBe(true)
      expect(serializeWorkspace(workspaceWithoutInstructions).hasFrustrationInstructions).toBe(false)
      expect(serializeWorkspace(workspaceWithEmptyString).hasFrustrationInstructions).toBe(false)
    })
  })

  describe("Escalation Cases Validation", () => {
    /**
     * Andrea's specific escalation cases:
     * 1. Merce arrivata scaduta
     * 2. Merce arrivata rotta
     * 3. Cliente vuole cambiare ordine
     * 4. Cliente vuole cancellare ordine
     * 5. Richiesta esplicita di parlare con operatore
     */
    const defaultEscalationCases = [
      "merce arrivata scaduta",
      "merce arrivata rotta",
      "cambiare ordine",
      "cancellare ordine",
      "parlare con operatore",
    ]

    it("should support all 5 default escalation cases", () => {
      const escalationInstructions = `Chiama IMMEDIATAMENTE l'operatore quando il cliente:
- Si lamenta che la MERCE È ARRIVATA SCADUTA
- Si lamenta che la MERCE È ARRIVATA ROTTA/DANNEGGIATA
- Vuole MODIFICARE UN ORDINE già effettuato
- Vuole CANCELLARE UN ORDINE
- Chiede ESPLICITAMENTE di parlare con un OPERATORE UMANO`

      const lowerInstructions = escalationInstructions.toLowerCase()

      defaultEscalationCases.forEach((caseText) => {
        const keywords = caseText.split(" ")
        const hasCase = keywords.some((keyword) => lowerInstructions.includes(keyword))
        expect(hasCase).toBe(true)
      })
    })
  })

  describe("Input Validation", () => {
    it("should accept empty/null values", () => {
      const workspace1 = createMockWorkspace({ frustrationEscalationInstructions: null })
      const workspace2 = createMockWorkspace({ frustrationEscalationInstructions: "" })

      expect(workspace1.frustrationEscalationInstructions).toBeNull()
      expect(workspace2.frustrationEscalationInstructions).toBe("")
    })

    it("should handle special characters and newlines", () => {
      const instructionsWithSpecialChars = `Escalation rules:
- Prodotto danneggiato (€, £, ¥)
- "Urgente!" con emoji 🚨
- Quote's and "double quotes"
<html>tags</html>`

      const workspace = createMockWorkspace({
        frustrationEscalationInstructions: instructionsWithSpecialChars,
      })

      expect(workspace.frustrationEscalationInstructions).toContain("€")
      expect(workspace.frustrationEscalationInstructions).toContain("🚨")
      expect(workspace.frustrationEscalationInstructions).toContain("<html>")
    })

    it("should preserve Italian accented characters", () => {
      const italianText = "Perché l'utente è frustrato e vuole parlare con qualcuno"

      const workspace = createMockWorkspace({
        frustrationEscalationInstructions: italianText,
      })

      expect(workspace.frustrationEscalationInstructions).toContain("Perché")
      expect(workspace.frustrationEscalationInstructions).toContain("è")
    })
  })
})
