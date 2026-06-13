/**
 * Create (idempotently) the DemoCasa demo workspace so /demo/immob resolves.
 *
 * The public demo page (apps/frontend/src/pages/DemoWidgetPage.tsx) calls
 * GET /api/v1/playground/resolve-demo/:slug, which looks up the workspace whose
 * `customChatbotId` equals the URL slug. So for /demo/immob to work, ONE
 * workspace must exist with customChatbotId="immob". The custom chatbot module
 * (apps/backend/custom-immob/) is standalone and prompt-driven — it needs no
 * AgentConfig / FlowNodeConfig rows, only the workspace to exist.
 *
 * This mirrors how the demowash demo works. We copy a couple of behaviour
 * fields (owner, language) from the demowash workspace when present, but NEVER
 * copy WhatsApp / provider credentials — the demo runs through the widget /
 * demo-chat endpoint, not a real WhatsApp channel.
 *
 * SAFE BY DEFAULT: dry-run. Prints what it would do. Pass --apply to write.
 * Idempotent: if a workspace with customChatbotId="immob" already exists, it
 * reports it and exits without creating a duplicate.
 *
 * Run (from project root):
 *   dotenv -e .env -- tsx apps/backend/scripts/create-immob-demo-workspace.ts
 *   dotenv -e .env -- tsx apps/backend/scripts/create-immob-demo-workspace.ts --apply
 */

import { prisma } from "@echatbot/database"

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")

const CHATBOT_ID = "immob"
const NAME = "DemoCasa"
const SLUG = "democasa"

async function main() {
  // Idempotency: never create a second immob workspace.
  const existing = await (prisma as any).workspace.findFirst({
    where: { customChatbotId: CHATBOT_ID },
    select: { id: true, name: true, slug: true, customChatbotId: true },
  })
  if (existing) {
    console.log(
      `✅ Workspace already exists: ${existing.name} (slug=${existing.slug}, id=${existing.id}, customChatbotId=${existing.customChatbotId}). Nothing to do.`,
    )
    return
  }

  // Reuse owner + base language from demowash when available, so DemoCasa shows
  // under the same admin and behaves consistently. Falls back to defaults.
  const demowash = await (prisma as any).workspace.findFirst({
    where: { customChatbotId: "demowash" },
    select: { ownerId: true, language: true, defaultLanguage: true, currency: true },
  })

  // Guard: slug must be free (it is @unique).
  const slugTaken = await (prisma as any).workspace.findUnique({
    where: { slug: SLUG },
    select: { id: true },
  })
  if (slugTaken) {
    console.error(`❌ slug "${SLUG}" is already taken by workspace ${slugTaken.id}. Aborting.`)
    process.exit(1)
  }

  const data = {
    name: NAME,
    slug: SLUG,
    customChatbotId: CHATBOT_ID, // ← the key field resolve-demo matches on
    channelMode: "FLOW" as const, // custom-chatbot workspaces use FLOW (like demowash)
    // Channels: the demo runs through the widget; no real WhatsApp credentials.
    enableWhatsapp: false,
    enableWidget: true,
    hasHumanSupport: true,
    // Language / locale (mirror demowash when present).
    language: demowash?.language ?? "ENG",
    defaultLanguage: demowash?.defaultLanguage ?? "es",
    currency: demowash?.currency ?? "EUR",
    // Escalation contact (the module's settings.json takes precedence at runtime,
    // but keep a sane value on the workspace too).
    operatorContactMethod: "email",
    operatorEmail: "echatbotai@gmail.com",
    chatbotName: "DemoCasa",
    businessType: "real_estate",
    // No presentation video for now.
    welcomeVideoUrl: null,
    ...(demowash?.ownerId ? { ownerId: demowash.ownerId } : {}),
  }

  console.log(`🏢 Will create workspace:`)
  console.log(JSON.stringify(data, null, 2))

  if (!APPLY) {
    console.log("\nℹ️  DRY-RUN. Re-run with --apply to create it.")
    return
  }

  const created = await (prisma as any).workspace.create({
    data,
    select: { id: true, name: true, slug: true, customChatbotId: true },
  })
  console.log(
    `\n✅ Created: ${created.name} (slug=${created.slug}, id=${created.id}, customChatbotId=${created.customChatbotId})`,
  )
  console.log(`   Demo will resolve at: /demo/${CHATBOT_ID}`)
}

main()
  .catch((err) => {
    console.error("❌ Failed:", err instanceof Error ? err.message : err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
