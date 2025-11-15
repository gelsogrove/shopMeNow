#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import axios from "axios"
import dotenv from "dotenv"

// Load environment variables (MCP is now under backend/)
dotenv.config({ path: "../.env" })

class ShopMeMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "shopme-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    this.setupToolHandlers()
    this.setupErrorHandling()
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "test_chat",
            description:
              "Test ShopMe WhatsApp chatbot with specific user and message",
            inputSchema: {
              type: "object",
              properties: {
                user: {
                  type: "string",
                  description:
                    'User name (e.g., "Mario Rossi", "John Smith", "Maria Garcia", "João Silva")',
                },
                message: {
                  type: "string",
                  description: "Message to send to the chatbot",
                },
                log: {
                  type: "boolean",
                  description: "Enable detailed logging",
                  default: true,
                },
                exitFirstMessage: {
                  type: "boolean",
                  description: "Exit after first message response",
                  default: true,
                },
              },
              required: ["user", "message"],
            },
          },
          {
            name: "seed_database",
            description: "Seed the ShopMe database with initial data",
            inputSchema: {
              type: "object",
              properties: {
                log: {
                  type: "boolean",
                  description: "Enable detailed logging",
                  default: true,
                },
              },
            },
          },
          {
            name: "check_health",
            description: "Check ShopMe backend health status",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "debug_function",
            description: "Debug specific ShopMe function with test data",
            inputSchema: {
              type: "object",
              properties: {
                functionName: {
                  type: "string",
                  description:
                    'Function name to debug (e.g., "ragSearch", "add_to_cart", "confirmOrderFromConversation")',
                },
                testData: {
                  type: "object",
                  description: "Test data to send to the function",
                },
              },
              required: ["functionName"],
            },
          },
        ],
      }
    })

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case "test_chat":
            return await this.testChat(args)
          case "seed_database":
            return await this.seedDatabase(args)
          case "check_health":
            return await this.checkHealth(args)
          case "debug_function":
            return await this.debugFunction(args)
          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing ${name}: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    })
  }

  async testChat(args) {
    const { user, message, log = true, exitFirstMessage = true } = args

    if (!user || !message) {
      throw new Error("User and message are required")
    }

    // User mapping to phone numbers
    const userPhones = {
      "Mario Rossi": "+390212345678",
      "John Smith": "+44123456789",
      "Maria Garcia": "+34666777888",
      "João Silva": "+351912345678",
    }

    const phoneNumber = userPhones[user]
    if (!phoneNumber) {
      throw new Error(
        `Unknown user: ${user}. Available users: ${Object.keys(userPhones).join(", ")}`
      )
    }

    const webhookUrl = "http://localhost:3001/api/whatsapp/webhook"

    // Use frontend format instead of WhatsApp format for better compatibility
    const payload = {
      message: message,
      phoneNumber: phoneNumber,
      workspaceId: "cm9hjgq9v00014qk8fsdy4ujv",
    }

    if (log) {
      console.log(`🧪 Testing chat with user: ${user}`)
      console.log(`📝 Message: ${message}`)
      console.log(`🔗 Webhook URL: ${webhookUrl}`)
    }

    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      })

      const result = {
        content: [
          {
            type: "text",
            text: `✅ Chat test completed successfully!\n\n**User:** ${user}\n**Message:** ${message}\n**Response Status:** ${response.status}\n**Response Data:** ${JSON.stringify(response.data, null, 2)}`,
          },
        ],
      }

      if (log) {
        console.log("✅ Chat test response:", response.data)
      }

      return result
    } catch (error) {
      throw new Error(`Chat test failed: ${error.message}`)
    }
  }

  async seedDatabase(args) {
    const { log = true } = args

    if (log) {
      console.log("🌱 Starting database seed...")
    }

    try {
      // Run seed command
      const { exec } = await import("child_process")
      const { promisify } = await import("util")
      const execAsync = promisify(exec)

      const { stdout, stderr } = await execAsync("cd ../ && npm run seed")

      return {
        content: [
          {
            type: "text",
            text: `✅ Database seeded successfully!\n\n**Output:**\n${stdout}\n\n**Errors:**\n${stderr || "None"}`,
          },
        ],
      }
    } catch (error) {
      throw new Error(`Database seed failed: ${error.message}`)
    }
  }

  async checkHealth(args) {
    try {
      const response = await axios.get("http://localhost:3001/api/health", {
        timeout: 5000,
      })

      return {
        content: [
          {
            type: "text",
            text: `✅ ShopMe backend is healthy!\n\n**Status:** ${response.status}\n**Response:** ${JSON.stringify(response.data, null, 2)}`,
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ ShopMe backend health check failed: ${error.message}`,
          },
        ],
        isError: true,
      }
    }
  }

  async debugFunction(args) {
    const { functionName, testData = {} } = args

    if (!functionName) {
      throw new Error("Function name is required")
    }

    // Create a test webhook call with debug data
    const webhookUrl = "http://localhost:3001/api/whatsapp/webhook"
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "debug-user",
                    text: { body: `DEBUG:${functionName}` },
                  },
                ],
              },
            },
          ],
        },
      ],
      debug: {
        functionName,
        testData,
      },
    }

    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      })

      return {
        content: [
          {
            type: "text",
            text: `🔧 Function debug completed!\n\n**Function:** ${functionName}\n**Test Data:** ${JSON.stringify(testData, null, 2)}\n**Response:** ${JSON.stringify(response.data, null, 2)}`,
          },
        ],
      }
    } catch (error) {
      throw new Error(`Function debug failed: ${error.message}`)
    }
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error)
    }

    process.on("SIGINT", async () => {
      await this.server.close()
      process.exit(0)
    })
  }

  async run() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error("ShopMe MCP Server running on stdio")
  }
}

// Start the server
const server = new ShopMeMCPServer()
server.run().catch(console.error)
