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
import { runScenario } from "./tools/run_scenario"

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
      name: "run_scenario",
      description: `Run a multi-turn conversation scenario against the eChatbot HQ Sandbox on Heroku.
Use this to test specific customer behaviors without touching real data.
Workspace settings are temporarily overridden and restored after the test.
Test customer is created and deleted automatically.

Example: Test a new unregistered customer with reminder=true and casual tone.`,
      inputSchema: {
        type: "object",
        required: ["customerName", "customerPhone", "messages"],
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
          messages: {
            type: "array",
            items: { type: "string" },
            description: "Ordered list of user messages to send in the conversation",
          },
          workspaceId: {
            type: "string",
            description: "Workspace to use (default: echatbot-hq-support sandbox)",
          },
          overrides: {
            type: "object",
            description: "Workspace settings to temporarily override for this scenario",
            properties: {
              reminderEnabled: { type: "boolean" },
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

      case "run_scenario": {
        const config = args as any
        const result = await runScenario(config)

        // Format output as readable conversation log
        const lines: string[] = [
          "═══════════════════════════════════════",
          result.summary,
          "═══════════════════════════════════════",
          "",
          "CONVERSATION LOG:",
          "",
        ]

        for (let i = 0; i < result.conversation.length; i++) {
          const turn = result.conversation[i]
          lines.push(`[Turn ${i + 1}]`)
          lines.push(`  👤 User:    ${turn.userMessage}`)
          if (turn.error) {
            lines.push(`  ❌ Error:   ${turn.error}`)
          } else {
            lines.push(`  🤖 Bot:     ${turn.botResponse}`)
            if (turn.agentUsed) {
              lines.push(`  📎 Agent:   ${turn.agentUsed}`)
            }
          }
          lines.push("")
        }

        return { content: [{ type: "text", text: lines.join("\n") }] }
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
