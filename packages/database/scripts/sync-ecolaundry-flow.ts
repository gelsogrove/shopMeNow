/**
 * Production Migration: Sync Ecolaundry FLOW (Router prompt + resetSession CF)
 *
 * Idempotent — safe to re-run. Updates only Ecolaundry records:
 *   1) FlowNodeConfig.router        → new systemPrompt (intent classification) + availableFunctions
 *   2) FlowNodeConfig.lavatrice_*   → add resetSession to availableFunctions + prompt note
 *   3) FlowNodeConfig.asciugatrice_*→ add resetSession to availableFunctions + prompt note
 *   4) WorkspaceCallingFunction     → upsert resetSession row
 *
 * Usage (local against Heroku DB):
 *   DATABASE_URL="<heroku-postgres-url>" npx tsx packages/database/scripts/sync-ecolaundry-flow.ts
 *
 * Or via Heroku CLI:
 *   heroku run "cd packages/database && npx tsx scripts/sync-ecolaundry-flow.ts" --app <app>
 */

import { config } from "dotenv"
config()

import { PrismaClient } from "@echatbot/database"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const ECOLAUNDRY_WORKSPACE_ID = "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL?.includes("heroku") ||
    process.env.DATABASE_URL?.includes("amazonaws")
      ? { rejectUnauthorized: false }
      : false,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const ECOLAUNDRY_ROUTER_PROMPT = `You are {{chatbotName}}, the virtual assistant of {{companyName}}, a self-service laundry.
Tone: {{toneOfVoice}}.

YOUR MISSION: help the customer. First decide WHAT they want, then react accordingly.

## INTENT CLASSIFICATION (do this FIRST, every turn)
Classify the user message into exactly one of:
- GREETING → just a hello, no request yet
- FAQ → general question about prices, hours, locations, soap, loyalty card, payment methods, how the machine works in general, refund policy, etc. NO specific broken-machine report.
- MACHINE_PROBLEM → the customer describes a concrete issue with a machine (won't start, display shows something, clothes still wet, door stuck, I paid but nothing happened, etc.)
- CORRECTION → the customer corrects a previous answer (wrong machine, wrong number, "start over")
- OTHER → none of the above

## RESPONSE BY INTENT
- GREETING → "Hi! I'm the Ecolaundry assistant. How can I help you today?" — DO NOT ask location, DO NOT start gathering info.
- FAQ → Answer the question using the FAQs section below. DO NOT ask for location, machine type or number. DO NOT call assignMachine().
- MACHINE_PROBLEM → Start the gather flow (see GATHER FLOW below).
- CORRECTION → If assignMachine was already called, call resetSession(). Otherwise update the missing piece and continue the gather.
- OTHER → Ask ONE clarifying question.

## GATHER FLOW (ONLY when intent = MACHINE_PROBLEM)
Collect in this STRICT order, ONE question per message:
1) Location (Goya, Pineda, L'Escala, Alemanya, Hortes)
2) Machine type (washer / dryer) — infer from the user message if possible, else ask
3) Machine number (the number on the machine label)
4) Payment method (card, cash, code)
When ALL FOUR are known → call assignMachine() with:
- flowKey: lavatrice_hs60xx (washer) | asciugatrice_ed340 (dryer)
- machineNumber, locale, machineType, paymentMethod

## WHEN TO CALL resetSession()
Call resetSession() WITHOUT asking confirmation when the customer signals they made a mistake or wants to restart. Examples (any language):
- "wait, I meant the dryer" / "era l'asciugatrice" / "era la secadora"
- "forget it, let's start over" / "ricominciamo" / "empecemos de nuevo"
- "the machine number is different" AFTER assignMachine was already called
After resetSession() context is wiped — start over from GATHER FLOW step 1.

## EXAMPLES
- "Ciao" → "Hi! I'm the Ecolaundry assistant. How can I help you today?"  (GREETING — no gather)
- "Fammi vedere i prezzi" → answer with prices from FAQs.  (FAQ — no gather)
- "A che ora aprite?" → answer with opening hours from FAQs.  (FAQ — no gather)
- "Quanto costa un lavaggio a 40 gradi?" → answer €3.50 from FAQs.  (FAQ — no gather)
- "La lavatrice non parte, ho pagato" → "I understand, don't worry. Which location are you at?"  (MACHINE_PROBLEM — gather)
- "Goya" (after MACHINE_PROBLEM) → "Is it a washer or a dryer?"  (gather step 2)
- "Aspetta, era l'asciugatrice" (after assignMachine) → call resetSession()  (CORRECTION)

## FREQUENTLY ASKED QUESTIONS
Use these to answer FAQ intents directly:

{{faqs}}

## HARD RULES
- Classify intent BEFORE deciding the response.
- NEVER ask for location/machine/number when the user is just greeting or asking a general question.
- NEVER invent information outside FAQs.
- ONE question per message.
- ALWAYS reply in the customer's language — TranslationAgent handles multilingual output.`

const RESET_NOTE = `
## WHEN TO CALL resetSession()
Call resetSession() without asking confirmation whenever the customer signals they picked the WRONG machine type/number or wants to restart (any language). Examples:
- "wait, I meant the dryer" / "era l'asciugatrice" / "era la secadora"
- "start over" / "ricominciamo" / "empecemos de nuevo"
- "forget it, another machine"
After reset the context is wiped and the Router will ask again from step 1.`

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")

  console.log("🚀 Syncing Ecolaundry FLOW config on:", maskDb(process.env.DATABASE_URL))

  const ws = await prisma.workspace.findUnique({ where: { id: ECOLAUNDRY_WORKSPACE_ID } })
  if (!ws) throw new Error(`Workspace ${ECOLAUNDRY_WORKSPACE_ID} not found`)
  console.log(`   Workspace: ${ws.name}`)

  // 1) Router
  await prisma.flowNodeConfig.update({
    where: {
      workspaceId_flowKey: { workspaceId: ECOLAUNDRY_WORKSPACE_ID, flowKey: "router" },
    },
    data: {
      systemPrompt: ECOLAUNDRY_ROUTER_PROMPT,
      availableFunctions: ["assignMachine", "contactOperator", "resetSession"],
    },
  })
  console.log("   ✅ Router updated")

  // 2) Washer — append resetSession note to existing prompt if missing + update availableFunctions
  const washer = await prisma.flowNodeConfig.findUnique({
    where: {
      workspaceId_flowKey: { workspaceId: ECOLAUNDRY_WORKSPACE_ID, flowKey: "lavatrice_hs60xx" },
    },
  })
  if (washer) {
    const needsNote = !washer.systemPrompt?.includes("WHEN TO CALL resetSession")
    await prisma.flowNodeConfig.update({
      where: { id: washer.id },
      data: {
        systemPrompt: needsNote ? washer.systemPrompt + RESET_NOTE : washer.systemPrompt,
        availableFunctions: ["startFlow", "contactOperator", "resetSession"],
      },
    })
    console.log(`   ✅ Washer updated${needsNote ? " (+ reset note)" : ""}`)
  }

  // 3) Dryer
  const dryer = await prisma.flowNodeConfig.findUnique({
    where: {
      workspaceId_flowKey: { workspaceId: ECOLAUNDRY_WORKSPACE_ID, flowKey: "asciugatrice_ed340" },
    },
  })
  if (dryer) {
    const needsNote = !dryer.systemPrompt?.includes("WHEN TO CALL resetSession")
    await prisma.flowNodeConfig.update({
      where: { id: dryer.id },
      data: {
        systemPrompt: needsNote ? dryer.systemPrompt + RESET_NOTE : dryer.systemPrompt,
        availableFunctions: ["startFlow", "contactOperator", "resetSession"],
      },
    })
    console.log(`   ✅ Dryer updated${needsNote ? " (+ reset note)" : ""}`)
  }

  // 4) Upsert resetSession CF row
  await prisma.workspaceCallingFunction.upsert({
    where: {
      workspaceId_functionName: {
        workspaceId: ECOLAUNDRY_WORKSPACE_ID,
        functionName: "resetSession",
      },
    },
    update: {
      description:
        "Reset the session when the customer realizes they picked the wrong machine type/number or explicitly wants to start over. Wipes flowKey, flowNumber, flowState and gatherState so the Router restarts from the beginning.",
      parameters: { type: "object", properties: {}, required: [] },
      isSystemFunction: true,
      executionType: "INTERNAL",
      isActive: true,
    },
    create: {
      workspaceId: ECOLAUNDRY_WORKSPACE_ID,
      functionName: "resetSession",
      description:
        "Reset the session when the customer realizes they picked the wrong machine type/number or explicitly wants to start over. Wipes flowKey, flowNumber, flowState and gatherState so the Router restarts from the beginning.",
      parameters: { type: "object", properties: {}, required: [] },
      isSystemFunction: true,
      executionType: "INTERNAL",
      isActive: true,
    },
  })
  console.log("   ✅ WorkspaceCallingFunction resetSession upserted")

  console.log("✨ Done.")
}

function maskDb(url: string): string {
  return url.replace(/:\/\/[^@]+@/, "://***@")
}

main()
  .catch((e) => {
    console.error("❌ Sync failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
