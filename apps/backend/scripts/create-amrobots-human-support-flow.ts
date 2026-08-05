/**
 * Creates/updates the AmRobots "Human operator flow" — the shared
 * pre-operator technical check (acceso/wifi/scheduling/batteria) as a real
 * flow-builder flow instead of the code-owned PRE_OPERATOR_ORDER list.
 *
 * The name question stays outside this flow: the flow engine
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
    { id: "hf_cut_schedule", question: "Is it currently in a scheduled cutting cycle?", positionX: 560, positionY: 0, fieldKey: "cutSchedulingActive", fieldType: "boolean", terminalType: null },
    { id: "hf_battery", question: "Is the battery sufficiently charged?", positionX: 840, positionY: 0, fieldKey: "batterySufficient", fieldType: "boolean", terminalType: null },
    { id: "hf_handoff", question: "This flow has reached its escalation point.", positionX: 1120, positionY: 0, terminalType: "ESCALATE" },
  ]

  // No edge uses triggersEscalation: that flag makes advance() stop with
  // escalate:true WITHOUT visiting a target node, which would skip
  // hf_handoff's own dictated text (terminalFlowNodeResult in agent.ts).
  // Every branch targets hf_handoff directly instead.
  const edges = [
    { id: "hf_e_powered_yes", sourceNodeId: "hf_powered_on", targetNodeId: "hf_wifi", label: "Yes" },
    { id: "hf_e_powered_no", sourceNodeId: "hf_powered_on", targetNodeId: "hf_handoff", label: "No" },
    { id: "hf_e_wifi_yes", sourceNodeId: "hf_wifi", targetNodeId: "hf_cut_schedule", label: "Yes" },
    { id: "hf_e_wifi_no", sourceNodeId: "hf_wifi", targetNodeId: "hf_handoff", label: "No" },
    { id: "hf_e_cut_yes", sourceNodeId: "hf_cut_schedule", targetNodeId: "hf_battery", label: "Yes" },
    { id: "hf_e_cut_no", sourceNodeId: "hf_cut_schedule", targetNodeId: "hf_battery", label: "No" },
    { id: "hf_e_battery_yes", sourceNodeId: "hf_battery", targetNodeId: "hf_handoff", label: "Yes" },
    { id: "hf_e_battery_no", sourceNodeId: "hf_battery", targetNodeId: "hf_handoff", label: "No" },
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
