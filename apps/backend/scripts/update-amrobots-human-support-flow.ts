/**
 * Updates the AmRobots "Human operator flow" (Andrea, 2026-08-07).
 *
 * Today's shape — ONE combined technical check (Andrea: "vorrei avere tutto
 * in un nodo"):
 *
 *   hf_checks      "is the wifi active and the cut scheduling enabled?"
 *     Yes  → hf_handoff_checks_done (ESCALATE)
 *     No   → hf_checks_fix (LOOP): fix both, "Done" → hf_handoff_checks_done
 *
 * Gone from the graph (2026-08-07): robotPoweredOn, batterySufficient, and
 * the separate wifi / cut-scheduling nodes. The four-question version
 * (2026-08-06) interrogated the customer one boolean at a time right before
 * the hand-off; production transcripts showed the same ground being covered
 * twice once a session straddled an edit. The combined question keeps the
 * only two checks support actually needs (connectivity + scheduling) in a
 * single turn.
 *
 * The "Done" edge on the fix node goes FORWARD to the terminal, never back
 * to the question: "I switched both on" already answers it, and a back-edge
 * makes the model skip the redundant dictated question and desync from the
 * flow (seen live 2026-08-06). terminalType LOOP stays as the marker the
 * runtime's turn cap (MAX_LOOP_TURNS) keys on.
 *
 * `name` stays OUT of this flow and keeps being asked by
 * escalate_to_operator: answer_step classifies fixed edge labels, it cannot
 * capture free text.
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

const DESCRIPTION =
  "Use this flow when you need to verify that your robot has the wifi active and the cut scheduling enabled before escalating to a human support agent."

async function main() {
  const flow = await prisma.flow.findUnique({
    where: { id: FLOW_ID },
    select: { id: true, title: true, workspaceId: true },
  })
  if (!flow) throw new Error(`Flow ${FLOW_ID} not found — this script updates, it never creates`)

  const nodes = [
    { id: "hf_checks", question: "Before connecting you to our Human Support, one quick check — is the wifi active and the cut scheduling enabled?", positionX: 0, positionY: 0, fieldKey: "wifiAndCutSchedulingActive", fieldType: "boolean", terminalType: null },
    { id: "hf_checks_fix", question: "Support needs the robot connected and scheduled to be able to help — please switch the wifi on and activate the cut scheduling from the app, then let me know once both are on.", positionX: 0, positionY: 200, terminalType: "LOOP" },
    // One terminal, and it ESCALATEs: this flow's only destination is a human.
    { id: "hf_handoff_checks_done", question: "This flow has reached its escalation point — the standard checks are done, so the issue is something else.", positionX: 280, positionY: 0, terminalType: "ESCALATE" },
  ]

  // No edge uses triggersEscalation: that flag stops advance() WITHOUT
  // visiting a target node, which would skip the terminal's own dictated text.
  const edges = [
    { id: "hf_e_checks_yes", sourceNodeId: "hf_checks", targetNodeId: "hf_handoff_checks_done", label: "Yes" },
    { id: "hf_e_checks_no", sourceNodeId: "hf_checks", targetNodeId: "hf_checks_fix", label: "No" },
    { id: "hf_e_checks_done", sourceNodeId: "hf_checks_fix", targetNodeId: "hf_handoff_checks_done", label: "Done" },
  ]

  const embeddingProvider = new OpenRouterEmbeddingProvider(process.env.OPENROUTER_API_KEY || "")
  const result = await saveFlowGraph(
    flow.workspaceId,
    flow.id,
    { title: flow.title, description: DESCRIPTION, nodes: nodes as any, edges: edges as any },
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
