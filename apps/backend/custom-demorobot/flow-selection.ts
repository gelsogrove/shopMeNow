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

import { attachFlow } from './state.js'

export interface FlowSummary {
  flowId: string
  title: string
  /** Optional extra matching signal (description / keywords) when configured. */
  hint?: string
  /** Category the flow belongs to. Absent for workspace-generic flows. */
  category?: string
}

export interface LoadedFlow {
  compiledPrompt: string
  hash?: string
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

    attachFlow(ctx.sessionId, flowId, loaded.hash ?? '', loaded.compiledPrompt)
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
