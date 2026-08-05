/**
 * Updates the AmRobots "Human operator flow" (Andrea, 2026-08-06).
 *
 * Two changes, both read off the live production graph before writing:
 *
 * 1. hf_handoff_powered_off was terminalType 'SELF_SERVICE', not 'ESCALATE'.
 *    A customer whose robot is off ended the flow in self-service: no name
 *    asked, no hand-off message, no operator, chatbot left on. Every road
 *    through this flow must reach a human — that is what the flow is for.
 *
 * 2. cutSchedulingActive and batterySufficient join the flow as DIAGNOSTIC
 *    nodes. They were left out originally because, as checklist items, "Yes"
 *    and "No" led to the same next node — a branch that does not branch,
 *    which the compiler rejects with converging_edge_targets. The semantics
 *    is different now: "No" leads to a corrective node ("turn it on" /
 *    "charge it") that loops BACK to the question, so the two answers
 *    genuinely go somewhere different.
 *
 * The back-edge is legal because the node closing the cycle is typed
 * terminalType 'LOOP' — the compiler allows cycles only through those, and a
 * LOOP node may only call `remember` (flow-compiler.types.ts).
 *
 * No ask cap is modelled here: a LOOP in the graph is infinite by
 * construction. gate.ts's maxAsks is what bounds it, on the principle
 * already written there — a customer who cannot complete a check must still
 * reach a human rather than be trapped.
 *
 * `name` stays OUT of this flow and keeps being asked by
 * escalate_to_operator: answer_step classifies fixed edge labels, it cannot
 * capture free text.
 *
 * Node questions for the two pre-existing nodes are preserved VERBATIM from
 * production — they were edited from the UI and are the tenant's own copy.
 *
 * This UPDATES the existing flow (CONTRACT.md: "editato si, cancellarlo
 * mai") — same flow row, new graph.
 *
 * Run with:
 *   npm run --workspace @echatbot/backend exec -- dotenv -e ../../.env -- tsx scripts/update-amrobots-human-support-flow.ts
 */
import { prisma } from "@echatbot/database"
import { saveFlowGraph } from "../src/application/flow-builder/flow-graph.service"
import { OpenRouterEmbeddingProvider } from "../src/application/flow-builder/embedding-provider"

const FLOW_ID = "cmsfavpet0000qwngacwdutj6"

async function main() {
  const flow = await prisma.flow.findUnique({
    where: { id: FLOW_ID },
    select: { id: true, title: true, workspaceId: true },
  })
  if (!flow) throw new Error(`Flow ${FLOW_ID} not found — this script updates, it never creates`)

  const nodes = [
    // Questions preserved verbatim from the live graph (edited from the UI).
    { id: "hf_powered_on", question: "Before connect to our Human Support let me ask you a couple of question, Is the robot power on?", positionX: 0, positionY: 0, fieldKey: "robotPoweredOn", fieldType: "boolean", terminalType: null },
    { id: "hf_wifi", question: "Good. And now Can you confirm that the wifi is active ?", positionX: 280, positionY: 0, fieldKey: "wifiActive", fieldType: "boolean", terminalType: null },

    // Corrective LOOP nodes: a "No" is not a dead end. Support cannot help a
    // robot that is off or offline, so we ask the customer to fix it and
    // re-check, rather than escalating with a blocker nobody addressed
    // (Andrea, 2026-08-06).
    { id: "hf_power_fix", question: "The robot needs to be switched on for support to be able to help — please turn it on, then let me know once it is running.", positionX: 0, positionY: 200, terminalType: "LOOP" },
    { id: "hf_wifi_fix", question: "Support needs the robot connected to be able to help — please switch the wifi on, then let me know once it is connected.", positionX: 280, positionY: 200, terminalType: "LOOP" },

    { id: "hf_cut_scheduling", question: "One more check — is the cut scheduling currently active?", positionX: 560, positionY: 0, fieldKey: "cutSchedulingActive", fieldType: "boolean", terminalType: null },
    { id: "hf_cut_fix", question: "Please activate the cut scheduling from the app, then let me know once it is on.", positionX: 560, positionY: 200, terminalType: "LOOP" },

    { id: "hf_battery", question: "And is the battery charged enough right now?", positionX: 840, positionY: 0, fieldKey: "batterySufficient", fieldType: "boolean", terminalType: null },
    { id: "hf_battery_fix", question: "Please put the robot on its charging base for a while, then let me know once it has charged.", positionX: 840, positionY: 200, terminalType: "LOOP" },

    // One terminal, and it ESCALATEs: this flow's only destination is a
    // human. The per-answer terminals are gone — every "No" now goes to its
    // corrective LOOP instead, and the cap that stops the loop lives in code
    // (MAX_LOOP_TURNS), which then escalates anyway.
    { id: "hf_handoff_checks_done", question: "This flow has reached its escalation point — the standard checks are done, so the issue is something else.", positionX: 1120, positionY: 0, terminalType: "ESCALATE" },
  ]

  // No edge uses triggersEscalation: that flag stops advance() WITHOUT
  // visiting a target node, which would skip the terminal's own dictated
  // text. Every branch targets a node directly instead.
  const edges = [
    { id: "hf_e_powered_yes", sourceNodeId: "hf_powered_on", targetNodeId: "hf_wifi", label: "Yes" },
    { id: "hf_e_powered_no", sourceNodeId: "hf_powered_on", targetNodeId: "hf_power_fix", label: "No" },
    { id: "hf_e_powered_back", sourceNodeId: "hf_power_fix", targetNodeId: "hf_powered_on", label: "Done" },

    { id: "hf_e_wifi_yes", sourceNodeId: "hf_wifi", targetNodeId: "hf_cut_scheduling", label: "Yes" },
    { id: "hf_e_wifi_no", sourceNodeId: "hf_wifi", targetNodeId: "hf_wifi_fix", label: "No" },
    { id: "hf_e_wifi_back", sourceNodeId: "hf_wifi_fix", targetNodeId: "hf_wifi", label: "Done" },

    { id: "hf_e_cut_yes", sourceNodeId: "hf_cut_scheduling", targetNodeId: "hf_battery", label: "Yes" },
    { id: "hf_e_cut_no", sourceNodeId: "hf_cut_scheduling", targetNodeId: "hf_cut_fix", label: "No" },
    { id: "hf_e_cut_back", sourceNodeId: "hf_cut_fix", targetNodeId: "hf_cut_scheduling", label: "Done" },

    { id: "hf_e_batt_yes", sourceNodeId: "hf_battery", targetNodeId: "hf_handoff_checks_done", label: "Yes" },
    { id: "hf_e_batt_no", sourceNodeId: "hf_battery", targetNodeId: "hf_battery_fix", label: "No" },
    { id: "hf_e_batt_back", sourceNodeId: "hf_battery_fix", targetNodeId: "hf_battery", label: "Done" },
  ]

  const embeddingProvider = new OpenRouterEmbeddingProvider(process.env.OPENROUTER_API_KEY || "")
  const result = await saveFlowGraph(
    flow.workspaceId,
    flow.id,
    { title: flow.title, nodes: nodes as any, edges: edges as any },
    embeddingProvider
  )

  if (!result.ok) {
    console.error("SAVE FAILED:", JSON.stringify(result.validationReport, null, 2))
    process.exit(1)
  }

  console.log("SAVED flow id:", flow.id)
  console.log("WARNINGS:", JSON.stringify(result.warnings))
}

main()
  .catch((err) => {
    console.error("ERR:", err?.message || err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
