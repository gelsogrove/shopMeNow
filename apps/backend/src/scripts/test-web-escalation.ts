import { prisma } from "@echatbot/database";
import { contactOperator } from "../domain/calling-functions/contactOperator";
import logger from "../utils/logger";

async function testWebChatEscalation() {
    console.log("🚀 Starting Web Chat Escalation Test...");

    // 1. Find a test workspace and customer
    const workspace = await prisma.workspace.findFirst({
        where: { deletedAt: null, sellsProductsAndServices: true },
        select: { id: true, name: true }
    });

    if (!workspace) {
        console.error("❌ No active workspace found");
        return;
    }

    const customer = await prisma.customers.findFirst({
        where: { workspaceId: workspace.id },
        select: { id: true, name: true, phone: true }
    });

    if (!customer) {
        console.error("❌ No customer found in workspace", workspace.id);
        return;
    }

    console.log(`📝 Testing with Workspace: ${workspace.name} (${workspace.id})`);
    console.log(`📝 Testing with Customer: ${customer.name} (${customer.id}), Phone: ${customer.phone || "MISSING"}`);

    // 2. Mock a web chat request (no phoneNumber, just customerId)
    console.log("\n📞 Calling contactOperator with customerId and phoneNumber (web visitor)...");
    const result = await contactOperator({
        workspaceId: workspace.id,
        customerId: customer.id,
        phoneNumber: customer.phone || "MISSING_PHONE",
        reason: "Test escalation from automated script"
    });

    console.log("\n📊 Result:", JSON.stringify(result, null, 2));

    if (result.success) {
        console.log("\n✅ Test Passed: Escalation triggered successfully for web visitor.");
        console.log(`✅ Message structure OK: ${result.message.substring(0, 100)}...`);
    } else {
        console.error("\n❌ Test Failed:", result.error || "Unknown error");
    }

    await prisma.$disconnect();
}

testWebChatEscalation().catch(err => {
    console.error("💥 Test crashed:", err);
    process.exit(1);
});
