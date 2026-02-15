
import { LLMRouterService } from "../src/services/llm-router.service";
import { prisma } from '@echatbot/database';
import logger from "../src/utils/logger";

async function simulate() {
    console.log("🚀 Starting WhatsApp User Simulation...");

    try {
        // 1. Get Workspace and Customer
        const workspace = await prisma.workspace.findUnique({
            where: { id: "bellitalia-vip-ecommerce" }
        });

        if (!workspace) {
            throw new Error("Target workspace 'bellitalia-vip-ecommerce' not found. Did you run the seed?");
        }

        const customer = await prisma.customers.findFirst({
            where: { workspaceId: workspace.id, isActive: true }
        });

        if (!customer) {
            throw new Error("No active customer found in workpace.");
        }

        console.log(`📍 Testing with Workspace: ${workspace.name} (${workspace.id})`);
        console.log(`📍 Testing with Customer: ${customer.name} (${customer.id})`);

        const router = new LLMRouterService(prisma);
        const conversationId = `sim-${Date.now()}`;

        const messages = [
            "voglio vedere il profilo",
            "quanto costa?",
            "che piani avete",
            "voglio parlare con un operatore?"
        ];

        for (const msg of messages) {
            console.log(`\n--- Sending Message: "${msg}" ---`);

            const startTime = Date.now();
            const result = await router.routeMessage({
                workspaceId: workspace.id,
                customerId: customer.id,
                message: msg,
                conversationId,
                messageId: `msg-${Date.now()}`,
                channel: "widget",
                customerName: customer.name
            });

            const duration = Date.now() - startTime;

            console.log(`✅ Response (${duration}ms):`);
            console.log(`🤖 Agent: ${result.agentUsed}`);
            console.log(`📝 Message: ${result.response}`);

            if (result.debugInfo) {
                console.log(`🔍 Debug Steps: ${result.debugInfo.steps.map(s => s.agent).join(" -> ")}`);
            }
        }

        console.log("\n✨ Simulation complete!");
    } catch (error) {
        console.error("❌ Simulation failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

simulate();
