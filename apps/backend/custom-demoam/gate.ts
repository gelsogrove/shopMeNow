// Flow selection + pre-operator gate — the deterministic mechanisms behind
// steps.md's Step 2. Kept out of agent.ts so the gate logic is unit-testable
// in isolation, same reasoning as custom-demorobot/flow-selection.ts.

import { attachFlow, getState, hasVisitedFlow, SessionState } from './state.js'
import { allowedLabels, buildFlowGraph, currentNode, rootNodeId } from './flow-machine.js'
import { PRE_OPERATOR_MAX_ASKS } from './bounds.js'

export interface FlowSummary {
  flowId: string
  title: string
  hint?: string
  category?: string
}

/** Node media from the flow builder (Asset): url/type/title only — the snapshot is persisted per session and must stay light. */
export interface FlowNodeMedia {
  url: string
  type: string
  title: string
}

export interface FlowGraphNode {
  id: string
  question: string
  fieldKey?: string | null
  terminalType?: string | null
  attachments?: FlowNodeMedia[]
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
  currentMessage?: string
  gateQuestions?: GateQuestions | null
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

const ERROR_CODE_RE = /\b(?:error|errore)\s*0*(\d+)\b/i

function extractErrorCode(text: string | undefined): string | null {
  if (!text) return null
  const match = text.match(ERROR_CODE_RE)
  return match ? match[1] : null
}

/**
 * start_flow handler. Attaches the flow the LLM selected, but only if its id
 * appears in the catalogue this turn (tool refuses, LLM corrects), and only if
 * an error code the customer mentioned does not contradict the flow's own
 * code (e.g. customer says "error 002", chosen flow's title/hint says "001").
 */
export async function startFlow(
  ctx: StartFlowContext,
  args: Record<string, unknown>,
): Promise<StartFlowResult> {
  const flowId = typeof args.flowId === 'string' ? args.flowId.trim() : ''
  if (!flowId) return { ok: false, error: 'flowId is required' }

  const available = ctx.availableFlows ?? []
  const match = available.find((f) => f.flowId === flowId)
  if (!match) {
    return {
      ok: false,
      error: 'unknown_flow_id',
      instruction:
        available.length > 0
          ? `"${flowId}" is not in AVAILABLE FLOWS. Use one of: ${available.map((f) => f.flowId).join(', ')}. If none of them matches, go straight to the pre-operator checks — never invent a procedure.`
          : 'No flows are configured for this workspace. Go straight to the pre-operator checks.',
    }
  }

  // Andrea 2026-08-05, seen live: with the Human Support flow already
  // attached and a question pending on its current node, the model called
  // start_flow(ERROR_001) again instead of answering that question — ERROR
  // 001 got reattached mid-conversation, currentNodeId reset to ITS root, and
  // the two flows' questions interleaved from then on. A flow with a pending
  // node can only be advanced by answer_step or abandoned by abandon_flow;
  // start_flow is for attaching the FIRST flow of an incident, and for the
  // code-driven handoff in answer_step's own result.nextFlowId branch (which
  // calls startFlow directly, never through this tool-call path, so it never
  // hits this guard).
  if (getState(ctx.sessionId).currentNodeId) {
    return {
      ok: false,
      error: 'flow_already_active',
      dictates_text: true,
      instruction:
        `A flow is already running with a question pending — call answer_step with the customer's ` +
        `answer to THAT question, or abandon_flow if they clearly changed subject. Do not attach ` +
        `"${match.title}" on top of it.`,
    }
  }

  // Andrea 2026-08-05, seen live: ERROR 001 ran to its ESCALATE terminal and
  // was correctly detached — and the model immediately called start_flow on
  // that same flow again, restarting it from its root. From there it pretended
  // to follow it while inventing questions that exist in no node ("is the
  // robot in a cool shaded place?"). A flow already walked in this session is
  // exhausted: whatever it had to offer, the conversation already got it.
  // hasVisitedFlow already guarded the flow-to-flow handoff for exactly this
  // reason (A→B→A loops); a direct start_flow needs the same guard.
  if (hasVisitedFlow(ctx.sessionId, flowId)) {
    return {
      ok: false,
      error: 'flow_already_visited',
      instruction:
        `"${match.title}" has already been walked through in this conversation — it is exhausted, and ` +
        'restarting it would repeat questions the customer already answered. Call escalate_to_operator ' +
        'instead, and never invent extra diagnostic questions of your own.',
    }
  }

  // Andrea 2026-08-05, seen live: the model attached ERROR 001 on the very
  // first message ("il mio robot mi da errore 001") before ever asking for
  // the serial number — the case had a matching flow so start_flow won the
  // race against intake entirely. The case (serial, description, when) is
  // collected once, up front, regardless of which flow ends up handling it —
  // a flow attaching mid-intake is the same class of bug as a flow skipping
  // its own root node.
  const pendingIntake = nextIntakeStep(getState(ctx.sessionId), ctx.gateQuestions)
  if (pendingIntake) {
    return {
      ok: false,
      error: 'intake_incomplete',
      dictates_text: true,
      instruction:
        `The case is not fully collected yet — "${match.title}" cannot be attached before that. ` +
        formatIntakeBlock(pendingIntake),
    }
  }

  const customerErrorCode = extractErrorCode(ctx.currentMessage)
  const flowErrorCode = extractErrorCode(match.title) ?? extractErrorCode(match.hint)
  if (customerErrorCode && flowErrorCode && customerErrorCode !== flowErrorCode) {
    return {
      ok: false,
      error: 'flow_error_code_mismatch',
      instruction:
        `The customer mentioned error ${customerErrorCode}, but "${match.title}" is for error ` +
        `${flowErrorCode} — a different code. Do NOT attach this flow. Say honestly that you do not ` +
        'have a specific procedure for this error, and go straight to the pre-operator checks ' +
        '(call escalate_to_operator).',
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

    const builtGraph = buildFlowGraph(loaded.nodes)
    const graph = { nodes: loaded.nodes, rootNodeId: rootNodeId(builtGraph) }
    attachFlow(ctx.sessionId, flowId, loaded.hash ?? '', graph)

    // The root node's question is dictated HERE, in the tool result, not left
    // to the system prompt's step block alone.
    //
    // Andrea 2026-08-06, seen live on the widget: ERROR 001 was attached and
    // the model asked "is the robot powered on?" and then "did it overheat?"
    // — neither question exists in any node of that flow, whose root asks
    // "c'è una luce rossa accesa?". dictates_text:true only tells the runtime
    // to stop offering tools; without the text itself the model was free to
    // improvise, and did. A prompt block is a request; the tool result is
    // what the model is answering (CLAUDE.md §16).
    const root = graph.rootNodeId ? currentNode(builtGraph, graph.rootNodeId) : null
    const rootLabels = graph.rootNodeId ? allowedLabels(builtGraph, graph.rootNodeId) : []
    const rootBlock = root ? formatFlowStepBlock(root.question, rootLabels) : null

    return {
      ok: true,
      flow_id: flowId,
      title: match.title,
      dictates_text: true,
      ...(rootBlock ? { instruction: rootBlock } : {}),
    }
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
  if (state.skippedTechnicalGate) return null
  for (const field of INTAKE_ORDER) {
    // A serial exhausted after 3 failed attempts (content-guards.ts) is
    // "done asking", the same as answered — never re-requested here either,
    // same reasoning as preOperatorAnswered below.
    if (field === 'serialNumber' && state.serialNumberExhausted) continue
    // A field the invariant gave up on (INTAKE_MAX_DICTATED_ASKS dictated
    // asks without progress) is done asking too — see intakeGivenUpFields.
    if (state.intakeGivenUpFields?.includes(field)) continue

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
 * The intake question that MUST be the reply right now, or null.
 *
 * Non-null only when the conversation is demonstrably mid-intake on the
 * technical track: no flow node pending, at least one intake fact already on
 * record (serial saved or exhausted, or a problem description), and a next
 * intake field still missing. "On record" is read from STATE the customer's
 * own answers produced — never from classifying their text (CLAUDE.md §14),
 * which is also why a complaint or a pure FAQ chat (nothing recorded) can
 * never trip this.
 *
 * The caller treats a non-null return as the ENTIRE reply for the turn: the
 * question comes verbatim from settings.gateQuestions (rule 1A), and model
 * prose on these turns is dropped, not sent — asking the next question is
 * dictated by code, not hoped from the model (CONTRACT.md rules 2, 3, 7).
 */
/**
 * Technical evidence the customer's own answers put on record: a serial
 * (or its 3-failures exhaustion) or a problem description. Read from STATE,
 * never from classifying text (CLAUDE.md §14). Shared by the intake
 * invariant, the post-intake obligation, and the escalate shape guard —
 * one predicate, three consumers.
 */
export function intakeEvidenceOnRecord(state: SessionState): boolean {
  return (
    !!state.serialNumber?.trim() ||
    !!state.serialNumberExhausted ||
    state.collectedData?.problemDescription !== undefined
  )
}

export function midIntakePendingQuestion(
  state: SessionState,
  questions: GateQuestions | null | undefined,
): string | null {
  if (state.currentNodeId) return null
  if (!intakeEvidenceOnRecord(state)) return null
  return nextIntakeStep(state, questions)?.question?.trim() || null
}

/**
 * The question the CODE knows is outstanding right now — the active flow's
 * current node, or the next intake step, or nothing.
 *
 * Used when the model produced no usable reply (tool-hop limit) and the turn
 * still has to say something: re-asking what is genuinely pending is the only
 * answer that is true by construction. Null means nothing is outstanding, and
 * the caller must stay silent rather than compose a closing line of its own.
 */
export function pendingQuestionText(
  state: SessionState,
  settings: { gateQuestions?: GateQuestions | null },
): string | null {
  if (state.currentNodeId && state.activeFlowGraphSnapshot) {
    const node = currentNode(buildFlowGraph(state.activeFlowGraphSnapshot), state.currentNodeId)
    const question = node?.question?.trim()
    if (question) return question
  }

  return nextIntakeStep(state, settings.gateQuestions)?.question ?? null
}

/**
 * True when the missing intake field may ALREADY be answered somewhere in what
 * the customer has written, so the right move is to save it, not to ask for it.
 *
 * Andrea 2026-08-08, seen live: the opening message was "ho un errore 003, un
 * strano rumore nella parte dietro" — a complete problem description. That
 * turn is the greeting hop, which is forceTextOnly by design (it must produce
 * the welcome and nothing else), so `remember` did not exist on it and the
 * description was never saved. Two turns later the intake gate dictated
 * "can you briefly describe what's happening?" and the customer had to repeat
 * himself. Andrea: "non mi sembra naturale".
 *
 * Only problemDescription qualifies. A serial number is never inferable from
 * prose, and problemStartedWhen has its own question the customer answers
 * directly — but "what is wrong" is, in practice, the FIRST thing a customer
 * says, before anyone asks.
 *
 * Deterministic, and NOT phrase detection (CLAUDE.md §14): it inspects no
 * words, only whether the customer has written a message of any substance
 * before this hop. Judging whether that text actually describes the fault is
 * the model's job — the code merely stops offering "ask again" as the easy
 * default. validateProblemDescription still rejects whatever comes back if it
 * is too thin.
 */
const MIN_INFERABLE_DESCRIPTION_CHARS = 12

export function intakeFieldMayAlreadyBeAnswered(
  step: IntakeStep | null,
  customerMessages: ReadonlyArray<string>,
): boolean {
  if (step?.field !== 'problemDescription') return false
  return customerMessages.some((m) => m.trim().length >= MIN_INFERABLE_DESCRIPTION_CHARS)
}

/**
 * Renders the intake instruction: the ONE question the model may ask right
 * now, dictated verbatim so it cannot improvise a probing question or a menu
 * of invented causes. Returns null when intake is complete or unconfigured.
 *
 * `mayAlreadyBeAnswered` flips the block from "ask this" to "save what they
 * already said": the question stays available as the fallback, but re-asking
 * stops being the first thing the model reaches for.
 */
export function formatIntakeBlock(step: IntakeStep | null, mayAlreadyBeAnswered = false): string | null {
  if (!step) return null

  if (mayAlreadyBeAnswered) {
    return [
      '## SAVE WHAT THE CUSTOMER ALREADY TOLD YOU (mandatory, this hop only)',
      '',
      `The case still has no "${step.field}" on record, but the customer has`,
      'already written to you — and what is wrong is normally the very first',
      'thing they say, before anyone asks. Re-asking it is the single thing',
      'that most makes this conversation feel robotic.',
      '',
      'Re-read the conversation NOW, their opening message included. If they',
      'have said anything at all about what the robot is doing — an error code,',
      'a noise, a light, a movement, a smell, anything — that IS the problem',
      `description: call remember({key:'${step.field}', value:'...'}) with it,`,
      'in their own words, and do NOT ask them to describe it again.',
      '',
      'Only if they have genuinely said nothing about what is wrong, ask this',
      "question, verbatim, translated into the customer's language:",
      '',
      step.question,
      '',
      'Do NOT add other questions and do NOT offer possible causes.',
    ].join('\n')
  }

  const lines = [
    '## THE QUESTION TO ASK NOW (mandatory, this hop only — no tool call available)',
    '',
    'This overrides every other instruction in this prompt, including anything',
    'above about what to collect or in which order. This hop offers no tools —',
    'writing text is the ONLY thing you can do, and the text must be a',
    'translation of THIS question, verbatim, and nothing else:',
    '',
    step.question,
    '',
    "Translate it into the customer's language and send it as your whole reply.",
    'A DIFFERENT question — even a reasonable-sounding follow-up like "is the',
    'robot on or off?" — is not an option right now, no matter how relevant it',
    'seems: it is not the question on record, and asking it would silently skip',
    'this one. Do NOT add other questions, do NOT offer options or possible',
    'causes, and do NOT rephrase it into a multiple-choice list. A brief',
    'acknowledgement of what the customer just said may come first, then this',
    'question, verbatim.',
    '',
    'ONE exception: if the customer is explicitly asking for a human operator,',
    'or complaining about a past experience rather than reporting a device',
    'problem, this intake question does not apply to them — when a tool call',
    'is available this hop, call escalate_to_operator with the fitting reason',
    "('requested_operator' or 'complaint') instead of asking it, and let that",
    'tool dictate what to collect.',
  ]

  if (step.field === 'serialNumber') {
    lines.push(
      '',
      'Even if the customer has said very little about what is wrong (a vague ' +
        '"there is an error" with no code, no details), do NOT ask them to clarify the problem first. ' +
        'The serial number is always the very first question — ask it now, the problem gets clarified ' +
        'by the NEXT question (problem description), never before this one.',
    )
  }

  lines.push(
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
    '- a FAQ answers what the customer asked — call answer_from_faq, no intake;',
    '- they are not reporting a fault at all (a greeting, a thank you, a',
    '  general question) — answer normally;',
    '- it is a COMPLAINT about something that already happened — call',
    '  escalate_to_operator, which dictates what to collect;',
    '- what they said matches a flow in AVAILABLE FLOWS — call start_flow and',
    '  follow that flow from its first step;',
    '- it is an emergency — escalate immediately.',
  )

  return lines.join('\n')
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
  | 'problemStartedWhen'
  | 'robotPoweredOn'
  | 'wifiActive'
  | 'cutSchedulingActive'
  | 'batterySufficient'
  | 'name'

/**
 * What the incident needs before a human sees it.
 *
 * 'technical' — there is a device to diagnose: the full checklist.
 * 'no_device' — a complaint about something that already happened, a question
 * no FAQ answers, or a bare "put me through to a person" with no problem
 * described. Nothing to diagnose, so only the name, enough to greet them and
 * hand over.
 */
export type CaseShape = 'technical' | 'no_device'

export function caseShapeFor(reason: string): CaseShape {
  return reason === 'complaint' || reason === 'faq_not_found' || reason === 'requested_operator'
    ? 'no_device'
    : 'technical'
}

/**
 * The order confirmed with Andrea (2026-08-03, steps.md), narrowed
 * 2026-08-06: the four technical booleans (robotPoweredOn, wifiActive,
 * cutSchedulingActive, batterySufficient) are NOT here any more — they are
 * nodes of the Human Support flow, which asks them with real branches and a
 * corrective LOOP on "No". Asking them here too would put the same question
 * to the customer twice, from two different mechanisms.
 *
 * What stays is exactly what the flow engine cannot do:
 * - intake (serial, description, when) runs BEFORE any flow exists — it is
 *   what the flow is chosen from
 * - `name` is free text, and answer_step only classifies fixed edge labels
 *
 * Name last of all, so the customer is not asked for personal details before
 * we know whether the problem is self-fixable.
 */
const CHECKLIST: Record<CaseShape, PreOperatorField[]> = {
  technical: ['serialNumber', 'problemDescription', 'problemStartedWhen', 'name'],
  no_device: ['name'],
}

function preOperatorAnswered(state: SessionState, field: PreOperatorField): boolean {
  if (field === 'name') return !!state.name?.trim()
  // A serial exhausted after 3 failed attempts counts as answered: it will
  // never arrive, and blocking a customer out of a human over it is worse
  // than a briefing that says "not provided after 3 attempts".
  if (field === 'serialNumber') return !!state.serialNumber?.trim() || !!state.serialNumberExhausted
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
 * What the pre-operator gate wants to happen next. One ordered checklist,
 * scanned in order — the first field that still needs asking IS the next
 * question. No branches, no flags consumed along the way.
 *
 * PURE: this reads state, it never writes it. The caller applies the effects
 * (registerFieldRequest) AFTER acting on the returned action. Deciding and
 * mutating in the same step is what let a gate mark itself "already offered"
 * before the thing it was gating had actually happened — a whole family of
 * bugs (Andrea, 2026-08-05: the Human Support gate marked itself done, the
 * model ignored the instruction, and the name question landed on a customer
 * who had never been asked the technical checks).
 *
 * `askedCounts` carries how many times each field has already been requested.
 * A field asked `maxAsks` times is treated as done — the customer either
 * cannot or will not answer it, and blocking access to a human over an
 * unanswered checkbox is worse than a thinner briefing. Counted, never
 * phrase-detected (CLAUDE.md §14).
 */
export type PreOperatorAction =
  | { kind: 'ask'; field: PreOperatorField; question: string; isLastStep: boolean; alreadyAsked: boolean }
  | { kind: 'escalate' }

export function nextPreOperatorAction(
  state: SessionState,
  questions: GateQuestions | null | undefined,
  askedCounts: Readonly<Record<string, number>> | undefined,
  shape: CaseShape,
  opts: { maxAsks?: number } = {},
): PreOperatorAction {
  const { maxAsks = PRE_OPERATOR_MAX_ASKS } = opts
  const checklist = CHECKLIST[shape]

  const askable = (field: PreOperatorField): boolean => {
    if (preOperatorAnswered(state, field)) return false
    if (!questions?.[field]?.trim()) return false
    // The ask cap exists so an unanswered technical checkbox cannot block a
    // customer out of a human — a thinner briefing beats a dead end. `name`
    // is the one field that reasoning does not cover: CONTRACT.md rule 11
    // makes it the last thing asked before handing over, and the configured
    // hand-off message is written around it ("Thank you, {{customerName}}").
    // Capping it produced exactly that failure live (Andrea 2026-08-16): the
    // question was put as free text during a FAQ detour, counted as asked,
    // never answered, and the escalation went through with "Thank you, ."
    // and a briefing reading "Name: —".
    if (field !== 'name' && (askedCounts?.[field] ?? 0) >= maxAsks) return false
    return true
  }

  const idx = checklist.findIndex(askable)
  if (idx === -1) return { kind: 'escalate' }

  const field = checklist[idx]
  return {
    kind: 'ask',
    field,
    question: questions![field]!.trim(),
    isLastStep: !checklist.slice(idx + 1).some(askable),
    // Already put to the customer at least once and still not saved: the
    // answer may well be sitting unsaved in the transcript, so the caller
    // tells the model to save it rather than ask again. The ask cap above
    // is what stops this from looping.
    alreadyAsked: (askedCounts?.[field] ?? 0) > 0,
  }
}

export function formatPreOperatorInstruction(step: {
  field: string
  question: string
  /**
   * True only when the caller KNOWS no other check remains after this one
   * (nextPreOperatorAction computes this for the real gate). Defaults to
   * false — the safe assumption for intake steps, which are always followed
   * by the technical checks and are never actually the last thing before
   * the operator.
   */
  isLastStep?: boolean
}): string {
  return [
    step.isLastStep
      ? 'Before handing over to an operator, this is the LAST check still missing.'
      : 'Before handing over to an operator, a few checks are still missing — this is one of them, not the last.',
    "Ask THIS question, verbatim, translated into the customer's language, and nothing else:",
    '',
    step.question,
    '',
    'Do NOT add other questions, do NOT offer options or possible causes, and do NOT',
    'rephrase it as a multiple-choice list. A brief acknowledgement of what the customer',
    'just said may come first, then this question.',
    step.isLastStep
      ? "Do NOT say anything else — do NOT announce or promise the hand-off in this same message, it hasn't happened yet."
      : "Do NOT mention the hand-off or use words like \"last\"/\"one more thing\" — more checks remain after this one.",
    '',
    `When they answer, save it with remember({key:'${step.field}', value:'...'}), then call`,
    'escalate_to_operator again IN THE SAME TURN as that answer.',
    'Never end a turn having only saved the answer: the hand-off must still happen — but only',
    'ANNOUNCE it in the turn where escalate_to_operator actually succeeds, never before.',
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
