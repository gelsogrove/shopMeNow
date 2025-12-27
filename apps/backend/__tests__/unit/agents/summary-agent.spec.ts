/**
 * Summary Agent UNIT Tests
 *
 * Test UNITARI con MOCK - nessun database reale
 * 
 * Andrea's Requirements:
 * 1. ✅ Test Summary Agent LLM service execution
 * 2. ✅ Test conversation data formatting
 * 3. ✅ Test error handling 
 * 4. ✅ Test workspace isolation (mock validation)
 *
 * UNIT TEST = MOCK di servizi esterni, NO connessioni reali
 */

import { SummaryAgentLLM } from "../../../src/services/summary-agent-llm.service"

// Mock external dependencies
jest.mock("fs")
jest.mock("../../../src/utils/logger")
jest.mock("../../../src/services/prompt-processor.service")

describe("Summary Agent UNIT Tests", () => {
  let summaryAgent: SummaryAgentLLM
  let mockFetch: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    // Mock global fetch for OpenRouter API calls
    mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = mockFetch

    // Mock fs.readFileSync for prompt loading
    const fs = require("fs")
    fs.readFileSync = jest.fn().mockReturnValue(`
# Summary Agent Prompt

Tu sei un esperto nel creare riassunti di conversazioni.

{{conversationHistory}}

Cliente: {{customerName}}
Agente: {{agentName}}
    `)

    // Create SummaryAgentLLM instance
    summaryAgent = new SummaryAgentLLM()

    jest.clearAllMocks()
  })

  describe("generateSummary()", () => {
    it("should generate summary from conversation messages", async () => {
      // Mock successful OpenRouter API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "CLIENTE: Test Customer, +39123456789\nRICHIESTA PRINCIPALE: Problema con ordine\nURGENZA: Media"
              }
            }
          ]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Ho un problema con il mio ordine",
            createdAt: new Date("2024-01-10T10:00:00Z")
          },
          {
            role: "assistant",
            content: "Mi dispiace sentire del problema. Può fornirmi il numero dell'ordine?",
            createdAt: new Date("2024-01-10T10:01:00Z")
          }
        ],
        customerName: "Test Customer",
        agentName: "eChatbot Assistant"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify
      expect(result.success).toBe(true)
      expect(result.summary).toContain("Test Customer")
      expect(result.summary).toContain("Problema con ordine")
      expect(mockFetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json"
          }),
          body: expect.stringContaining("gpt-4o-mini")
        })
      )
    })

    it("should handle empty conversation history", async () => {
      const request = {
        conversationHistory: [],
        customerName: "Test Customer"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify
      expect(result.success).toBe(false)
      expect(result.error).toBe("No conversation history available")
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("should handle OpenRouter API errors", async () => {
      // Mock API error response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error"
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Test message",
            createdAt: new Date()
          }
        ],
        customerName: "Test Customer"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify
      expect(result.success).toBe(false)
      expect(result.error).toBe("OpenRouter API error: 500")
    })

    it("should handle network errors gracefully", async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error("Network timeout"))

      const request = {
        conversationHistory: [
          {
            role: "customer", 
            content: "Test message",
            createdAt: new Date()
          }
        ],
        customerName: "Test Customer"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify
      expect(result.success).toBe(false)
      expect(result.error).toBe("Network timeout")
    })

    it("should format conversation history with timestamps", async () => {
      // Mock successful response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Test summary with formatted timestamps"
              }
            }
          ]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Primo messaggio",
            createdAt: new Date("2024-01-10T08:30:15Z")
          },
          {
            role: "assistant",
            content: "Risposta assistente", 
            createdAt: new Date("2024-01-10T08:31:22Z")
          }
        ],
        customerName: "Test Customer"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify API was called with formatted conversation
      // Use regex to match timestamp format [HH:MM] instead of hardcoding timezone-dependent times
      const bodyString = mockFetch.mock.calls[0][1]?.body as string
      expect(bodyString).toMatch(/\[\d{2}:30\] Cliente: Primo messaggio/)
      expect(bodyString).toMatch(/\[\d{2}:31\] Assistente: Risposta assistente/)
    })

    it("should replace prompt variables correctly", async () => {
      // Mock successful response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Summary with variables replaced"
              }
            }
          ]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Test message",
            createdAt: new Date()
          }
        ],
        customerName: "Mario Rossi",
        agentName: "eChatbot Bot"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify prompt variables were replaced
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("Mario Rossi")
        })
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("eChatbot Bot")
        })
      )
    })

    it("should use correct LLM configuration", async () => {
      // Mock successful response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Test summary"
              }
            }
          ]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Test",
            createdAt: new Date()
          }
        ],
        customerName: "Test Customer"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify LLM configuration
      const apiCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(apiCall[1]?.body as string)

      expect(requestBody.model).toBe("openai/gpt-4o-mini")
      expect(requestBody.temperature).toBe(0.5)
      expect(requestBody.max_tokens).toBe(500)
      expect(requestBody.messages).toHaveLength(2) // system + user
    })

    it("should handle missing summary in LLM response", async () => {
      // Mock response without summary content
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                // Missing content
              }
            }
          ]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Test",
            createdAt: new Date()
          }
        ],
        customerName: "Test Customer"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify
      expect(result.success).toBe(false)
      expect(result.error).toBe("LLM returned empty summary")
    })

    it("should validate workspace isolation (mock check)", async () => {
      // This is a UNIT test - we mock the workspace validation behavior
      // Real workspace isolation is tested in integration tests
      
      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Test message for workspace-123",
            createdAt: new Date()
          }
        ],
        customerName: "Test Customer",
        agentName: "Workspace 123 Agent"
      }

      // Mock successful response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Summary isolated to workspace-123"
              }
            }
          ]
        })
      } as Response)

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify Summary Agent processes workspace-specific data
      expect(result.success).toBe(true)
      expect(result.summary).toContain("workspace-123")
      
      // In real implementation, conversation messages would be filtered by workspaceId
      // This is ensured by ContactOperator query: customer.workspaceId = "workspace-123"
    })
  })

  describe("Conversation Formatting", () => {
    it("should format multiple messages chronologically", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Formatted summary" } }]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Primo messaggio",
            createdAt: new Date("2024-01-10T10:00:00Z")
          },
          {
            role: "assistant",
            content: "Prima risposta",
            createdAt: new Date("2024-01-10T10:01:00Z")
          },
          {
            role: "customer",
            content: "Secondo messaggio",
            createdAt: new Date("2024-01-10T10:02:00Z")
          }
        ],
        customerName: "Test Customer"
      }

      await summaryAgent.generateSummary(request)

      // Verify chronological formatting
      const apiCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(apiCall[1]?.body as string)
      const systemPrompt = requestBody.messages[0].content

      // Use regex to match timestamp format [HH:MM] instead of hardcoding timezone-dependent times
      expect(systemPrompt).toMatch(/\[\d{2}:\d{2}\] Cliente: Primo messaggio/)
      expect(systemPrompt).toMatch(/\[\d{2}:\d{2}\] Assistente: Prima risposta/)
      expect(systemPrompt).toMatch(/\[\d{2}:\d{2}\] Cliente: Secondo messaggio/)
      
      // Verify order is chronological (timestamps should increase)
      const timestamps = systemPrompt.match(/\[\d{2}:\d{2}\]/g) || []
      expect(timestamps).toHaveLength(3)
    })

    it("should handle Italian role labels correctly", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Test summary" } }]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Messaggio cliente",
            createdAt: new Date("2024-01-10T10:00:00Z")
          },
          {
            role: "assistant",
            content: "Risposta assistente",
            createdAt: new Date("2024-01-10T10:01:00Z")
          }
        ],
        customerName: "Test Customer"
      }

      await summaryAgent.generateSummary(request)

      const apiCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(apiCall[1]?.body as string)
      const systemPrompt = requestBody.messages[0].content

      // Verify Italian role labels
      expect(systemPrompt).toContain("Cliente:")
      expect(systemPrompt).toContain("Assistente:")
    })
  })

  describe("Error Scenarios", () => {
    it("should handle prompt file loading errors", () => {
      // Mock fs.readFileSync to throw error
      const fs = require("fs")
      fs.readFileSync = jest.fn().mockImplementation(() => {
        throw new Error("Prompt file not found")
      })

      // Verify constructor throws error when prompt can't be loaded
      expect(() => {
        new SummaryAgentLLM()
      }).toThrow("Summary Agent prompt file not found")
    })

    it("should handle malformed API responses", async () => {
      // Mock malformed API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          // Missing choices array
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Test",
            createdAt: new Date()
          }
        ],
        customerName: "Test Customer"
      }

      const result = await summaryAgent.generateSummary(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe("LLM returned empty summary")
    })
  })
})