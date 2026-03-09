/**
 * migrate-system-functions.ts
 *
 * One-time migration: seeds system calling functions for ALL existing workspaces
 * that don't have them yet. Safe to run multiple times (upsert logic).
 *
 * Usage:
 *   cd apps/backend
 *   npx ts-node scripts/migrate-system-functions.ts
 */

import { PrismaClient } from "@echatbot/database"

const prisma = new PrismaClient()

function buildSystemFunctions(workspaceId: string, isEcommerce: boolean) {
  const functions: any[] = []

  if (isEcommerce) {
    functions.push(
      {
        workspaceId,
        functionName: "productSearchAgent",
        description:
          "Delegate to Product Search Agent for product catalog browsing, search, filters. Use when customer asks about products, prices, categories, certifications.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "Customer's product search query" } },
          required: ["query"],
        },
        isSystemFunction: true,
        executionType: "DELEGATE_TO_AGENT",
        isActive: true,
      },
      {
        workspaceId,
        functionName: "cartManagementAgent",
        description:
          "Delegate to Cart Management Agent for add/remove products, view cart, modify quantities. Use when customer wants to add to cart or modify cart contents.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "Cart-related request" } },
          required: ["query"],
        },
        isSystemFunction: true,
        executionType: "DELEGATE_TO_AGENT",
        isActive: true,
      },
      {
        workspaceId,
        functionName: "orderTrackingAgent",
        description:
          "Delegate to Order Tracking Agent for order history, tracking, checkout confirmation. Use for orders, delivery status, checkout.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "Order-related question" } },
          required: ["query"],
        },
        isSystemFunction: true,
        executionType: "DELEGATE_TO_AGENT",
        isActive: true,
      }
    )
  }

  functions.push(
    {
      workspaceId,
      functionName: "customerSupportAgent",
      description:
        "Delegate to Customer Support Agent for complaints, issues, human operator contact. Use when customer is frustrated or has problems. NOT for notification management.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Support request" } },
        required: ["query"],
      },
      isSystemFunction: true,
      executionType: "DELEGATE_TO_AGENT",
      isActive: true,
    },
    {
      workspaceId,
      functionName: "profileManagementAgent",
      description:
        "Delegate to Profile Management Agent for email updates, notification preferences, profile data changes. Use for notification subscribe/unsubscribe, email change.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Profile-related request" } },
        required: ["query"],
      },
      isSystemFunction: true,
      executionType: "DELEGATE_TO_AGENT",
      isActive: true,
    },
    {
      workspaceId,
      functionName: "manageNotifications",
      description: "Manage push notification preferences (subscribe/unsubscribe).",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["subscribe", "unsubscribe"], description: "Action to perform" },
        },
        required: ["action"],
      },
      isSystemFunction: true,
      executionType: "INTERNAL",
      isActive: true,
    }
  )

  return functions
}

async function main() {
  console.log("🚀 Starting system functions migration...")

  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true, sellsProductsAndServices: true },
  })

  console.log(`📋 Found ${workspaces.length} workspaces`)

  let migrated = 0
  let skipped = 0

  for (const workspace of workspaces) {
    // Check how many system functions already exist
    const existing = await prisma.workspaceCallingFunction.count({
      where: { workspaceId: workspace.id, isSystemFunction: true },
    })

    const isEcommerce = workspace.sellsProductsAndServices ?? true
    const expected = isEcommerce ? 6 : 3

    if (existing >= expected) {
      console.log(`  ⏭️  ${workspace.name} (${workspace.id}) — already has ${existing} system functions, skipping`)
      skipped++
      continue
    }

    const functions = buildSystemFunctions(workspace.id, isEcommerce)

    // Upsert each function (safe to re-run)
    for (const fn of functions) {
      await prisma.workspaceCallingFunction.upsert({
        where: {
          workspaceId_functionName: {
            workspaceId: workspace.id,
            functionName: fn.functionName,
          },
        },
        update: {
          description: fn.description,
          parameters: fn.parameters,
          isSystemFunction: fn.isSystemFunction,
          executionType: fn.executionType,
          isActive: fn.isActive,
        },
        create: fn,
      })
    }

    console.log(`  ✅ ${workspace.name} (${workspace.id}) — seeded ${functions.length} system functions (ecommerce: ${isEcommerce})`)
    migrated++
  }

  console.log(`\n✅ Migration complete: ${migrated} workspaces updated, ${skipped} already up to date`)
}

main()
  .catch((error) => {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
