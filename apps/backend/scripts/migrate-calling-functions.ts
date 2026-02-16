import { prisma } from "@echatbot/database"

async function seedSystemFunctions(
    tx: any,
    workspaceId: string,
    isEcommerce: boolean
) {
    const functions: any[] = [];

    if (isEcommerce) {
        functions.push(
            {
                functionName: "productSearchAgent",
                description: "Delegate to Product Search Agent for product catalog browsing, search, filters. Use when customer asks about products, prices, categories, certifications.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Customer's product search query" }
                    },
                    required: ["query"]
                },
                isSystemFunction: true,
                executionType: "DELEGATE_TO_AGENT",
                isActive: true
            },
            {
                functionName: "cartManagementAgent",
                description: "Delegate to Cart Management Agent for add/remove products, view cart, modify quantities. Use when customer wants to add to cart or modify cart contents.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Cart-related request" }
                    },
                    required: ["query"]
                },
                isSystemFunction: true,
                executionType: "DELEGATE_TO_AGENT",
                isActive: true
            },
            {
                functionName: "orderTrackingAgent",
                description: "Delegate to Order Tracking Agent for order history, tracking, checkout confirmation. Use for orders, delivery status, checkout.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Order-related question" }
                    },
                    required: ["query"]
                },
                isSystemFunction: true,
                executionType: "DELEGATE_TO_AGENT",
                isActive: true
            }
        );
    }

    functions.push(
        {
            functionName: "customerSupportAgent",
            description: "Delegate to Customer Support Agent for complaints, issues, human operator contact. Use when customer is frustrated or has problems. NOT for notification management.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Support request" }
                },
                required: ["query"]
            },
            isSystemFunction: true,
            executionType: "DELEGATE_TO_AGENT",
            isActive: true
        },
        {
            functionName: "profileManagementAgent",
            description: "Delegate to Profile Management Agent for email updates, notification preferences, profile data changes. Use for notification subscribe/unsubscribe, email change.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Profile-related request" }
                },
                required: ["query"]
            },
            isSystemFunction: true,
            executionType: "DELEGATE_TO_AGENT",
            isActive: true
        },
        {
            functionName: "manageNotifications",
            description: "Manage push notification preferences (subscribe/unsubscribe).",
            parameters: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["subscribe", "unsubscribe"],
                        description: "Action to perform"
                    }
                },
                required: ["action"]
            },
            isSystemFunction: true,
            executionType: "INTERNAL",
            isActive: true
        }
    );

    await tx.workspaceCallingFunction.createMany({
        data: functions.map(fn => ({ ...fn, workspaceId }))
    });
}

async function migrateExistingWorkspaces() {
    console.log("🚀 Starting calling functions migration for existing workspaces...")

    try {
        const workspaces = await prisma.workspace.findMany({
            where: {
                deletedAt: null
            },
            select: {
                id: true,
                name: true,
                sellsProductsAndServices: true
            }
        })

        console.log(`📊 Found ${workspaces.length} active workspaces`)

        for (const workspace of workspaces) {
            const existingCount = await prisma.workspaceCallingFunction.count({
                where: { workspaceId: workspace.id }
            })

            if (existingCount > 0) {
                console.log(`⏩ Skipping workspace ${workspace.id} (${workspace.name}) - already has functions`)
                continue
            }

            console.log(`🔧 Seeding system functions for workspace ${workspace.id} (${workspace.name})...`)
            await seedSystemFunctions(prisma, workspace.id, workspace.sellsProductsAndServices)
            console.log(`✅ Seeded workspace ${workspace.id}`)
        }

        console.log("\n🎉 Migration complete!")
    } catch (error) {
        console.error("❌ Migration failed:", error)
    } finally {
        await prisma.$disconnect()
    }
}

migrateExistingWorkspaces()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
