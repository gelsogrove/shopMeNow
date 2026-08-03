// Flow selection — the catalogue the LLM picks from, and the tool that
// attaches its choice.
//
// Andrea 2026-08-02: selection used to be embedding search. In production it
// scored 0.23-0.31 against a 0.70 threshold and got worse every turn (it
// searched the latest message — "IERI", "IMMBOLE" — not the problem), so no
// flow was ever attached and the model invented diagnostics to fill the gap.
// The flows are now listed in the prompt and the LLM attaches one by id.
//
// Kept out of agent.ts so it can be unit-tested directly: agent.ts is an ESM
// module (import.meta.url) that Jest cannot load, and this is the logic that
// decides whether the bot follows a real procedure or improvises one.

import { attachFlow, SessionState } from './state.js'
import { buildFlowGraph, rootNodeId } from './flow-machine.js'

export interface FlowSummary {
  flowId: string
  title: string
  /** Optional extra matching signal (description / keywords) when configured. */
  hint?: string
  /** Category the flow belongs to. Absent for workspace-generic flows. */
  category?: string
}

// The graph shape needed at runtime by flow-machine.ts's advance(): just
// enough of FlowNode/FlowEdge (schema.prisma) to know the current question
// and where each answer leads. Mirrors CompilerFlowNode/CompilerFlowEdge in
// flow-compiler.types.ts, but this is the RUNTIME read shape (loadFlow's
// select), not the compiler's write/validate shape.
export interface FlowGraphNode {
  id: string
  question: string
  fieldKey?: string | null
  terminalType?: string | null
}

export interface FlowGraphEdge {
  label: string
  targetNodeId: string | null
  triggersEscalation?: boolean
}

export interface LoadedFlow {
  compiledPrompt: string
  hash?: string
  /**
   * The flow's graph, keyed by node id, each with its outgoing edges already
   * attached. Optional: a loadFlow handler that doesn't supply it (an older
   * host, or a test double) keeps working exactly as before — the flow
   * attaches from compiledPrompt alone, currentNodeId just never gets set.
   */
  nodes?: Array<FlowGraphNode & { outgoingEdges: FlowGraphEdge[] }>
}

export type ListFlowsHandler = (params: { workspaceId: string }) => Promise<FlowSummary[]>
export type LoadFlowHandler = (params: { workspaceId: string; flowId: string }) => Promise<LoadedFlow | null>

export interface StartFlowContext {
  sessionId: string
  workspaceId: string
  availableFlows?: FlowSummary[]
  loadFlow?: LoadFlowHandler
}

export interface StartFlowResult {
  ok: boolean
  [k: string]: unknown
}

/**
 * Renders the AVAILABLE FLOWS prompt block: the only procedures the model may
 * follow, each with the id it must pass to start_flow.
 */
export function formatFlowsBlock(flows: FlowSummary[]): string {
  if (!flows.length) {
    return [
      '',
      '═══ AVAILABLE FLOWS ═══',
      'No diagnostic flows are configured for this workspace. You therefore have',
      'NO procedure to follow: do not invent one. Gather what the customer says',
      'and call escalate_to_operator.',
    ].join('\n')
  }

  // Grouped by category, so the model can narrow down by area before matching
  // a title. Flows without one are listed last under "Other" rather than
  // hidden — a missing category must never make a procedure unreachable.
  const byCategory = new Map<string, FlowSummary[]>()
  for (const flow of flows) {
    const key = flow.category?.trim() || ''
    const bucket = byCategory.get(key)
    if (bucket) bucket.push(flow)
    else byCategory.set(key, [flow])
  }

  const named = [...byCategory.entries()].filter(([k]) => k !== '').sort(([a], [b]) => a.localeCompare(b))
  const uncategorised = byCategory.get('') ?? []

  const renderFlow = (f: FlowSummary) => `- [${f.flowId}] ${f.title}${f.hint ? ` — ${f.hint}` : ''}`

  const lines: string[] = []
  // Headings only earn their tokens when they actually separate something:
  // with no categories at all, or with everything under one, the flat list
  // carries the same information without the noise.
  const hasUsefulGrouping = named.length > 1 || (named.length === 1 && uncategorised.length > 0)
  if (!hasUsefulGrouping) {
    lines.push(...flows.map(renderFlow))
  } else {
    for (const [category, group] of named) {
      lines.push(`**${category}**`, ...group.map(renderFlow), '')
    }
    if (uncategorised.length > 0) {
      // Flows with no category are the workspace-generic fallbacks: the basic
      // checks to run when no specific procedure matches. Labelled as such so
      // the model reaches for them instead of escalating on the spot.
      lines.push(
        '**General checks (use when no specific flow matches, before escalating)**',
        ...uncategorised.map(renderFlow),
        '',
      )
    }
    if (lines[lines.length - 1] === '') lines.pop()
  }

  return [
    '',
    '═══ AVAILABLE FLOWS ═══',
    'These are the ONLY diagnostic procedures you may follow. As soon as you can',
    "tell which one matches the customer's problem, call start_flow with its id",
    'exactly as written in square brackets. Its questions then become your script:',
    'ask them one at a time, in the order given, and follow the Yes/No branches.',
    '',
    ...lines,
    '',
    "If NONE of these matches the customer's problem, say honestly that you have no",
    'procedure for it and call escalate_to_operator. NEVER pick a flow that does not',
    'fit just to have something to say, and NEVER invent diagnostic questions of your',
    'own — the questions you ask must come from the ACTIVE FLOW block, nowhere else.',
  ].join('\n')
}

/**
 * start_flow handler. Attaches the flow the LLM selected, but only if its id
 * appears in the catalogue this turn — a hallucinated id is refused with
 * instructions rather than silently attaching nothing (iron rule: tool
 * refuses, LLM corrects).
 */
export async function startFlow(
  ctx: StartFlowContext,
  args: Record<string, unknown>,
): Promise<StartFlowResult> {
  const flowId = typeof args.flowId === 'string' ? args.flowId.trim() : ''
  if (!flowId) return { ok: false, error: 'flowId is required' }

  const available = ctx.availableFlows ?? []
  if (!available.some((f) => f.flowId === flowId)) {
    return {
      ok: false,
      error: 'unknown_flow_id',
      instruction:
        available.length > 0
          ? `"${flowId}" is not in AVAILABLE FLOWS. Use one of: ${available.map((f) => f.flowId).join(', ')}. If none of them matches the customer's problem, call escalate_to_operator instead — never invent a procedure.`
          : 'No flows are configured for this workspace. Call escalate_to_operator.',
    }
  }

  if (!ctx.loadFlow) {
    return {
      ok: false,
      error: 'flow_loading_unavailable',
      instruction: 'Flows cannot be loaded right now. Call escalate_to_operator.',
    }
  }

  try {
    const loaded = await ctx.loadFlow({ workspaceId: ctx.workspaceId, flowId })
    // An empty compiledPrompt would attach a blank script and leave the model
    // to fill the silence — production had exactly such a flow ("err 02").
    if (!loaded?.compiledPrompt?.trim()) {
      return {
        ok: false,
        error: 'flow_unavailable',
        instruction:
          'That flow could not be loaded. Call escalate_to_operator rather than answering from your own knowledge.',
      }
    }

    // Freeze the graph at attach time, same guarantee as compiledPrompt: a
    // later edit in the builder must not change an in-progress conversation.
    // Absent when loadFlow didn't supply nodes (older host, or a flow saved
    // before nodes/edges existed) — the flow then runs off compiledPrompt
    // alone, currentNodeId never gets set, exactly as before this change.
    const graph =
      loaded.nodes && loaded.nodes.length > 0
        ? { nodes: loaded.nodes, rootNodeId: rootNodeId(buildFlowGraph(loaded.nodes)) }
        : undefined

    attachFlow(ctx.sessionId, flowId, loaded.hash ?? '', loaded.compiledPrompt, graph)
    const match = available.find((f) => f.flowId === flowId)
    return { ok: true, flow_id: flowId, title: match?.title }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[demorobot] loadFlow failed', err)
    return {
      ok: false,
      error: 'flow_unavailable',
      instruction: 'That flow could not be loaded. Call escalate_to_operator.',
    }
  }
}

// ── Intake: the questions the code asks, not the LLM ───────────────────────
// Andrea 2026-08-03: telling the model "don't invent questions" is a request,
// not a guarantee — it kept improvising menus of made-up causes ("does it move
// but the blades don't spin?") while no flow was attached and it had no script
// to follow. Prompt rules reduce the odds; they cannot remove the freedom.
//
// So the freedom is removed instead: while intake is incomplete and no flow is
// running, the QUESTION TEXT is fixed here and the LLM only translates it. It
// cannot offer options it invented, because it is not composing the question.

export interface IntakeStep {
  /** SessionState/collectedData key this step fills. */
  field: 'serialNumber' | 'problemDescription' | 'problemStartedWhen'
  /** Verbatim question. The LLM renders it in the customer's language. */
  question: string
}

/**
 * Intake questions, configured per workspace.
 *
 * Andrea 2026-08-03: these used to be string literals in this file — including
 * "19 characters starting with HK", which is AmRobots' domain hardcoded into
 * the module. The wording now comes from the workspace (editable in the app,
 * written in one language and translated by the LLM).
 *
 * The MECHANISM stays in code: while intake is incomplete the question text is
 * fixed and the model only translates it, so it cannot improvise a menu of
 * invented causes. What is configurable is the wording, not the guarantee.
 */
export interface IntakeQuestions {
  serialNumber?: string | null
  problemDescription?: string | null
  problemStartedWhen?: string | null
  /** Pre-operator checks — see PreOperatorField / nextPreOperatorStep below. */
  name?: string | null
  robotPoweredOn?: string | null
  wifiActive?: string | null
  cutSchedulingActive?: string | null
}

const INTAKE_ORDER: IntakeStep['field'][] = [
  'serialNumber',
  'problemDescription',
  'problemStartedWhen',
]

/**
 * The next intake question, or null when intake is complete — either because
 * everything is answered, or because the workspace has not configured a
 * question for the missing field (nothing to ask, so nothing is asked).
 *
 * Returns the FIRST unanswered step, so questions always come in the same
 * order and nothing is asked twice.
 */
export function nextIntakeStep(
  state: SessionState,
  questions?: IntakeQuestions | null,
): IntakeStep | null {
  for (const field of INTAKE_ORDER) {
    const answered =
      field === 'serialNumber'
        ? !!state.serialNumber?.trim()
        : !!state.collectedData?.[field]
    if (answered) continue

    const question = questions?.[field]?.trim()
    return question ? { field, question } : null
  }
  return null
}

/**
 * Renders the intake instruction: the ONE question the model may ask right
 * now, dictated verbatim so it cannot improvise a menu of invented causes.
 *
 * Returns null when intake is complete or unconfigured — the model then works
 * from the flows, the FAQ and the operating rules as usual.
 */
export function formatIntakeBlock(step: IntakeStep | null): string | null {
  if (!step) return null

  return [
    '## THE QUESTION TO ASK NOW',
    '',
    'This overrides every other instruction in this prompt, including anything',
    'above about what to collect or in which order. Ask THIS question, verbatim,',
    'and nothing else:',
    '',
    step.question,
    '',
    "Translate it into the customer's language and send it as your whole reply.",
    'Do NOT add other questions, do NOT offer options or possible causes, and',
    'do NOT rephrase it into a multiple-choice list. A brief acknowledgement of',
    'what the customer just said may come first, then this question.',
    '',
    `When they answer, save it with remember({key:'${step.field}', value:'...'}).`,
    '',
    'This applies to TECHNICAL PROBLEMS. Skip it entirely and answer directly',
    'when:',
    '- a FAQ answers what the customer asked — reply from the FAQ, no intake;',
    '- they are not reporting a fault at all (a greeting, a thank you, a',
    '  general question) — answer normally;',
    '- what they said matches a flow in AVAILABLE FLOWS — call start_flow and',
    '  follow that flow from its first step;',
    '- it is an emergency — escalate immediately.',
  ].join('\n')
}

// ── Pre-operator gate ──────────────────────────────────────────────────────
// Andrea 2026-08-03: the three basic checks (robot powered on / Wi-Fi active /
// cut scheduling active) must be answered on EVERY route to an operator, not
// only when no flow matched. Before this, the gate in executeTool asked for
// name + serial + description + when, so an escalation coming from inside a
// specific flow reached the operator without any of the three — and the
// operator's first message back to the customer was always one of them.
//
// Deliberately NOT a "general flow" in the database: a flow attaches INSTEAD
// of another flow, so a conversation already inside a specific procedure would
// never run it — exactly the case this must cover. Data in a table is also not
// a guarantee; a gate in the tool is (iron rule 1: fix in code, not prompt).
//
// Same division of labour as intake: the code decides WHICH question is due
// (mechanism), settings.json / the workspace decides its WORDING (content),
// the LLM only translates it (CLAUDE.md §1A).

export type PreOperatorField =
  | 'robotPoweredOn'
  | 'wifiActive'
  | 'cutSchedulingActive'
  | 'name'

export interface PreOperatorStep {
  field: PreOperatorField
  /** Verbatim question. The LLM renders it in the customer's language. */
  question: string
}

/**
 * The order of the diagram: the three technical checks first, the name last —
 * so the customer is not asked for personal details before we know whether the
 * problem is one they can fix themselves.
 */
const PRE_OPERATOR_ORDER: PreOperatorField[] = [
  'robotPoweredOn',
  'wifiActive',
  'cutSchedulingActive',
  'name',
]

/** True when this field already has an answer in the session. */
function preOperatorAnswered(state: SessionState, field: PreOperatorField): boolean {
  if (field === 'name') return !!state.name?.trim()
  return state.collectedData?.[field] !== undefined
}

/**
 * The next unanswered pre-operator check, or null when the gate is satisfied.
 *
 * `askedCounts` carries how many times each field has already been requested.
 * A field asked more than `maxAsks` times is skipped: the customer either
 * cannot or will not answer it, and blocking access to a human over an
 * unanswered checkbox is worse than a thinner briefing. Counted, never
 * phrase-detected, so "no", "non lo so" and silence behave identically
 * (CLAUDE.md §14).
 *
 * Per-field rather than one global counter: with seven fields in total, a
 * single shared counter meant one ignored question opened the gate for all of
 * them, and the operator inherited an empty ticket.
 *
 * A field with no configured wording is treated as satisfied — there is
 * nothing to ask, so the gate must not deadlock on it (fails towards silence,
 * same rule as intake).
 */
export function nextPreOperatorStep(
  state: SessionState,
  questions?: IntakeQuestions | null,
  askedCounts?: Readonly<Record<string, number>>,
  maxAsks = 2,
): PreOperatorStep | null {
  for (const field of PRE_OPERATOR_ORDER) {
    if (preOperatorAnswered(state, field)) continue

    const question = questions?.[field]?.trim()
    if (!question) continue

    if ((askedCounts?.[field] ?? 0) >= maxAsks) continue

    return { field, question }
  }
  return null
}

/**
 * The instruction returned to the LLM when escalate_to_operator is refused:
 * the ONE question still owed before the hand-off, dictated verbatim.
 *
 * Mirrors formatIntakeBlock — the model translates, it does not compose, so it
 * cannot turn "is the robot powered on?" into a menu of invented causes.
 */
export function formatPreOperatorInstruction(step: PreOperatorStep): string {
  return [
    'Before handing over to an operator, one check is still missing.',
    'Ask THIS question, verbatim, translated into the customer\'s language, and nothing else:',
    '',
    step.question,
    '',
    'Do NOT add other questions, do NOT offer options or possible causes, and do NOT',
    'rephrase it as a multiple-choice list. A brief acknowledgement of what the customer',
    'just said may come first, then this question.',
    '',
    `When they answer, save it with remember({key:'${step.field}', value:'...'}), then call`,
    'escalate_to_operator again IN THE SAME TURN as that answer.',
    'Never end a turn having only saved the answer: the hand-off must still happen.',
  ].join('\n')
}

// ── Flow step: the node IS the state, not something re-inferred ────────────
// Andrea 2026-08-03 (flow-runtime.md §4-5): once a flow is attached and
// currentNodeId is set, the model must not see the whole compiledPrompt and
// re-derive its position from prose + history every turn — that re-derivation
// is exactly the mechanism behind the documented production bug ("le lame
// girano normalmente?", a question that existed in no node). Instead it gets
// ONE question, dictated verbatim by the code from the frozen graph, the same
// pattern as formatIntakeBlock — the model translates, it does not compose.

/**
 * The ONE question due right now, plus the answer_step instruction. Returns
 * null when the node has no outgoing edges (a terminal — nothing to ask,
 * agent.ts routes by terminalType instead) or when `labels` is empty for a
 * non-terminal node (a compiler-validation gap, not a case to paper over here).
 */
export function formatFlowStepBlock(question: string, labels: string[]): string | null {
  if (labels.length === 0) return null

  return [
    '## THE QUESTION TO ASK NOW',
    '',
    'This overrides every other instruction about the flow, including anything',
    "you might infer from the conversation history. Ask THIS question, verbatim,",
    "translated into the customer's language, and nothing else:",
    '',
    question,
    '',
    'Do NOT add other questions and do NOT invent options — the only valid',
    `answers right now are: ${labels.join(' | ')}. These are internal`,
    'identifiers for classification, not necessarily the exact words to show',
    'the customer — phrase the question naturally.',
    '',
    `When they answer, call answer_step with exactly one of: ${labels.join(' | ')}.`,
    'If what they say does not clearly match one of these, do NOT guess — ask a',
    'brief clarifying question about the SAME thing instead of moving on.',
    '',
    'If the customer clearly changes subject to something unrelated to this',
    'flow, call abandon_flow instead of forcing an answer to the question above.',
  ].join('\n')
}
