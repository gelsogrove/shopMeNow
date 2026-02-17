import { prisma } from '../config/database'
import logger from '../utils/logger';
import { whatsappChannelQueueJob } from "../jobs/whatsapp-channel-queue.job";

async function testWhatsAppBypass() {
    console.log("🚀 Starting WhatsApp Security Bypass Test...");

    // 1. Find a test workspace
    const workspace = await prisma.workspace.findFirst({
        where: { slug: "test-shop" },
        select: { id: true, name: true }
    });

    if (!workspace) {
        console.error("❌ No active workspace found (run setup-test-data.ts first)");
        return;
    }

    const customer = await prisma.customers.findFirst({
        where: { workspaceId: workspace.id }
    });

    if (!customer) {
        console.error("❌ No test customer found (run setup-test-data.ts first)");
        return;
    }

    // 2. Create a "poisoned" message that SHOULD be blocked if security check is performed
    const unsafeContent = "🚨 TEST NOTIFICATION: Please contact support at support@example.com immediately. Sensitive data: 123-456-789.";

    console.log(`📝 Creating test message for Workspace: ${workspace.name} (${workspace.id})`);

    const queueItem = await prisma.whatsAppQueue.create({
        data: {
            workspaceId: workspace.id,
            customerId: customer.id,
            phoneNumber: "1234567890",
            messageContent: unsafeContent,
            status: "pending",
            channel: "whatsapp",
            skipSecurityCheck: true // 🔐 THIS IS THE KEY FLAG
        }
    });

    console.log(`✅ Queue item created with ID: ${queueItem.id}, skipSecurityCheck=true`);

    // 3. Trigger a manual cycle of the job
    console.log("\n🔄 Running whatsappChannelQueueJob cycle...");

    // Note: The job will process all pending messages (up to 10)
    await whatsappChannelQueueJob();

    // 4. Check the status of our message
    const updatedItem = await prisma.whatsAppQueue.findUnique({
        where: { id: queueItem.id }
    });

    console.log("\n📊 Updated Queue Item:", JSON.stringify(updatedItem, null, 2));

    if (updatedItem?.status === "sent") {
        console.log("\n✅ Test Passed: Message was SENT despite 'unsafe' content (Security Bypassed).");
    } else if (updatedItem?.status === "blocked") {
        console.error("\n❌ Test Failed: Message was BLOCKED (Security NOT bypassed). Reason:", updatedItem.errorMessage);
    } else {
        console.log(`\nℹ️ Message status is ${updatedItem?.status}. If 'error', check provider configuration.`);
    }

    // Clean up test message
    await prisma.whatsAppQueue.delete({ where: { id: queueItem.id } });

    await prisma.$disconnect();
}

testWhatsAppBypass().catch(err => {
    console.error("💥 Test crashed:", err);
    process.exit(1);
});
