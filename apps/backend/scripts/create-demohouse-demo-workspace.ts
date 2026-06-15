/**
 * Duplicate the demowash demo Workspace as "DemoHouse" (real-estate) so
 * /demo/demohouse resolves, owned by a given user.
 *
 * The public demo page (apps/frontend/src/pages/DemoWidgetPage.tsx) calls
 * GET /api/v1/playground/resolve-demo/:slug, which looks up the workspace whose
 * `customChatbotId` equals the URL slug. So for /demo/demohouse to work, ONE
 * workspace must exist with customChatbotId="demohouse". The custom chatbot module
 * (apps/backend/custom-demohouse/) is standalone and prompt-driven — it needs no
 * AgentConfig / FlowNodeConfig rows, only the workspace to exist.
 *
 * What it does: clone the demowash workspace's behaviour/display config, but
 * NEVER copy channel credentials (WhatsApp / Meta / UltraMsg / Wasender / API
 * keys / webhook secrets / storage keys) — the demo runs through the widget /
 * demo-chat endpoint, not a real WhatsApp channel. Sets name="DemoHouse",
 * slug="demohouse", customChatbotId="demohouse", owner = the --owner user, and
 * links that user via UserWorkspace so it shows under their account.
 *
 * SAFE BY DEFAULT: dry-run. Prints exactly what it would create. Pass --apply to
 * write. Idempotent: if a workspace with customChatbotId="demohouse" already
 * exists, it reports it and exits without creating a duplicate.
 *
 * Run (LOCAL, from project root):
 *   dotenv -e .env -- tsx apps/backend/scripts/create-demohouse-demo-workspace.ts
 *   dotenv -e .env -- tsx apps/backend/scripts/create-demohouse-demo-workspace.ts --apply
 *
 * Run against a specific DB (e.g. Heroku) — pass DATABASE_URL inline, do NOT print it:
 *   DATABASE_URL="$(heroku config:get DATABASE_URL -a echatbot-app)" \
 *     tsx apps/backend/scripts/create-demohouse-demo-workspace.ts --owner gelsogrove@gmail.com
 *   (add --apply to actually write)
 */

import { prisma } from "@echatbot/database"

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}

// Defaults create DemoHouse; override via flags to create any custom-chatbot demo
// (e.g. --chatbot demowash --name DemoWash --slug demowash --business laundry).
const CHATBOT_ID = flag("chatbot") || "demohouse"
const NAME = flag("name") || "DemoHouse"
const SLUG = (flag("slug") || CHATBOT_ID).toLowerCase()
const BUSINESS = flag("business") || "real_estate"
const SOURCE_CHATBOT_ID = flag("source") || "__none__" // workspace to clone config from (if present)
const OWNER_EMAIL = (flag("owner") || "gelsogrove@gmail.com").toLowerCase()

// Identity / unique / credential / channel-state fields that must NOT be copied
// from the source workspace. Everything else (behaviour + display config, incl.
// widget styling, locale, operator settings) is cloned.
const DO_NOT_COPY = new Set<string>([
  "id", "slug", "name", "customChatbotId", "createdAt", "updatedAt", "deletedAt", "ownerId",
  // WhatsApp / Meta / UltraMsg / Wasender credentials + session state
  "whatsappPhoneNumber", "whatsappApiKey", "whatsappPhoneNumberId", "whatsappVerifyToken",
  "metaPhoneNumberId", "metaAccessToken", "webhookVerifyToken",
  "ultraMsgInstanceId", "ultraMsgToken", "ultraMsgApiUrl",
  "wasenderSessionId", "wasenderApiKey", "wasenderSessionStatus", "wasenderPhoneNumber",
  "wasenderQrString", "wasenderQrGeneratedAt", "wasenderIsActive",
  // Secrets / misc identity
  "apiKey", "webhookUrl", "webhookSecret", "notificationEmail", "metadata",
  "logoUrl", "logoKey", "widgetLogoUrl", "widgetLogoKey", "websiteUrl", "url",
])

async function main() {
  // Idempotency: never create a second DemoHouse workspace.
  const existing = await (prisma as any).workspace.findFirst({
    where: { customChatbotId: CHATBOT_ID },
    select: { id: true, name: true, slug: true, customChatbotId: true, ownerId: true },
  })
  if (existing) {
    console.log(
      `✅ Workspace already exists: ${existing.name} (slug=${existing.slug}, id=${existing.id}, customChatbotId=${existing.customChatbotId}, ownerId=${existing.ownerId ?? "—"}). Nothing to do.`,
    )
    return
  }

  // Source workspace to clone (demowash). Optional: when it isn't present
  // (e.g. a freshly-seeded production DB), we fall back to sensible defaults so
  // DemoHouse is still created standalone.
  const source = await (prisma as any).workspace.findFirst({
    where: { customChatbotId: SOURCE_CHATBOT_ID },
  })

  // Owner user.
  const owner = await (prisma as any).user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true, email: true, firstName: true, lastName: true },
  })
  if (!owner) {
    console.error(`❌ No user with email "${OWNER_EMAIL}". Pass --owner <email> of an existing user. Aborting.`)
    process.exit(1)
  }

  // Slug must be free (@unique).
  const slugTaken = await (prisma as any).workspace.findUnique({
    where: { slug: SLUG },
    select: { id: true },
  })
  if (slugTaken) {
    console.error(`❌ slug "${SLUG}" is already taken by workspace ${slugTaken.id}. Aborting.`)
    process.exit(1)
  }

  // Sensible standalone defaults used when there is no demowash to clone.
  const DEFAULTS: Record<string, unknown> = {
    channelMode: "FLOW",
    language: "ENG",
    defaultLanguage: "es",
    currency: "EUR",
    hasHumanSupport: true,
    operatorContactMethod: "email",
    operatorEmail: "echatbotai@gmail.com",
  }

  // Build the payload: clone every source field except the blocklist (when a
  // source exists), else use DEFAULTS; then override identity + owner + force
  // the demo to NOT use a real WhatsApp channel.
  const data: Record<string, unknown> = {}
  if (source) {
    for (const [k, v] of Object.entries(source)) {
      if (!DO_NOT_COPY.has(k)) data[k] = v
    }
  } else {
    Object.assign(data, DEFAULTS)
  }
  data.name = NAME
  data.slug = SLUG
  data.customChatbotId = CHATBOT_ID
  data.ownerId = owner.id
  data.chatbotName = NAME
  data.businessType = BUSINESS
  data.enableWhatsapp = false // demo via widget only — no real WhatsApp channel
  data.enableWidget = true

  const copiedKeys = Object.keys(data).filter((k) => !["name", "slug", "customChatbotId", "ownerId"].includes(k))
  console.log(
    source
      ? `🏢 Will CLONE "${source.name}" (id=${source.id}) → "${NAME}"`
      : `🏢 No "${SOURCE_CHATBOT_ID}" source found — will CREATE FRESH "${NAME}" with defaults`,
  )
  console.log(`   owner: ${owner.email} (id=${owner.id})`)
  console.log(`   customChatbotId=${CHATBOT_ID}  slug=${SLUG}`)
  console.log(`   config fields (${copiedKeys.length}): ${copiedKeys.join(", ")}`)

  if (!APPLY) {
    console.log("\nℹ️  DRY-RUN. Re-run with --apply to create it.")
    return
  }

  const created = await (prisma as any).workspace.create({
    data,
    select: { id: true, name: true, slug: true, customChatbotId: true },
  })
  // Link the owner via UserWorkspace so the workspace shows under their account.
  await (prisma as any).userWorkspace.upsert({
    where: { userId_workspaceId: { userId: owner.id, workspaceId: created.id } },
    update: {},
    create: { userId: owner.id, workspaceId: created.id, role: "ADMIN" },
  })

  console.log(
    `\n✅ Created: ${created.name} (slug=${created.slug}, id=${created.id}, customChatbotId=${created.customChatbotId})`,
  )
  console.log(`   Linked owner ${owner.email} via UserWorkspace (ADMIN).`)
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
