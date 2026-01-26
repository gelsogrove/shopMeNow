/**
 * Unit Test: Widget Visitor Name Handling
 * 
 * CRITICAL: Verify that "Visitor XXXXX" names are NOT shown in widget welcome messages
 * 
 * Tests:
 * 1. Names starting with "Visitor" should be filtered out (empty string)
 * 2. Real customer names should be preserved
 * 3. Welcome messages should NOT show "Hola Visitors -173737"
 */

import { PromptVariableBuilder } from "../../src/application/services/prompt-variable-builder.service"

describe("Widget Visitor Name - Variable Replacement", () => {
  it("should filter out 'Visitor XXXXX' names and return empty string", () => {
    const customer = {
      id: "test-id",
      name: "Visitor -173737",
      email: "test@visitor.local",
      phone: null,
      discount: 0,
      isActive: false,
      language: "ENG",
      company: null,
      push_notifications_consent: false,
      sales: null,
    }

    const workspace = {
      id: "workspace-id",
      name: "Test Shop",
      chatbotName: "SofiA",
    }

    const context = {
      channel: "widget", // 🚫 WIDGET CHANNEL - filters out visitor names
    }

    const variables = PromptVariableBuilder.build(customer, workspace, {}, context)

    // 🎯 CRITICAL: customerName should be EMPTY for "Visitor XXXXX" names
    expect(variables.customerName).toBe("")
    // This prevents "Hola Visitors -173737" in welcome messages
  })

  it("should preserve real customer names", () => {
    const customer = {
      id: "test-id",
      name: "Andrea Rossi",
      email: "andrea@test.com",
      phone: "+391234567890",
      discount: 10,
      isActive: true,
      language: "ITA",
      company: null,
      push_notifications_consent: true,
      sales: null,
    }

    const workspace = {
      id: "workspace-id",
      name: "Test Shop",
      chatbotName: "SofiA",
    }

    const context = {
      channel: "whatsapp", // WhatsApp keeps real names
    }

    const variables = PromptVariableBuilder.build(customer, workspace, {}, context)

    // ✅ Real names should be preserved
    expect(variables.customerName).toBe("Andrea Rossi")
  })

  it("should use default 'Cliente' when no customer name provided", () => {
    const customer = {
      id: "test-id",
      name: null,
      email: "test@test.com",
      phone: null,
      discount: 0,
      isActive: false,
      language: "ITA",
      company: null,
      push_notifications_consent: false,
      sales: null,
    }

    const workspace = {
      id: "workspace-id",
      name: "Test Shop",
    }

    const context = {
      channel: "whatsapp", // Non-widget uses fallback
    }

    const variables = PromptVariableBuilder.build(customer, workspace, {}, context)

    // When no name, use default
    expect(variables.customerName).toBe("Cliente")
  })

  it("should handle various 'Visitor' name formats for widget channel", () => {
    const testCases = [
      { name: "Visitor 12345", expected: "" }, // Widget channel = filtered
      { name: "Visitor -173737", expected: "" }, // Widget channel = filtered
      { name: "Visitor abc123", expected: "" }, // Widget channel = filtered
      { name: "visitor 123", expected: "" }, // Widget channel = ALL names filtered
      { name: "My Visitor Shop", expected: "" }, // Widget channel = ALL names filtered
      { name: "Andrea", expected: "" }, // Widget = empty (even real names)
    ]

    const workspace = {
      id: "workspace-id",
      name: "Test Shop",
    }

    const context = {
      channel: "widget", // 🚫 Widget channel filters ALL names (visitors are anonymous)
    }

    for (const testCase of testCases) {
      const customer = {
        id: "test-id",
        name: testCase.name,
        email: "test@test.com",
        phone: null,
        discount: 0,
        isActive: false,
        language: "ENG",
        company: null,
        push_notifications_consent: false,
        sales: null,
      }

      const variables = PromptVariableBuilder.build(customer, workspace, {}, context)
      expect(variables.customerName).toBe(testCase.expected)
    }
  })
})
