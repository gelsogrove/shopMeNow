/**
 * Creates/updates the AmRobots "Human operator flow" — the shared
 * pre-operator technical check as a real flow-builder flow instead of the
 * code-owned PRE_OPERATOR_ORDER list.
 *
 * Only powered-on and wifi are modelled as flow nodes: a "No" answer on
 * either genuinely changes the path (skips straight to handoff instead of
 * asking the next check) — a real branch point. cutSchedulingActive and
 * batterySufficient are NOT flow nodes (Andrea 2026-08-05, seen live: two
 * nodes here had "Yes" and "No" both leading to the same next node — a
 * flow-builder branch that doesn't actually branch is exactly the bug the
 * compiler's converging_edge_targets check now rejects). They stay
 * code-owned intake fields in gate.ts's PRE_OPERATOR_ORDER, asked and
 * recorded for the operator briefing regardless of the answer.
 *
 * The name question also stays outside this flow: the flow engine
 * (answer_step/advance) only classifies fixed edge labels, it cannot capture
 * free text like a name. escalate_to_operator already asks for it (via
 * remember) right after this flow's ESCALATE terminal hands off.
 *
 * One-time script — run with:
 *   npm run --workspace @echatbot/backend exec -- dotenv -e ../../.env -- tsx scripts/create-amrobots-human-support-flow.ts
 */
import { prisma } from "@echatbot/database"
import { createFlow, saveFlowGraph } from "../src/application/flow-builder/flow-graph.service"
import { OpenRouterEmbeddingProvider } from "../src/application/flow-builder/embedding-provider"

async function main() {
  const workspace = await prisma.workspace.findFirst({ where: { name: { contains: "amrobots", mode: "insensitive" } } })
  if (!workspace) throw new Error("AmRobots workspace not found")

  const title = "Human operator flow"
  const existing = await prisma.flow.findFirst({ where: { workspaceId: workspace.id, title } })
  const flow = existing ?? (await createFlow(workspace.id, null, title, "Shared pre-operator escalation path — every road to a human operator goes through this flow."))

  const nodes = [
    { id: "hf_powered_on", question: "Is the robot powered on?", positionX: 0, positionY: 0, fieldKey: "robotPoweredOn", fieldType: "boolean", terminalType: null },
    { id: "hf_wifi", question: "Is the wifi active?", positionX: 280, positionY: 0, fieldKey: "wifiActive", fieldType: "boolean", terminalType: null },
    { id: "hf_handoff_powered_off", question: "This flow has reached its escalation point — the robot is off, which may itself be part of the issue.", positionX: 560, positionY: -160, terminalType: "ESCALATE" },
    { id: "hf_handoff_wifi_off", question: "This flow has reached its escalation point — the robot's wifi is off, which may itself be part of the issue.", positionX: 560, positionY: 0, terminalType: "ESCALATE" },
    { id: "hf_handoff_wifi_on", question: "This flow has reached its escalation point — wifi is active, so the issue is something else.", positionX: 560, positionY: 160, terminalType: "ESCALATE" },
  ]

  // No edge uses triggersEscalation: that flag makes advance() stop with
  // escalate:true WITHOUT visiting a target node, which would skip the
  // terminal's own dictated text (terminalFlowNodeResult in agent.ts). Every
  // branch targets a terminal node directly instead — and each answer gets
  // its OWN terminal (different text, different targetNodeId) rather than
  // converging on a shared one, which would make the question pointless
  // (compiler's converging_edge_targets guard).
  const edges = [
    { id: "hf_e_powered_yes", sourceNodeId: "hf_powered_on", targetNodeId: "hf_wifi", label: "Yes" },
    { id: "hf_e_powered_no", sourceNodeId: "hf_powered_on", targetNodeId: "hf_handoff_powered_off", label: "No" },
    { id: "hf_e_wifi_yes", sourceNodeId: "hf_wifi", targetNodeId: "hf_handoff_wifi_on", label: "Yes" },
    { id: "hf_e_wifi_no", sourceNodeId: "hf_wifi", targetNodeId: "hf_handoff_wifi_off", label: "No" },
  ]

  const embeddingProvider = new OpenRouterEmbeddingProvider()
  const result = await saveFlowGraph(workspace.id, flow!.id, { title, nodes: nodes as any, edges: edges as any }, embeddingProvider)

  if (!result.ok) {
    console.error("Save failed:", JSON.stringify(result.validationReport, null, 2))
    process.exit(1)
  }

  console.log("Saved flow id:", flow!.id)
  console.log("Warnings:", JSON.stringify(result.warnings, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
