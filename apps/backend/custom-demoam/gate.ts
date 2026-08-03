// Flow selection + pre-operator gate — the deterministic mechanisms behind
// steps.md's Step 2. Kept out of agent.ts so the gate logic is unit-testable
// in isolation, same reasoning as custom-demorobot/flow-selection.ts.

import { attachFlow, SessionState } from './state.js'
import { buildFlowGraph, rootNodeId } from './flow-machine.js'

export interface FlowSummary {
  flowId: string
  title: string
  hint?: string
  category?: string
}

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
  hash?: string
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

/** Renders the AVAILABLE FLOWS prompt block for the troubleshooting path (steps.md 2-C.3). */
export function formatFlowsBlock(flows: FlowSummary[]): string {
  if (!flows.length) {
    return [
      '',
      '═══ AVAILABLE FLOWS ═══',
      'No troubleshooting flows are configured for this workspace. You have NO',
      'procedure to follow: do not invent one. Go straight to the pre-operator',
      'checks and then escalate_to_operator.',
    ].join('\n')
  }

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
  const hasUsefulGrouping = named.length > 1 || (named.length === 1 && uncategorised.length > 0)
  if (!hasUsefulGrouping) {
    lines.push(...flows.map(renderFlow))
  } else {
    for (const [category, group] of named) {
      lines.push(`**${category}**`, ...group.map(renderFlow), '')
    }
    if (uncategorised.length > 0) {
      lines.push('**General checks**', ...uncategorised.map(renderFlow), '')
    }
    if (lines[lines.length - 1] === '') lines.pop()
  }

  return [
    '',
    '═══ AVAILABLE FLOWS ═══',
    'These are the ONLY troubleshooting procedures you may follow. As soon as you',
    "can tell which one matches the customer's problem, call start_flow with its",
    'id exactly as written in square brackets. Its questions then become your',
    'script: ask them one at a time, following the branches.',
    '',
    ...lines,
    '',
    "If NONE of these matches the customer's problem, say so honestly and go",
    'straight to the pre-operator checks. NEVER pick a flow that does not fit',
    'just to have something to say, and NEVER invent diagnostic questions of',
    'your own.',
  ].join('\n')
}

/**
 * start_flow handler. Attaches the flow the LLM selected, but only if its id
 * appears in the catalogue this turn (tool refuses, LLM corrects).
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
          ? `"${flowId}" is not in AVAILABLE FLOWS. Use one of: ${available.map((f) => f.flowId).join(', ')}. If none of them matches, go straight to the pre-operator checks — never invent a procedure.`
          : 'No flows are configured for this workspace. Go straight to the pre-operator checks.',
    }
  }

  if (!ctx.loadFlow) {
    return {
      ok: false,
      error: 'flow_loading_unavailable',
      instruction: 'Flows cannot be loaded right now. Go straight to the pre-operator checks.',
    }
  }

  try {
    const loaded = await ctx.loadFlow({ workspaceId: ctx.workspaceId, flowId })
    if (!loaded?.nodes?.length) {
      return {
        ok: false,
        error: 'flow_unavailable',
        instruction: 'That flow could not be loaded. Go straight to the pre-operator checks rather than answering from your own knowledge.',
      }
    }

    const graph = { nodes: loaded.nodes, rootNodeId: rootNodeId(buildFlowGraph(loaded.nodes)) }
    attachFlow(ctx.sessionId, flowId, loaded.hash ?? '', graph)
    const match = available.find((f) => f.flowId === flowId)
    return { ok: true, flow_id: flowId, title: match?.title }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[demoam] loadFlow failed', err)
    return {
      ok: false,
      error: 'flow_unavailable',
      instruction: 'That flow could not be loaded. Go straight to the pre-operator checks.',
    }
  }
}

// ── Intake: the questions the code asks, not the LLM ───────────────────────
// Andrea 2026-08-04, seen live on the first demoam conversation: while the
// case was being collected the model improvised its own probing question
// ("quando hai notato che il taglio non è più buono? all'improvviso o
// gradualmente?") instead of asking for the serial number. Same lesson as
// demorobot's intake gate: a prompt rule is a request, dictating the question
// text is a guarantee. While no flow is attached and the case is incomplete,
// the code fixes WHICH question is asked (from gateQuestions, DB-owned
// wording) and the LLM only translates it.

export interface IntakeStep {
  field: 'serialNumber' | 'problemDescription' | 'problemStartedWhen'
  /** Verbatim question. The LLM renders it in the customer's language. */
  question: string
}

const INTAKE_ORDER: IntakeStep['field'][] = [
  'serialNumber',
  'problemDescription',
  'problemStartedWhen',
]

/**
 * The next intake question, or null when intake is complete — either because
 * everything is answered, or because the workspace has not configured a
 * question for the missing field (nothing to ask, so nothing is asked —
 * fails toward silence, CLAUDE.md §1A).
 */
export function nextIntakeStep(
  state: SessionState,
  questions?: GateQuestions | null,
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
 * now, dictated verbatim so it cannot improvise a probing question or a menu
 * of invented causes. Returns null when intake is complete or unconfigured.
 */
export function formatIntakeBlock(
  step: IntakeStep | null,
  opts: { withGreeting?: boolean } = {},
): string | null {
  if (!step) return null

  // "Whole reply, nothing else" beat the WELCOME instruction when both were
  // injected (seen live 2026-08-04: the greeting was skipped on some first
  // turns but not others — same build, same config). When a greeting is due
  // the dictated reply IS greeting + question, stated here explicitly so the
  // two blocks can never contradict each other.
  const replyShape = opts.withGreeting
    ? [
        'Your reply has EXACTLY two parts, in this order:',
        '1. The WELCOME greeting dictated in the RUNTIME block above.',
        '2. This question.',
        'Nothing else after it.',
      ]
    : [
        "Translate it into the customer's language and send it as your whole reply.",
      ]

  return [
    '## THE QUESTION TO ASK NOW',
    '',
    'This overrides every other instruction in this prompt, including anything',
    'above about what to collect or in which order. Ask THIS question, verbatim,',
    'and nothing else:',
    '',
    step.question,
    '',
    ...replyShape,
    'Do NOT add other questions, do NOT offer options or possible causes, and',
    'do NOT rephrase it into a multiple-choice list. A brief acknowledgement of',
    'what the customer just said may come first, then this question.',
    '',
    `When they answer, save it with remember({key:'${step.field}', value:'...'}).`,
    '',
    'BUT FIRST: if the customer has ALREADY given this information anywhere in',
    'the conversation — including their very first message (an error code IS',
    'the problem description) — do NOT ask again: call remember with it NOW.',
    'The tool result will tell you what comes next.',
    '',
    'This applies to TECHNICAL PROBLEMS. Skip it entirely and answer directly',
    'when:',
    '- a FAQ answers what the customer asked — reply from the FAQ, no intake;',
    '- they are not reporting a fault at all (a greeting, a thank you, a',
    '  general question) — answer normally;',
    '- it is a COMPLAINT about something that already happened — call',
    '  escalate_to_operator, which dictates what to collect;',
    '- what they said matches a flow in AVAILABLE FLOWS — call start_flow and',
    '  follow that flow from its first step;',
    '- it is an emergency — escalate immediately.',
  ].join('\n')
}

// ── Pre-operator gate — one gate, from every road ───────────────────────────
// steps.md "Gate pre-operatore (condiviso da A e C)": complaint (2-A) and
// troubleshooting-with-no-match / ESCALATE-terminal (2-C) both fund into this
// SAME ordered gate — one definition, matching the pattern already in
// production in custom-demorobot (flow-runtime.md §8 "one gate, from every
// road"). Data in a table is not a guarantee; a gate in the tool is.

export type PreOperatorField =
  | 'serialNumber'
  | 'problemDescription'
  | 'robotPoweredOn'
  | 'wifiActive'
  | 'cutSchedulingActive'
  | 'batterySufficient'
  | 'name'

export interface PreOperatorStep {
  field: PreOperatorField
  question: string
}

/**
 * The order confirmed with Andrea (2026-08-03, steps.md): serial number,
 * problem description, then the three technical checks, battery last among
 * the technical checks, name last of all — so the customer is not asked for
 * personal details before we know whether the problem is self-fixable.
 */
const PRE_OPERATOR_ORDER: PreOperatorField[] = [
  'serialNumber',
  'problemDescription',
  'robotPoweredOn',
  'wifiActive',
  'cutSchedulingActive',
  'batterySufficient',
  'name',
]

function preOperatorAnswered(state: SessionState, field: PreOperatorField): boolean {
  if (field === 'name') return !!state.name?.trim()
  if (field === 'serialNumber') return !!state.serialNumber?.trim()
  return state.collectedData?.[field] !== undefined
}

export interface GateQuestions {
  serialNumber?: string | null
  problemDescription?: string | null
  /** Intake-only (steps.md 2-C.2): asked while collecting the case, not part of the 7-field gate. */
  problemStartedWhen?: string | null
  robotPoweredOn?: string | null
  wifiActive?: string | null
  cutSchedulingActive?: string | null
  batterySufficient?: string | null
  name?: string | null
}

/**
 * The next unanswered pre-operator check, or null when the gate is satisfied.
 *
 * `askedCounts` carries how many times each field has already been requested.
 * A field asked more than `maxAsks` times is skipped — the customer either
 * cannot or will not answer it, and blocking access to a human over an
 * unanswered checkbox is worse than a thinner briefing. Counted, never
 * phrase-detected (CLAUDE.md §14).
 *
 * When `skipTechnical` is set (the FAQ-not-found short-circuit, steps.md
 * 2-B.3), only `name` is asked — serial/description/the three checks are
 * skipped entirely, not merely deprioritised, because there is no technical
 * case to diagnose in that path.
 */
export function nextPreOperatorStep(
  state: SessionState,
  questions: GateQuestions | null | undefined,
  askedCounts: Readonly<Record<string, number>> | undefined,
  opts: { maxAsks?: number; skipTechnical?: boolean } = {},
): PreOperatorStep | null {
  const { maxAsks = 2, skipTechnical = false } = opts
  const order = skipTechnical ? (['name'] as PreOperatorField[]) : PRE_OPERATOR_ORDER

  for (const field of order) {
    if (preOperatorAnswered(state, field)) continue

    const question = questions?.[field]?.trim()
    if (!question) continue

    if ((askedCounts?.[field] ?? 0) >= maxAsks) continue

    return { field, question }
  }
  return null
}

export function formatPreOperatorInstruction(step: PreOperatorStep): string {
  return [
    'Before handing over to an operator, one check is still missing.',
    "Ask THIS question, verbatim, translated into the customer's language, and nothing else:",
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

// ── Flow step: the node IS the state ────────────────────────────────────────
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
