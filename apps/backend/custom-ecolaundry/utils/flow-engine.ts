// Flow Engine — drives the step-by-step guided troubleshooting flows.
// Reads and advances through FlowNode graphs loaded from JSON files.

import { normalizeDisplayState } from './display-state.js'
import { isBlankDisplayReply, hasExtraButtonIssue, hasStopIntent } from './message-parsing.js'
import { extractDisplayState, isPaidButNotActivatedCase, parsePaymentAnswer } from './intent.js'
import { callModel } from './llm.js'
import type {
  FlowEngineResult,
  FlowNode,
  Runtime,
  SessionState,
} from '../models/index.js'

// ── i18n resolution ──────────────────────────────────────────────────────────

/**
 * Resolve the customer-facing prompt for a flow node.
 * If the node has a `promptKey`, the translate function is called and the
 * result is used; falls back to `node.prompt` (inline Spanish legacy string).
 */
export function resolveNodePrompt(node: FlowNode, translateFn?: (key: string) => string): string {
  if (node.promptKey && translateFn) {
    const translated = translateFn(node.promptKey)
    if (translated) return translated
  }
  return node.prompt
}

// ── Flow traversal ────────────────────────────────────────────────────────────

export function currentFlowGroup(runtime: Runtime, state: SessionState): Record<string, FlowNode> | null {
  if (!state.activeFlowId || !state.machineType) return null
  const source = state.machineType === 'washer' ? runtime.flows.washer : runtime.flows.dryer
  return source[state.activeFlowId] || null
}

export function currentFlowNode(runtime: Runtime, state: SessionState): FlowNode | null {
  const flow = currentFlowGroup(runtime, state)
  if (!flow || !state.activeStepId) return null
  return flow[state.activeStepId] || null
}

export function startFlow(runtime: Runtime, state: SessionState, flowId: string, translateFn?: (key: string) => string): FlowEngineResult {
  const normalizedFlowId = flowId.trim()
  const source = state.machineType === 'dryer' ? runtime.flows.dryer : runtime.flows.washer
  const flow = source[normalizedFlowId]
  if (!flow) {
    throw new Error(`Flow ${normalizedFlowId} not found for machine type ${state.machineType || 'washer'}`)
  }

  const stepId = selectInitialStepFromState(state, normalizedFlowId, flow)
  const node = flow[stepId]
  if (!stepId || !node) {
    throw new Error(`Flow ${flowId} has no valid starting node`)
  }

  state.activeFlowId = normalizedFlowId
  state.activeStepId = stepId
  state.retryCount = 0

  return {
    flowId: normalizedFlowId,
    stepId,
    prompt: resolveNodePrompt(node, translateFn),
    type: node.type,
    isTerminal: Boolean(node.isTerminal),
    action: node.action,
  }
}

export function selectInitialStepFromState(
  state: SessionState,
  flowId: string,
  flow: Record<string, FlowNode>,
): string {
  const issue = state.issueSummary.toLowerCase()
  const display = normalizeDisplayState(state.displayState)

  if (state.machineType === 'washer' && flowId === 'non_parte') {
    if (hasExtraButtonIssue(issue) && flow.case_extra_button) return 'case_extra_button'
    if (state.paymentCompleted === false && flow.pay_help) return 'pay_help'
    if (display === 'SEL' && flow.case_sel) return 'case_sel'
    if (display === 'PRICE' && flow.case_price) return 'case_price'
    if ((display === 'PUSH' || display === 'PR') && flow.case_push) return 'case_push'
    if (display === 'DOOR' && flow.case_door) return 'case_door'
    if (display === 'ALM/A' && flow.case_alm_a) return 'case_alm_a'
    if (display === 'ALM/E' && flow.case_alm_e) return 'case_alm_e'
    if (display === 'ALM/DOOR' && flow.case_alm_door) return 'case_alm_door'
    if (display === 'ALM/VAr' && flow.case_alm_var) return 'case_alm_var'
    if (display === 'ALM' && flow.case_alm) return 'case_alm'
    if (display === 'ALN' && flow.case_alm_unknown) return 'case_alm_unknown'
    if (display === 'AL001' && flow.case_al001) return 'case_al001'
    if (display === 'END_BAL' && flow.case_end_bal) return 'case_end_bal'
    if (display === 'END' && flow.case_end) return 'case_end'
    if (display === 'ON' && flow.ok) return 'ok'
    // Skip the display-check entry node when the case is "paid but not activated
    // and the central did not return change". For that case the chatbot handles
    // the coin-selection-error path directly (see chatbot.ts) — entering
    // display_check here would force a display question that is not in the doc.
    if (state.paymentCompleted === true && !isPaidButNotActivatedCase(state, '', state.machineType) && flow.display_check) return 'display_check'
  }

  if (state.machineType === 'washer' && flowId === 'post_ciclo') {
    if (/foam|schiuma|espuma|jabon|jab[oó]n|detergent|detergente|suavizante/.test(issue) && flow.foam) return 'foam'
    if (/porta|door/.test(issue) && flow.door) return 'door'
    if (/mojad|empapad|bagnat|wet|centrifug/.test(issue) && flow.wet) return 'wet'
    if (flow.step_0) return 'step_0'
  }

  if (state.machineType === 'dryer' && flowId === 'non_parte') {
    if (state.paymentCompleted === false && flow.pay_help) return 'pay_help'
    if (display === 'BLANK' && flow.display_blank) return 'display_blank'
    if (display === 'SEL' && flow.ready_state) return 'ready_state'
    // PUSH on a dryer is unusual (PUSH is typically a washer code) but if
    // the customer reports it, route to ready_state — same UX as SEL
    // ("la secadora está lista, selecciona el programa"). Without this
    // PUSH would fall through to problem_check and re-ask the display.
    if (display === 'PUSH' && flow.ready_state) return 'ready_state'
    if (display === 'DOOR' && flow.door_issue) return 'door_issue'
    if (display === 'ALN' && flow.fallback) return 'fallback'
    if (display === 'AL001' && flow.case_al001) return 'case_al001'
    if (state.paymentCompleted === true && flow.problem_check) return 'problem_check'
  }

  if (state.machineType === 'dryer' && flowId === 'errore_reset') {
    if (hasStopIntent(issue) && flow.mid_stop) return 'mid_stop'
    if (display === 'FILTRO' && flow.filter_alarm) return 'filter_alarm'
    if (display === 'FALLO DE ROTACION' && flow.rotation_alarm) return 'rotation_alarm'
    if (display === 'FALLO DE ASPIRACION' && flow.aspiration_alarm) return 'aspiration_alarm'
    if (/umid|wet|bagnat/.test(issue) && flow.non_scalda) return 'non_scalda'
    if (/odore|smell/.test(issue) && flow.odor_case) return 'odor_case'
    if (/porta|door/.test(issue) && flow.door_after_cycle) return 'door_after_cycle'
  }

  return flow.step_0 ? 'step_0' : Object.keys(flow)[0]
}

export function mapChoiceDescriptions(node: FlowNode): Record<string, string> {
  const descriptions: Record<string, string> = {}
  for (const line of node.prompt.split('\n')) {
    const match = line.match(/^\s*(\d+)[️⃣.]?\s*(.+)$/u)
    if (match) descriptions[match[1]] = match[2].trim()
  }
  return descriptions
}

export function normalizeConfirmation(input: string): 'YES' | 'NO' | null {
  const value = input.trim().toLowerCase()
  const nfd = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/^(y|yes|yeah|yep|si|sì|ok|done|fatto|risolto)\b/i.test(nfd)) return 'YES'
  if (/^si[^a-z]/i.test(nfd) || nfd === 'si') return 'YES'
  if (/\b(si pienso que si|creo que si|pienso que si|yes i think so|direi di si)\b/i.test(value)) return 'YES'
  if (/\b(ho gia'? detto di si|i paid already|already paid|ho pagato|pagato|payment completed|fatto il pagamento)\b/i.test(value)) return 'YES'
  if (/^(no|n|nope)\b/i.test(nfd)) return 'NO'
  if (/\b(non ancora|ancora no|non funziona|not yet|not paid|non ho pagato|no hace nada|non fa niente|does nothing)\b/i.test(value)) return 'NO'
  return null
}

// ── Sub-LLM: choice classification ───────────────────────────────────────────

export async function classifyChoiceViaLLM(node: FlowNode, input: string): Promise<string | null> {
  const trimmed = input.trim().toLowerCase()
  const detectedDisplay = extractDisplayState(input)
  const choiceDescriptions = mapChoiceDescriptions(node)
  const transitionTargets = Object.values(node.transitions || {})
  const isDisplayChoiceNode = transitionTargets.some((target) =>
    /case_sel|case_push|case_door|case_alm|case_al001|case_end|case_blank|case_extra/.test(target),
  )
  const isAlarmChoiceNode = transitionTargets.some((target) =>
    /case_alm_a|case_alm_e|case_alm_door|case_alm_var|case_alm_unknown/.test(target),
  )
  const isEndChoiceNode = transitionTargets.some((target) =>
    /case_end_only|case_end_unknown/.test(target),
  )

  if (/^(ok|ok risolto|risolto|fatto|ora funziona|funziona)$/i.test(trimmed)) {
    if (node.transitions?.YES) return 'YES'
  }
  if (/^(no|non funziona|ancora no)$/i.test(trimmed)) {
    if (node.transitions?.NO) return 'NO'
  }
  if (hasExtraButtonIssue(input) && node.transitions?.['9']) return '9'
  if (hasExtraButtonIssue(input) && node.transitions?.['8']) return '8'
  if (isBlankDisplayReply(input)) {
    if (node.transitions?.['8']) return '8'
    if (node.transitions?.['6']) return '6'
    if (node.transitions?.other) return 'other'
  }
  if (detectedDisplay && isDisplayChoiceNode) {
    if (detectedDisplay === 'SEL' && node.transitions?.['1']) return '1'
    if (detectedDisplay === 'PRICE' && node.transitions?.['2']) return '2'
    if ((detectedDisplay === 'PUSH' || detectedDisplay === 'PR') && node.transitions?.['3']) return '3'
    if (detectedDisplay === 'DOOR' && node.transitions?.['4']) return '4'
    if (detectedDisplay === 'ALM' && node.transitions?.['5']) return '5'
    if (detectedDisplay === 'AL001') {
      const al001Entry = Object.entries(choiceDescriptions).find(([, description]) => /AL001/i.test(description))
      if (al001Entry && node.transitions?.[al001Entry[0]]) return al001Entry[0]
      if (node.transitions?.other) return 'other'
    }
    if (detectedDisplay === 'END' && node.transitions?.['7']) return '7'
    if (detectedDisplay === 'END_BAL' && node.transitions?.other) return 'other'
  }
  if (detectedDisplay && isAlarmChoiceNode) {
    if (detectedDisplay === 'ALM/A' && node.transitions?.['1']) return '1'
    if (detectedDisplay === 'ALM/E' && node.transitions?.['2']) return '2'
    if (detectedDisplay === 'ALM/DOOR' && node.transitions?.['3']) return '3'
    if (detectedDisplay === 'ALM/VAr' && node.transitions?.['4']) return '4'
    if (node.transitions?.['5']) return '5'
  }
  if (detectedDisplay === 'END_BAL' && isEndChoiceNode && node.transitions?.['2']) return '2'

  const options = Object.keys(node.transitions || {}).filter((key) => key !== 'other')
  const optionLines = options.map((key) => `${key}: ${choiceDescriptions[key] || key}`).join('\n')
  const hasOther = Boolean(node.transitions?.other)
  const otherLine = (node.type === 'CONFIRMATION' && hasOther)
    ? '\nother: Customer cannot follow instructions or is asking for help (not a yes/no answer)'
    : ''
  const answer = await callModel({
    userPrompt: `Which option best matches the customer reply? Reply with ONLY the key or NONE.\n\nNode prompt:\n${node.prompt}\n\nOptions:\n${optionLines}${otherLine}\n\nCustomer reply:\n${input}`,
    maxTokens: 20,
  })
  const normalized = answer.trim().replace(/^"|"$/g, '')
  return normalized && normalized.toUpperCase() !== 'NONE' ? normalized : null
}

export async function classifyRouterLogic(logic: Record<string, string>, userInput: string): Promise<string> {
  const keys = Object.keys(logic)
  const answer = await callModel({
    userPrompt: `Classify this customer message into exactly one category. Reply with ONLY the key, nothing else.\n\nCategories: ${keys.join(', ')}\n\nCustomer message:\n${userInput}`,
    maxTokens: 15,
  })
  const normalized = answer.trim().toUpperCase()
  return keys.find((k) => k.toUpperCase() === normalized) || keys[keys.length - 1]
}

// ── Main step advancement ─────────────────────────────────────────────────────

export async function advanceActiveFlow(runtime: Runtime, state: SessionState, userInput: string, translateFn?: (key: string) => string): Promise<FlowEngineResult> {
  const flowId = state.activeFlowId
  let node = currentFlowNode(runtime, state)
  if (!flowId || !node || !state.activeStepId) {
    throw new Error('No active flow to advance')
  }

  if (node.type === 'ACTION' && node.transitions?.default) {
    state.activeStepId = node.transitions.default.split('.').pop() || node.transitions.default
    node = currentFlowNode(runtime, state)
    if (!node || !state.activeStepId) throw new Error('Broken flow transition after ACTION node')
  }

  let transitionKey: string | null = null
  const exact = userInput.trim()
  if (node.transitions?.[exact]) transitionKey = exact
  if (!transitionKey && node.type === 'CONFIRMATION') {
    // In check_result steps, a reported display code means the machine is not started yet.
    // Route to NO so the flow can continue with follow-up display troubleshooting.
    if (state.activeStepId === 'check_result') {
      const detectedDisplay = normalizeDisplayState(extractDisplayState(userInput) || '')
      if (detectedDisplay && node.transitions?.NO) {
        if (detectedDisplay === 'ON' && node.transitions?.YES) {
          transitionKey = 'YES'
        } else {
          transitionKey = 'NO'
        }
      }
    }

    if (/payment|pagamento|central unit|coins|card/i.test(node.prompt)) {
      const paymentAnswer = parsePaymentAnswer(userInput)
      if (paymentAnswer !== null) {
        transitionKey = paymentAnswer ? 'YES' : 'NO'
      }
    }
    const normalized = normalizeConfirmation(userInput)
    if (normalized && node.transitions?.[normalized]) transitionKey = normalized
  }
  if (!transitionKey) {
    const numeric = exact.match(/^(\d+)$/)?.[1]
    if (numeric && node.transitions?.[numeric]) transitionKey = numeric
  }
  if (!transitionKey && node.transitions) {
    transitionKey = await classifyChoiceViaLLM(node, userInput)
  }
  if (!transitionKey && node.transitions?.other) {
    transitionKey = 'other'
  }
  if (!transitionKey) {
    state.retryCount += 1
    if (state.retryCount >= 2) {
      state.activeFlowId = null
      state.activeStepId = null
      state.escalationReason = 'Customer could not progress in the active flow after repeated attempts.'
      return {
        flowId,
        stepId: 'escalate',
        prompt: "Un operador humano se encargará de tu caso en la máxima brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para que pueda ayudarte ahora?",
        type: 'INFO',
        isTerminal: true,
        action: 'escalate',
      }
    }
    return { flowId, stepId: state.activeStepId, prompt: resolveNodePrompt(node, translateFn), type: node.type, isTerminal: false, action: node.action }
  }

  const nextRef = node.transitions?.[transitionKey] || node.transitions?.other
  const nextStepId = nextRef?.split('.').pop()
  if (!nextStepId) throw new Error(`Broken flow transition for key ${transitionKey}`)
  state.activeStepId = nextStepId
  state.retryCount = 0
  let nextNode = currentFlowNode(runtime, state)
  if (!nextNode) throw new Error(`Missing node ${nextStepId}`)

  // Transparently route through ROUTER nodes — they have no prompt of their own.
  if (nextNode.type === 'ROUTER' && nextNode.logic) {
    const routeKey = await classifyRouterLogic(nextNode.logic, userInput)
    const routeRef = nextNode.logic[routeKey]
    const routeStepId = routeRef?.split('.').pop()
    if (routeStepId) {
      state.activeStepId = routeStepId
      const routeNode = currentFlowNode(runtime, state)
      if (routeNode) {
        if (routeNode.isTerminal) {
          state.activeFlowId = null
          state.activeStepId = null
          // Mark as resolved unless the terminal is an escalation, so the
          // next-turn extractor wipes stale machine facts and the bot does
          // not re-ask "¿Dónde está la lavandería?" on a follow-up incident.
          if (routeNode.action !== 'escalate') {
            state.pendingClosure = 'resolved'
          }
        }
        return { flowId, stepId: routeStepId, prompt: resolveNodePrompt(routeNode, translateFn), type: routeNode.type, isTerminal: Boolean(routeNode.isTerminal), action: routeNode.action }
      }
    }
    nextNode = currentFlowNode(runtime, state) ?? nextNode
  }

  if (nextNode.isTerminal) {
    state.activeFlowId = null
    state.activeStepId = null
    if (nextNode.action !== 'escalate') {
      state.pendingClosure = 'resolved'
    }
  }
  return { flowId, stepId: nextStepId, prompt: resolveNodePrompt(nextNode, translateFn), type: nextNode.type, isTerminal: Boolean(nextNode.isTerminal), action: nextNode.action }
}

/**
 * Synchronous, deterministic-only variant of `advanceActiveFlow`. Used by
 * `guardAdvanceMachineFlow` to close the pipeline-hole rule #10: when the
 * LLM skips the `advance_machine_flow` tool, this guard advances the flow
 * deterministically for inputs that match exact / CONFIRMATION-normalized /
 * numeric transitions.
 *
 * Returns `null` (instead of throwing or escalating) when:
 *   - no flow is active
 *   - the user input does not produce a deterministic transition match
 *   - the next node is a ROUTER (needs LLM classify)
 *
 * In those null cases the caller (the guard) returns null too, letting the
 * downstream LLM keep its chance to call the `advance_machine_flow` tool.
 */
export function tryAdvanceFlowSync(
  runtime: Runtime,
  state: SessionState,
  userInput: string,
): FlowEngineResult | null {
  const flowId = state.activeFlowId
  let node = currentFlowNode(runtime, state)
  if (!flowId || !node || !state.activeStepId) return null

  if (node.type === 'ACTION' && node.transitions?.default) {
    state.activeStepId = node.transitions.default.split('.').pop() || node.transitions.default
    node = currentFlowNode(runtime, state)
    if (!node || !state.activeStepId) return null
  }

  let transitionKey: string | null = null
  const exact = userInput.trim()
  if (node.transitions?.[exact]) transitionKey = exact
  if (!transitionKey && node.type === 'CONFIRMATION') {
    if (state.activeStepId === 'check_result') {
      const detectedDisplay = normalizeDisplayState(extractDisplayState(userInput) || '')
      if (detectedDisplay && node.transitions?.NO) {
        if (detectedDisplay === 'ON' && node.transitions?.YES) {
          transitionKey = 'YES'
        } else {
          transitionKey = 'NO'
        }
      }
    }
    if (/payment|pagamento|central unit|coins|card/i.test(node.prompt)) {
      const paymentAnswer = parsePaymentAnswer(userInput)
      if (paymentAnswer !== null) {
        transitionKey = paymentAnswer ? 'YES' : 'NO'
      }
    }
    if (!transitionKey) {
      const normalized = normalizeConfirmation(userInput)
      if (normalized && node.transitions?.[normalized]) transitionKey = normalized
    }
  }
  if (!transitionKey) {
    const numeric = exact.match(/^(\d+)$/)?.[1]
    if (numeric && node.transitions?.[numeric]) transitionKey = numeric
  }
  // Deliberately NOT calling classifyChoiceViaLLM: this is the deterministic
  // path. Fall back to the `other` transition when defined — same fallback
  // `advanceActiveFlow` uses after LLM classify fails. This matters for
  // CHOICE nodes whose strictMatching transitions are numeric (1-7, …) but
  // the customer writes the display code instead. Without `other`,
  // `tryAdvanceFlowSync` would return null and the LLM would improvise a
  // closure on a flow that the JSON expects to escalate.
  if (!transitionKey && node.transitions?.other) {
    transitionKey = 'other'
  }
  if (!transitionKey) return null

  const nextRef = node.transitions?.[transitionKey] || node.transitions?.other
  const nextStepId = nextRef?.split('.').pop()
  if (!nextStepId) return null
  state.activeStepId = nextStepId
  state.retryCount = 0
  const nextNode = currentFlowNode(runtime, state)
  if (!nextNode) return null

  // ROUTER nodes need LLM classify — bail out and let the LLM tool take over.
  if (nextNode.type === 'ROUTER' && nextNode.logic) return null

  if (nextNode.isTerminal) {
    state.activeFlowId = null
    state.activeStepId = null
    if (nextNode.action !== 'escalate') {
      state.pendingClosure = 'resolved'
    }
  }
  return {
    flowId,
    stepId: nextStepId,
    prompt: nextNode.prompt,
    type: nextNode.type,
    isTerminal: Boolean(nextNode.isTerminal),
    action: nextNode.action,
  }
}
