import { prisma } from "@echatbot/database";
import { v4 as uuidv4 } from "uuid";

async function setupTestData() {
    console.log("🚀 Setting up test data...");

    // 1. Create a Test User (Admin)
    const user = await prisma.user.upsert({
        where: { email: "test@example.com" },
        update: { status: "ACTIVE", isPlatformAdmin: true },
        create: {
            email: "test@example.com",
            passwordHash: "password123",
            firstName: "Test",
            lastName: "Admin",
            isPlatformAdmin: true,
            status: "ACTIVE"
        }
    });
    console.log(`✅ User created: ${user.email}`);

    // 2. Create a Workspace
    const workspace = await prisma.workspace.upsert({
        where: { slug: "test-shop" },
        update: { hasHumanSupport: true, operatorContactMethod: "email" },
        create: {
            name: "Test Shop",
            slug: "test-shop",
            url: "test-shop.echatbot.ai",
            ownerId: user.id,
            hasHumanSupport: true,
            operatorContactMethod: "email",
            operatorEmail: "operator@example.com",
            humanSupportInstructions: "Hello {{nameUser}}, an operator will be with you shortly!",
            sellsProductsAndServices: true
        }
    });
    console.log(`✅ Workspace created: ${workspace.name} (${workspace.id})`);

    // 3. Create a Sales Agent
    const agent = await prisma.sales.upsert({
        where: { id: "test-agent-id" }, // Static for testing
        update: { isActive: true },
        create: {
            id: "test-agent-id",
            workspaceId: workspace.id,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            phone: "+391234567890",
            isActive: true
        }
    });
    console.log(`✅ Sales Agent created: ${agent.firstName} ${agent.lastName}`);

    // 4. Create a Customer
    const customer = await prisma.customers.upsert({
        where: { id: "test-customer-id" }, // Static for testing
        update: { isActive: true, registrationStatus: "ACTIVE", activeChatbot: true },
        create: {
            id: "test-customer-id",
            workspaceId: workspace.id,
            name: "Mario Rossi",
            email: "mario@example.com",
            phone: "+390987654321",
            salesId: agent.id,
            isActive: true,
            registrationStatus: "ACTIVE",
            activeChatbot: true
        }
    });
    console.log(`✅ Customer created: ${customer.name} (${customer.id})`);

    // 5. Create a Chat Session for the customer
    const session = await prisma.chatSession.upsert({
        where: { id: "test-session-id" }, // Static for testing
        update: { status: "active" },
        create: {
            id: "test-session-id",
            customerId: customer.id,
            workspaceId: workspace.id,
            status: "active",
            channel: "widget"
        }
    });
    console.log(`✅ Chat Session created: ${session.id}`);

    // 6. Create initial messages
    // Use createMany but check if they exist first (simplified: just delete and recreate)
    await prisma.conversationMessage.deleteMany({
        where: { conversationId: session.id }
    });

    await prisma.conversationMessage.createMany({
        data: [
            {
                conversationId: session.id,
                workspaceId: workspace.id,
                customerId: customer.id,
                role: "user",
                content: "Hello, I need help with my order."
            },
            {
                conversationId: session.id,
                workspaceId: workspace.id,
                customerId: customer.id,
                role: "assistant",
                content: "Sure, I can help with that. What is your order number?"
            }
        ]
    });
    console.log("✅ Initial messages created.");

    console.log("\n✨ Test data setup complete!");
    console.log(`Workspace ID: ${workspace.id}`);
    console.log(`Customer ID: ${customer.id}`);
}

setupTestData()
    .catch(err => {
        console.error("❌ Setup failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
