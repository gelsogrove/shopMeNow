import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"

import { runTests } from "./tools/run_tests"
import { checkTypes } from "./tools/check_types"
import { readLogs } from "./tools/read_logs"
import { startSession, sendMessage, endSession } from "./tools/run_scenario"

const server = new Server(
  { name: "echatbot-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
)

// ─── Tool Definitions ────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_tests",
      description:
        "Run backend unit tests. Returns full Jest output including passed/failed assertions. Use after making code changes to verify correctness.",
      inputSchema: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description:
              "Optional test file pattern to filter (e.g. 'appointment', 'cart', 'order'). Omit to run all tests.",
          },
        },
      },
    },
    {
      name: "check_types",
      description:
        "Run TypeScript compiler check on backend code. Returns all type errors. Use before/after code changes.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "read_logs",
      description:
        "Read the latest backend log file. Useful to check runtime errors after testing a feature.",
      inputSchema: {
        type: "object",
        properties: {
          lines: {
            type: "number",
            description: "Number of lines to read from end of log (default: 100)",
          },
        },
      },
    },
    {
      name: "start_session",
      description: `Start a new interactive simulation session against eChatbot HQ Sandbox on Heroku.
Creates a test customer and chat session. Returns a sessionId to use with send_message.
Use this before starting a conversation with Andrea where he controls the user replies.`,
      inputSchema: {
        type: "object",
        required: ["customerName", "customerPhone"],
        properties: {
          customerName: {
            type: "string",
            description: "Test customer name, always prefix with 'test_' (e.g. 'test_andrea')",
          },
          customerPhone: {
            type: "string",
            description: "Fake phone number (e.g. '+39000000001')",
          },
          isRegistered: {
            type: "boolean",
            description: "Whether the customer is registered (default: false)",
          },
          workspaceId: {
            type: "string",
            description: "Workspace to use (default: echatbot-hq-support)",
          },
          overrides: {
            type: "object",
            description: "Workspace settings to temporarily override for this scenario",
            properties: {
              humanSupportEnabled: { type: "boolean" },
              hasSalesAgents: { type: "boolean" },
              sellsProductsAndServices: { type: "boolean" },
              toneOfVoice: { type: "string", enum: ["casual", "formal", "professional"] },
              channelStatus: { type: "boolean" },
              debugMode: { type: "boolean" },
            },
          },
        },
      },
    },
    {
      name: "send_message",
      description: `Send a single message in an active simulation session and get the bot response.
Use sessionId returned by start_session. Show the bot response to Andrea and wait for his next message.`,
      inputSchema: {
        type: "object",
        required: ["sessionId", "customerId", "workspaceId", "message"],
        properties: {
          sessionId: { type: "string", description: "Session ID from start_session" },
          customerId: { type: "string", description: "Customer ID from start_session" },
          workspaceId: { type: "string", description: "Workspace ID" },
          message: { type: "string", description: "The user message to send" },
        },
      },
    },
    {
      name: "end_session",
      description: "End a simulation session and clean up the test customer.",
      inputSchema: {
        type: "object",
        required: ["customerId", "customerPhone", "workspaceId"],
        properties: {
          customerId: { type: "string" },
          customerPhone: { type: "string" },
          workspaceId: { type: "string" },
        },
      },
    },
  ],
}))

// ─── Tool Handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case "run_tests": {
        const { pattern } = args as { pattern?: string }
        const output = await runTests(pattern)
        return { content: [{ type: "text", text: output }] }
      }

      case "check_types": {
        const output = await checkTypes()
        return { content: [{ type: "text", text: output }] }
      }

      case "read_logs": {
        const { lines } = args as { lines?: number }
        const output = await readLogs(lines)
        return { content: [{ type: "text", text: output }] }
      }

      case "start_session": {
        const result = await startSession(args as any)
        const text = [
          `✅ Session started`,
          `sessionId:  ${result.sessionId}`,
          `customerId: ${result.customerId}`,
          `workspace:  ${result.workspaceId}`,
          `customer:   ${result.customerName} (${result.customerPhone})`,
          `registered: ${result.isRegistered}`,
          ``,
          `Ready. Send the first message with send_message.`,
        ].join("\n")
        return { content: [{ type: "text", text }] }
      }

      case "send_message": {
        const { sessionId, customerId, workspaceId, message } = args as any
        const result = await sendMessage({ sessionId, customerId, workspaceId, message })
        const text = [
          `👤 User: ${message}`,
          ``,
          `🤖 Bot: ${result.response}`,
          ``,
          `📎 Agent: ${result.agentUsed || "unknown"} | Intent: ${result.intent || "-"}`,
        ].join("\n")
        return { content: [{ type: "text", text }] }
      }

      case "end_session": {
        const { customerId, customerPhone, workspaceId } = args as any
        await endSession({ customerId, customerPhone, workspaceId })
        return { content: [{ type: "text", text: `✅ Session ended. Test customer deleted.` }] }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `ERROR: ${error.message}` }],
      isError: true,
    }
  }
})

// ─── Start Server ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("eChatbot MCP Server running on stdio")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
