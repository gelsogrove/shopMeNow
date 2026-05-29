// One-shot wipe of all chat/customer/playground/billing/queue/campaign data,
// across ALL workspaces. Andrea confirmed on 2026-05-29:
//   1) Plan / Billing / BillingTransaction / Usage / MonthlyInvoice → drop
//   2) WhatsAppQueue + WhatsappWebhookEvent → drop
//   3) PushCampaign + recipients → drop
//   4) PlaygroundTodo + comments → drop
//   5) No real customers in prod
//
// Workspaces, users, products, services, faqs, offers, settings, prompts,
// agent configs, etc. are left intact.

import { prisma } from "@echatbot/database"

async function main() {
  const before = await getCounts()
  console.log("\n=== BEFORE ===")
  printCounts(before)

  // Order matters because of foreign keys.
  await prisma.$transaction(async (tx) => {
    // (3) Push campaigns + recipients
    await tx.pushCampaignRecipient.deleteMany({})
    await tx.pushCampaign.deleteMany({})

    // (2) WhatsApp queue + raw webhook events
    await tx.whatsAppQueue.deleteMany({})
    await tx.whatsappWebhookEvent.deleteMany({})

    // (4) Playground kanban
    await tx.playgroundComment.deleteMany({})
    await tx.playgroundTodo.deleteMany({})

    // Chat history (both source-of-truth tables + archive)
    await tx.conversationMessage.deleteMany({})
    await tx.message.deleteMany({})
    await tx.messageArchive.deleteMany({})
    await tx.chatSession.deleteMany({})
    await tx.agentConversationLog.deleteMany({})
    await tx.searchConversations.deleteMany({})

    // Carts + orders (depend on customers)
    await tx.cartItems.deleteMany({})
    await tx.carts.deleteMany({})
    await tx.invoiceCreditNote.deleteMany({})
    await tx.creditNote.deleteMany({})
    await tx.orderItems.deleteMany({})
    await tx.orders.deleteMany({})

    // Appointments (depend on customers)
    await tx.pendingAppointment.deleteMany({})
    await tx.appointmentGdprLog.deleteMany({})
    await tx.reminderLock.deleteMany({})
    await tx.lateCancellationAttempt.deleteMany({})
    await tx.appointment.deleteMany({})

    // Customer-scoped audit/auth
    await tx.registrationToken.deleteMany({})
    await tx.registrationAttempts.deleteMany({})
    await tx.secureToken.deleteMany({})
    await tx.shortUrls.deleteMany({})

    // (1) Billing storico
    await tx.invoiceAdjustment.deleteMany({})
    await tx.monthlyInvoice.deleteMany({})
    await tx.billingTransaction.deleteMany({})
    await tx.payPalTransaction.deleteMany({})
    await tx.billing.deleteMany({})
    await tx.usage.deleteMany({})

    // Finally, customers themselves
    await tx.customers.deleteMany({})
  })

  const after = await getCounts()
  console.log("\n=== AFTER ===")
  printCounts(after)

  const diff: Record<string, number> = {}
  for (const k of Object.keys(before)) {
    diff[k] = (before as any)[k] - (after as any)[k]
  }
  console.log("\n=== DELETED ===")
  printCounts(diff as any)
}

async function getCounts() {
  return {
    customers: await prisma.customers.count(),
    chatSessions: await prisma.chatSession.count(),
    messages: await prisma.message.count(),
    conversationMessages: await prisma.conversationMessage.count(),
    messageArchive: await prisma.messageArchive.count(),
    agentConvLog: await prisma.agentConversationLog.count(),
    searchConv: await prisma.searchConversations.count(),
    orders: await prisma.orders.count(),
    orderItems: await prisma.orderItems.count(),
    carts: await prisma.carts.count(),
    cartItems: await prisma.cartItems.count(),
    creditNotes: await prisma.creditNote.count(),
    invoiceCreditNotes: await prisma.invoiceCreditNote.count(),
    appointments: await prisma.appointment.count(),
    pendingAppointments: await prisma.pendingAppointment.count(),
    billing: await prisma.billing.count(),
    billingTransactions: await prisma.billingTransaction.count(),
    paypalTransactions: await prisma.payPalTransaction.count(),
    monthlyInvoices: await prisma.monthlyInvoice.count(),
    invoiceAdjustments: await prisma.invoiceAdjustment.count(),
    usage: await prisma.usage.count(),
    whatsappQueue: await prisma.whatsAppQueue.count(),
    whatsappWebhookEvents: await prisma.whatsappWebhookEvent.count(),
    pushCampaigns: await prisma.pushCampaign.count(),
    pushCampaignRecipients: await prisma.pushCampaignRecipient.count(),
    playgroundTodos: await prisma.playgroundTodo.count(),
    playgroundComments: await prisma.playgroundComment.count(),
    registrationTokens: await prisma.registrationToken.count(),
    registrationAttempts: await prisma.registrationAttempts.count(),
    secureTokens: await prisma.secureToken.count(),
    shortUrls: await prisma.shortUrls.count(),
  }
}

function printCounts(c: Record<string, number>) {
  const w = Math.max(...Object.keys(c).map((k) => k.length))
  for (const k of Object.keys(c)) {
    console.log(`  ${k.padEnd(w)}  ${c[k]}`)
  }
}

main()
  .catch((e) => {
    console.error("\n❌ Wipe failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
