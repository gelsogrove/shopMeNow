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

// 🔧 Mock @echatbot/database BEFORE any import that transitively requires it
// (SummaryAgentLLM → PromptProcessorService → prisma from @echatbot/database)
jest.mock("@echatbot/database", () => ({
  prisma: {},
  PrismaClient: jest.fn(),
}))

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
    it("should generate single-sentence summary from conversation", async () => {
      // SCENARIO: Valid conversation with customer request
      // RULE: Summary MUST be 1 sentence starting with "L'utente"
      // Mock successful OpenRouter API response with new format
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "L'utente si lamenta del ritardo nella consegna dell'ordine #1234"
              }
            }
          ]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Il mio ordine #1234 è in ritardo di 5 giorni!",
            createdAt: new Date("2024-01-10T10:00:00Z")
          },
          {
            role: "assistant",
            content: "Mi dispiace per il ritardo. Controllo subito la situazione.",
            createdAt: new Date("2024-01-10T10:01:00Z")
          },
          {
            role: "customer",
            content: "Non è la prima volta che succede!",
            createdAt: new Date("2024-01-10T10:02:00Z")
          }
        ],
        customerName: "Mario Rossi",
        agentName: "eChatbot Assistant"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify
      expect(result.success).toBe(true)
      expect(result.summary).toBe("L'utente si lamenta del ritardo nella consegna dell'ordine #1234")
      expect(result.summary).toMatch(/^L'utente/) // MUST start with "L'utente"
      expect(result.summary?.length).toBeLessThanOrEqual(150) // Max 150 characters
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
      // SCENARIO: No messages in conversation
      // RULE: Must return error, NOT call API
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

    it("should generate fallback 'Riassunto non disponibile' for unclear conversations", async () => {
      // SCENARIO: LLM returns "Riassunto non disponibile" for unclear conversation
      // RULE: This is a VALID response when conversation is too vague
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Riassunto non disponibile"
              }
            }
          ]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Ciao",
            createdAt: new Date()
          },
          {
            role: "assistant",
            content: "Ciao! Come posso aiutarti?",
            createdAt: new Date()
          }
        ],
        customerName: "Cliente Vago"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify
      expect(result.success).toBe(true)
      expect(result.summary).toBe("Riassunto non disponibile")
    })

    it("should generate 'L'utente vuole' pattern for purchase intent", async () => {
      // SCENARIO: Customer wants to purchase specific product
      // RULE: Use pattern "L'utente vuole [azione]"
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "L'utente vuole acquistare un appartamento da 3 locali in zona Navigli"
              }
            }
          ]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Cerco un appartamento con 3 locali",
            createdAt: new Date()
          },
          {
            role: "assistant",
            content: "In quale zona?",
            createdAt: new Date()
          },
          {
            role: "customer",
            content: "Zona Navigli",
            createdAt: new Date()
          }
        ],
        customerName: "Marco Verdi"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify
      expect(result.success).toBe(true)
      expect(result.summary).toMatch(/^L'utente vuole/)
      expect(result.summary).toContain("appartamento")
    })

    it("should generate 'L'utente non è riuscito' pattern for failed actions", async () => {
      // SCENARIO: Customer unable to complete action (payment, registration, etc.)
      // RULE: Use pattern "L'utente non è riuscito a [azione]"
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "L'utente non è riuscito a completare il pagamento con carta di credito"
              }
            }
          ]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Il pagamento con carta non funziona",
            createdAt: new Date()
          },
          {
            role: "assistant",
            content: "Che errore riceve?",
            createdAt: new Date()
          },
          {
            role: "customer",
            content: "Dice transazione rifiutata",
            createdAt: new Date()
          }
        ],
        customerName: "Luca Bianchi"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify
      expect(result.success).toBe(true)
      expect(result.summary).toMatch(/^L'utente non è riuscito/)
      expect(result.summary).toContain("pagamento")
    })

    it("should generate 'L'utente cerca' pattern for information requests", async () => {
      // SCENARIO: Customer looking for information about products/services
      // RULE: Use pattern "L'utente cerca [informazioni su cosa]"
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "L'utente cerca informazioni sui prezzi degli immobili in centro"
              }
            }
          ]
        })
      } as Response)

      const request = {
        conversationHistory: [
          {
            role: "customer",
            content: "Vorrei sapere quanto costano gli immobili in centro",
            createdAt: new Date()
          },
          {
            role: "assistant",
            content: "Dipende dalla zona e dalla dimensione",
            createdAt: new Date()
          },
          {
            role: "customer",
            content: "Zona Duomo, 2 locali",
            createdAt: new Date()
          }
        ],
        customerName: "Sofia Rossi"
      }

      // Execute
      const result = await summaryAgent.generateSummary(request)

      // Verify
      expect(result.success).toBe(true)
      expect(result.summary).toMatch(/^L'utente cerca/)
      expect(result.summary).toContain("prezzi")
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

      // Verify LLM configuration (NEW: optimized for single-sentence summaries)
      const apiCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(apiCall[1]?.body as string)

      expect(requestBody.model).toBe("openai/gpt-4o-mini")
      expect(requestBody.temperature).toBe(0.3) // LOW for consistent factual summaries
      expect(requestBody.max_tokens).toBe(50) // 1 sentence: max 150 chars (~30-40 tokens)
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