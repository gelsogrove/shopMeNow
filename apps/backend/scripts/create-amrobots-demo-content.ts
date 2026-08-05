/**
 * Seeds AmRobots demo content for testing FAQ-vs-flow disambiguation:
 * 3 FAQs (product/usage questions) + 6 troubleshooting flows across 2
 * categories — Robotica (002 critical overheating, 003 unusual noise) and
 * Cables (004 boundary wire not detected, 005 robot crosses the boundary
 * wire, 006 cable connector failure) — on top of the existing 001 flow
 * (Robotica) and Human operator flow.
 *
 * 002 has a "does it make an unusual noise?" branch that hands over to 003
 * — the case Andrea asked for explicitly, to test cross-flow handoff.
 *
 * One-time script — run with:
 *   DATABASE_URL=... OPENROUTER_API_KEY=... tsx -r tsconfig-paths/register scripts/create-amrobots-demo-content.ts
 */
import { prisma } from "@echatbot/database"
import { createFlow, saveFlowGraph } from "../src/application/flow-builder/flow-graph.service"
import { OpenRouterEmbeddingProvider } from "../src/application/flow-builder/embedding-provider"

async function upsertCategory(workspaceId: string, name: string): Promise<string> {
  const existing = await prisma.flowCategory.findFirst({ where: { workspaceId, name } })
  if (existing) return existing.id
  const created = await prisma.flowCategory.create({ data: { workspaceId, name } })
  return created.id
}

async function upsertFlow(
  workspaceId: string,
  title: string,
  description: string,
  nodes: any[],
  edges: any[],
  embeddingProvider: OpenRouterEmbeddingProvider,
  flowCategoryId: string | null = null,
) {
  const existing = await prisma.flow.findFirst({ where: { workspaceId, title } })
  const flow = existing ?? (await createFlow(workspaceId, flowCategoryId, title, description))
  if (existing && flowCategoryId && existing.flowCategoryId !== flowCategoryId) {
    await prisma.flow.update({ where: { id: existing.id }, data: { flowCategoryId } })
  }
  const result = await saveFlowGraph(workspaceId, flow!.id, { title, description, nodes, edges }, embeddingProvider)
  if (!result.ok) {
    console.error(`Save failed for "${title}":`, JSON.stringify(result.validationReport, null, 2))
    process.exit(1)
  }
  console.log(`Saved "${title}" -> ${flow!.id}`)
  return flow!.id
}

async function main() {
  const workspace = await prisma.workspace.findFirst({ where: { name: { contains: "amrobots", mode: "insensitive" } } })
  if (!workspace) throw new Error("AmRobots workspace not found")
  const embeddingProvider = new OpenRouterEmbeddingProvider()

  const roboticaCategoryId = await upsertCategory(workspace.id, "Robotica")
  const cablesCategoryId = await upsertCategory(workspace.id, "Cables")
  await prisma.flow.updateMany({
    where: { workspaceId: workspace.id, title: "ERROR 001" },
    data: { flowCategoryId: roboticaCategoryId },
  })

  // ── FAQs ───────────────────────────────────────────────────────────────
  const faqs = [
    {
      question: "Which robot do I need for my garden?",
      answer:
        "STORM comes in three versions, based on lawn size:\n" +
        "- STORM 2000 - up to 2,000 m2\n" +
        "- STORM 5000 - up to 5,000 m2\n" +
        "- STORM 6500 - up to 6,500 m2, with a triple vision camera at the front\n\n" +
        "All models cut a 28 cm width, at an adjustable height from 3 to 8.5 cm, and handle slopes up to 45%.",
    },
    {
      question: "How can I clean my robot?",
      answer:
        "Wipe the body and camera lenses with a soft, dry or slightly damp cloth — never use a hose or " +
        "pressure washer, and never submerge the robot. Brush off grass clippings from the underside and " +
        "blades after each session. Never clean the robot while it is powered on.",
    },
    {
      question: "Can my robot work in the rain?",
      answer:
        "STORM is built to handle light rain and damp grass, but for the camera-based navigation to work " +
        "reliably, avoid heavy rain or fog when possible. In storms, the robot returns to its charging " +
        "station automatically.",
    },
  ]
  for (const faq of faqs) {
    const existing = await prisma.fAQ.findFirst({ where: { workspaceId: workspace.id, question: faq.question } })
    if (existing) {
      await prisma.fAQ.update({ where: { id: existing.id }, data: { answer: faq.answer } })
    } else {
      await prisma.fAQ.create({ data: { workspaceId: workspace.id, question: faq.question, answer: faq.answer, isActive: true } })
    }
    console.log(`FAQ ready: "${faq.question}"`)
  }

  // ── Flow 002 — Critical overheating (branches to 003 on "unusual noise") ──
  const flow003Existing = await prisma.flow.findFirst({ where: { workspaceId: workspace.id, title: "ERROR 003" } })
  // 002 needs 003's id to link to it — create 003's row first (empty), fill both graphs after.
  const flow003Id = (flow003Existing ?? (await createFlow(workspace.id, roboticaCategoryId, "ERROR 003", "The robot displays ERROR 003 / makes an unusual noise while operating."))).id

  await upsertFlow(
    workspace.id,
    "ERROR 002",
    "The robot displays ERROR 002 / error code 002 on its display — critical overheating.",
    [
      { id: "e002_hot_light", question: "È accesa una luce rossa fissa sul robot?", positionX: 0, positionY: 0, terminalType: null },
      { id: "e002_noise", question: "Il robot fa anche un rumore strano mentre lavora?", positionX: 280, positionY: 0, terminalType: null },
      { id: "e002_cooldown", question: "Hai lasciato il robot spento e all'ombra per almeno 15 minuti — la luce rossa si è spenta?", positionX: 560, positionY: -80, terminalType: null },
      { id: "e002_ok", question: "Perfetto, il surriscaldamento era temporaneo. Riavvia il robot e riprova — se il problema si ripete spesso, evita di farlo lavorare nelle ore più calde della giornata.", positionX: 840, positionY: -80, terminalType: "SELF_SERVICE" },
      { id: "e002_escalate", question: "Il surriscaldamento non si risolve da solo, meglio farlo controllare da un tecnico.", positionX: 840, positionY: 80, terminalType: "ESCALATE" },
    ],
    [
      { id: "e002_e_light_yes", sourceNodeId: "e002_hot_light", targetNodeId: "e002_noise", label: "Sì" },
      { id: "e002_e_light_no", sourceNodeId: "e002_hot_light", targetNodeId: "e002_escalate", label: "No" },
      // The exact branch Andrea asked for: an unusual-noise answer inside the
      // overheating flow hands over to the dedicated 003 flow instead of
      // guessing at a noise diagnosis it has no procedure for.
      { id: "e002_e_noise_yes", sourceNodeId: "e002_noise", targetNodeId: null, targetFlowId: flow003Id, label: "Sì" },
      { id: "e002_e_noise_no", sourceNodeId: "e002_noise", targetNodeId: "e002_cooldown", label: "No" },
      { id: "e002_e_cool_yes", sourceNodeId: "e002_cooldown", targetNodeId: "e002_ok", label: "Sì" },
      { id: "e002_e_cool_no", sourceNodeId: "e002_cooldown", targetNodeId: "e002_escalate", label: "No" },
    ],
    embeddingProvider,
    roboticaCategoryId,
  )

  // ── Flow 003 — Unusual noise ────────────────────────────────────────────
  await upsertFlow(
    workspace.id,
    "ERROR 003",
    "The robot displays ERROR 003 / makes an unusual noise while operating.",
    [
      { id: "e003_where", question: "Il rumore viene dalla parte inferiore del robot (lame) o da un'altra parte?", positionX: 0, positionY: 0, terminalType: null },
      { id: "e003_debris", question: "Hai controllato se ci sono rametti, sassi o altri oggetti incastrati vicino alle lame?", positionX: 280, positionY: -80, terminalType: null },
      { id: "e003_clear", question: "Rimuovi con cautela a robot spento qualsiasi oggetto incastrato, poi riavvia il robot. Se il rumore continua, contattaci di nuovo.", positionX: 560, positionY: -80, terminalType: "SELF_SERVICE" },
      { id: "e003_escalate", question: "Questo tipo di rumore va controllato da un tecnico, meglio non continuare a farlo lavorare.", positionX: 560, positionY: 80, terminalType: "ESCALATE" },
    ],
    [
      { id: "e003_e_where_blades", sourceNodeId: "e003_where", targetNodeId: "e003_debris", label: "Lame" },
      { id: "e003_e_where_other", sourceNodeId: "e003_where", targetNodeId: "e003_escalate", label: "Altra parte" },
      { id: "e003_e_debris_yes", sourceNodeId: "e003_debris", targetNodeId: "e003_clear", label: "Sì" },
      { id: "e003_e_debris_no", sourceNodeId: "e003_debris", targetNodeId: "e003_escalate", label: "No" },
    ],
    embeddingProvider,
    roboticaCategoryId,
  )

  // ── Flow 004 — Boundary wire not detected (category: Cables) ───────────
  await upsertFlow(
    workspace.id,
    "ERROR 004",
    "The robot displays ERROR 004 / error code 004 on its display — the robot cannot detect the boundary wire signal.",
    [
      { id: "e004_station_light", question: "La stazione di ricarica ha una luce accesa (di solito verde) che indica che il segnale del filo perimetrale è attivo?", positionX: 0, positionY: 0, terminalType: null },
      { id: "e004_wire_break", question: "Hai controllato tutto il perimetro del filo per punti visibilmente tagliati, tranciati (es. da un tagliaerba tradizionale o attrezzi da giardino) o scoperti dal terreno?", positionX: 280, positionY: -80, terminalType: null },
      { id: "e004_fix_break", question: "Se trovi un punto tagliato, unisci i due capi con un connettore stagno per esterni: il robot ora rileva il segnale?", positionX: 560, positionY: -160, terminalType: null },
      { id: "e004_ok", question: "Perfetto, il segnale del filo perimetrale è di nuovo attivo e il robot può riprendere a lavorare normalmente.", positionX: 840, positionY: -160, terminalType: "SELF_SERVICE" },
      { id: "e004_escalate", question: "Il segnale del filo perimetrale non si ripristina, serve un tecnico per verificare la stazione di ricarica e il circuito del filo.", positionX: 840, positionY: 80, terminalType: "ESCALATE" },
    ],
    [
      { id: "e004_e_light_no", sourceNodeId: "e004_station_light", targetNodeId: "e004_escalate", label: "No" },
      { id: "e004_e_light_yes", sourceNodeId: "e004_station_light", targetNodeId: "e004_wire_break", label: "Sì" },
      { id: "e004_e_break_yes", sourceNodeId: "e004_wire_break", targetNodeId: "e004_fix_break", label: "Sì" },
      { id: "e004_e_break_no", sourceNodeId: "e004_wire_break", targetNodeId: "e004_escalate", label: "No" },
      { id: "e004_e_fix_yes", sourceNodeId: "e004_fix_break", targetNodeId: "e004_ok", label: "Sì" },
      { id: "e004_e_fix_no", sourceNodeId: "e004_fix_break", targetNodeId: "e004_escalate", label: "No" },
    ],
    embeddingProvider,
    cablesCategoryId,
  )

  // ── Flow 005 — Robot crosses the boundary wire (category: Cables) ──────
  await upsertFlow(
    workspace.id,
    "ERROR 005",
    "The robot displays ERROR 005 / error code 005 on its display — the robot crosses the boundary wire instead of turning back.",
    [
      { id: "e005_how_far", question: "Il robot esce di poco oltre il filo (pochi centimetri) o continua dritto ignorandolo completamente?", positionX: 0, positionY: 0, terminalType: null },
      { id: "e005_sensitivity", question: "Hai provato ad aumentare la sensibilità di rilevamento del filo dalle impostazioni dell'app?", positionX: 280, positionY: -80, terminalType: null },
      { id: "e005_ok", question: "Ottimo, con la sensibilità aumentata il robot dovrebbe tornare a fermarsi correttamente sul filo. Se il filo passa vicino a masse metalliche o a un altro filo perimetrale, allontanalo per evitare che il problema si ripeta.", positionX: 560, positionY: -80, terminalType: "SELF_SERVICE" },
      { id: "e005_escalate", question: "Il robot continua a superare il filo perimetrale, serve un tecnico per controllare il ricevitore di segnale del robot.", positionX: 560, positionY: 80, terminalType: "ESCALATE" },
    ],
    [
      { id: "e005_e_far_ignores", sourceNodeId: "e005_how_far", targetNodeId: "e005_escalate", label: "Continua dritto" },
      { id: "e005_e_far_bit", sourceNodeId: "e005_how_far", targetNodeId: "e005_sensitivity", label: "Di poco" },
      { id: "e005_e_sens_yes", sourceNodeId: "e005_sensitivity", targetNodeId: "e005_ok", label: "Sì" },
      { id: "e005_e_sens_no", sourceNodeId: "e005_sensitivity", targetNodeId: "e005_escalate", label: "No" },
    ],
    embeddingProvider,
    cablesCategoryId,
  )

  // ── Flow 006 — Cable connector failure (category: Cables) ──────────────
  await upsertFlow(
    workspace.id,
    "ERROR 006",
    "The robot displays ERROR 006 / error code 006 on its display — cable connector failure at the boundary wire or charging station.",
    [
      { id: "e006_corrosion", question: "I connettori dove il filo si collega alla stazione di ricarica mostrano segni di corrosione, ruggine o ossidazione verde-bianca?", positionX: 0, positionY: 0, terminalType: null },
      { id: "e006_clean_step", question: "Pulisci i connettori con un panno asciutto e assicurati che siano inseriti a fondo e ben stretti: il messaggio di errore sparisce dopo un riavvio?", positionX: 280, positionY: -80, terminalType: null },
      { id: "e006_ok", question: "Perfetto, il problema era il connettore ossidato o allentato. Controllalo periodicamente, specialmente dopo piogge intense.", positionX: 560, positionY: -80, terminalType: "SELF_SERVICE" },
      { id: "e006_escalate", question: "Il connettore è danneggiato o il problema persiste, serve un tecnico per sostituirlo.", positionX: 560, positionY: 80, terminalType: "ESCALATE" },
    ],
    [
      { id: "e006_e_corr_yes", sourceNodeId: "e006_corrosion", targetNodeId: "e006_clean_step", label: "Sì" },
      { id: "e006_e_corr_no", sourceNodeId: "e006_corrosion", targetNodeId: "e006_escalate", label: "No" },
      { id: "e006_e_clean_yes", sourceNodeId: "e006_clean_step", targetNodeId: "e006_ok", label: "Sì" },
      { id: "e006_e_clean_no", sourceNodeId: "e006_clean_step", targetNodeId: "e006_escalate", label: "No" },
    ],
    embeddingProvider,
    cablesCategoryId,
  )

  console.log("Done.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
