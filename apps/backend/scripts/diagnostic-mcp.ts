
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Set environment before imports that might initialize prisma
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Use require for backend services to avoid ESM/CJS mismatch issues in scripts
const { LLMRouterService } = require("../src/services/llm-router.service");
const { prisma } = require('@echatbot/database');

const server = new Server(
    {
        name: "echatbot-diagnostics",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "test_routing",
                description: "Simulate LLM routing for a user message against production logic",
                inputSchema: {
                    type: "object",
                    properties: {
                        workspaceId: { type: "string" },
                        customerId: { type: "string" },
                        message: { type: "string" },
                        sessionId: { type: "string", description: "Optional session ID" }
                    },
                    required: ["workspaceId", "customerId", "message"],
                },
            },
            {
                name: "get_workspace_diagnostics",
                description: "Get detailed workspace configuration, agents, and status",
                inputSchema: {
                    type: "object",
                    properties: {
                        workspaceId: { type: "string" },
                    },
                    required: ["workspaceId"],
                },
            },
            {
                name: "find_test_customer",
                description: "Find an active workspace and customer for testing purposes",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Search by name or email" }
                    },
                },
            }
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const argsAny = args as any;

    try {
        if (name === "test_routing") {
            const router = new LLMRouterService(prisma);
            const result = await router.routeMessage({
                workspaceId: argsAny.workspaceId,
                customerId: argsAny.customerId,
                message: argsAny.message,
                conversationId: `mcp-debug-${Date.now()}`,
                messageId: `mcp-msg-${Date.now()}`,
            });
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }

        if (name === "get_workspace_diagnostics") {
            const workspace = await prisma.workspace.findUnique({
                where: { id: argsAny.workspaceId },
                include: {
                    agentConfigs: {
                        where: { deletedAt: null }
                    },
                }
            });

            if (!workspace) throw new Error("Workspace not found");

            return {
                content: [{
                    type: "text", text: JSON.stringify({
                        id: workspace.id,
                        name: workspace.name,
                        sellsProductsAndServices: workspace.sellsProductsAndServices,
                        defaultLanguage: workspace.defaultLanguage,
                        agents: workspace.agentConfigs.map((a: any) => ({
                            agentId: a.agentId,
                            isActive: a.isActive,
                            hasPrompt: !!a.systemPrompt,
                            promptLength: a.systemPrompt?.length || 0
                        }))
                    }, null, 2)
                }],
            };
        }

        if (name === "find_test_customer") {
            const workspace = await prisma.workspace.findFirst({
                where: { deletedAt: null, id: argsAny.query ? { contains: argsAny.query } : undefined },
                orderBy: { createdAt: 'desc' }
            });

            if (!workspace) throw new Error("No matching workspace found");

            const customer = await prisma.customers.findFirst({
                where: { workspaceId: workspace?.id, isActive: true },
            });

            return {
                content: [{
                    type: "text", text: JSON.stringify({
                        workspace: { id: workspace.id, name: workspace.name },
                        customer: customer ? { id: customer.id, name: customer.name, email: customer.email } : null
                    }, null, 2)
                }],
            };
        }

        throw new Error(`Unknown tool: ${name}`);
    } catch (error: any) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🚀 eChatbot Diagnostic MCP server running");
}

main().catch((error) => {
    console.error("💥 Server error:", error);
    process.exit(1);
});
