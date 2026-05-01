// Pure intent-detection and pattern-matching helpers.
// No LLM calls, no state mutations — only deterministic regex/heuristic logic.

import {
  normalizeDisplayState,
} from './display-state.js'
import {
  isBlankDisplayReply,
  hasExtraButtonIssue,
  hasStopIntent,
} from './message-parsing.js'
import type { SessionState } from './state.js'

// ── Display state extraction ──────────────────────────────────────────────────

export function extractDisplayState(message: string): string | null {
  const trimmed = message.trim()
  if (isBlankDisplayReply(trimmed)) return 'BLANK'
  if (/END.*bAL|bAL.*END/i.test(trimmed)) return 'END_BAL'
  if (/\b\d{1,2}[.,]\d{2}\b/.test(trimmed)) return 'PRICE'
  if (/puerta abierta|dibujo de la puerta|icono de puerta|door open|open door icon/i.test(trimmed)) return 'DOOR'
  const alarm001Match = trimmed.match(/\bALM\s*0*01\b/i)
  if (alarm001Match) return 'AL001'
  // Bare "001" / "01" code (without the "ALM" prefix) — surfaces as AL001 too,
  // matching customer phrasing like "en la pantalla sale 001". Use \D boundary
  // (instead of \b) so "1001" or "100" don't false-match.
  if (/(?:^|\D)0*01(?:\D|$)/.test(trimmed) && !/\b\d{4,}\b/.test(trimmed)) return 'AL001'

  // Accept the sub-code separated by "/", whitespace, or nothing — "ALM DOOR",
  // "ALM/DOOR", "ALMDOOR" should all collapse to the same display token.
  const specificAlarmMatch = trimmed.match(/\b(ALM[\/\s]?A|ALM[\/\s]?E|ALM[\/\s]?DOOR|ALM[\/\s]?V(?:AR|Ar))\b/i)
  if (specificAlarmMatch) return normalizeDisplayState(specificAlarmMatch[1])

  // ALN family ("ALN", "ALN A", "ALN N") is treated as an undocumented alarm —
  // matched here so it surfaces as a display state and the flow engine can
  // route it through the troubleshooting → escalate path (case 16).
  const alnMatch = trimmed.match(/\bALN(?:\s*[AN])?\b/i)
  if (alnMatch) return normalizeDisplayState(alnMatch[0])

  const genericMatch = trimmed.match(/\b(SEL|PUSH|PR|DOOR|ALM|AL001|END|ON|FILTRO|FALLO DE ROTACION|FALLO DE ASPIRACION|STOP|water)\b/i)
  if (!genericMatch) return null
  return normalizeDisplayState(genericMatch[1])
}

export function isDisplayCodeLikeInput(message: string): boolean {
  return Boolean(extractDisplayState(message))
}

// ── Short reply classification ────────────────────────────────────────────────

export function isShortContextReply(message: string): boolean {
  const trimmed = message.trim()
  return (
    /^\d{1,2}$/.test(trimmed) ||
    /^(yes|y|si|sì|sí|no|n|ok|ok risolto|risolto|fatto|ora funziona|water)$/i.test(trimmed) ||
    isBlankDisplayReply(trimmed) ||
    isDisplayCodeLikeInput(trimmed)
  )
}

// ── Operational context ───────────────────────────────────────────────────────

export function hasOperationalContextIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /ho messo i soldi|messo i soldi|metto i soldi|sto mettendo i soldi|inserito i soldi|ho pagato|he pagado|hemos pagado|paid already|already paid|payment completed|pagamento fatto|cosa devo fare adesso|what do i do now|que hago ahora|non aumentano i minuti|minutes did not increase|minuti non aumentano|no se ha activado|no se activa|activarla|activarse|puesta en marcha|se ha puesto en marcha/i.test(normalized)
}

export function extractUnknownDisplayCode(message: string): string | null {
  const trimmed = message.trim()
  if (!trimmed) return null
  if (extractDisplayState(trimmed)) return null

  const codeMatch = trimmed.match(/\b([A-Z]{1,3}\d{1,3})\b/i)
  return codeMatch ? codeMatch[1].toUpperCase() : null
}

export function isPaidButNotActivatedCase(
  state: SessionState,
  _issueSummary: string,
  routeMachineType: '' | 'washer' | 'dryer',
): boolean {
  if (routeMachineType !== 'washer' && routeMachineType !== 'dryer') return false
  if (state.paymentCompleted !== true) return false
  if (state.displayState) return false
  return true
}

export function hasNoFoamConcern(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  const mentionsFoamOrDetergent = /foam|schiuma|espuma|jabon|jab[oó]n|detergent|detergente|suavizante|soap/i.test(normalized)
  const mentionsAbsenceOrDoubt = /no hay|no tiene|no veo|sin |senza|without|poca|poco|normal|is this normal|es normal|non c[' ]?e|non vedo/i.test(normalized)
  return mentionsFoamOrDetergent && mentionsAbsenceOrDoubt
}

export function hasTroubleshootingIntent(message: string): boolean {
  return hasTechnicalIssueIntent(message) || hasOperationalContextIntent(message)
}

export function isClosureAcknowledgement(message: string): boolean {
  const trimmed = message.trim().toLowerCase()
  if (!trimmed || trimmed.length > 24) return false
  if (/\d/.test(trimmed) || trimmed.includes('?') || isDisplayCodeLikeInput(trimmed)) return false
  return /^(ok|okay|ok risolto|risolto|fatto|grazie|gracias|thanks|thank you|bene|perfect|perfecto|perfetto|va bene|d'accordo|listo)$/i.test(trimmed)
}

// ── Machine type + route normalization ───────────────────────────────────────

export function normalizeMachineType(value: unknown): '' | 'washer' | 'dryer' {
  const normalized = String(value || '').trim().toLowerCase()
  if (['washer', 'lavatrice', 'lavadora', 'washing machine'].includes(normalized)) return 'washer'
  if (['dryer', 'asciugatrice', 'secadora'].includes(normalized)) return 'dryer'
  if (/lavat(?:rice|ric|rce)|lavador|wash(?:er|ing machine)/i.test(normalized)) return 'washer'
  if (/asci(?:ugatrice|ugatric)|ascig(?:atrice|aatrice|a+trice)|secador|dry(?:er|ing)/i.test(normalized)) return 'dryer'
  return ''
}

export function normalizeRoute(value: unknown): import('./types.js').Route {
  const normalized = String(value || '').trim().toLowerCase()
  if (['washer', 'lavatrice', 'lavadora'].includes(normalized)) return 'washer'
  if (['dryer', 'asciugatrice', 'secadora'].includes(normalized)) return 'dryer'
  if (['faq', 'operator', 'reset', 'greeting', 'unknown'].includes(normalized)) {
    return normalized as import('./types.js').Route
  }
  return 'unknown'
}

export function pickAllowedToken(rawValue: unknown, allowed: string[]): string | null {
  const value = String(rawValue || '').trim()
  if (!value) return null
  for (const token of allowed) {
    if (value === token || value.includes(token)) return token
  }
  return null
}

// ── Location / greeting / reset ───────────────────────────────────────────────

export function isAwaitingLocation(state: SessionState): boolean {
  return !state.location && state.lastMissingFacts.includes('location')
}

export function hasGreetingIntent(message: string): boolean {
  return /\b(ciao|ciao\s+come\s+stai|hello|hi|hola|buongiorno|buonasera)\b/i.test(message.trim())
}

export function hasExplicitResetIntent(message: string): boolean {
  return /\b(reset|restart|start over|ricominci|ricomincia|ricominciamo|empecemos de nuevo|volver a empezar)\b/i.test(message.trim())
}

export function hasTechnicalIssueIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /non si chiude|sportello|door|non parte|non funziona|non si avvia|does not start|doesn't start|won't start|does not work|doesn't work|not working|no arranca|no funciona|no empieza|no inicia|no comienza|no se pone en marcha|no se ha activado|no se activa|activarla|activarse|puesta en marcha|stop|display|alm|sel|push|errore|error|filtro|rotacion|aspiracion|bagnat|wet|smell|odore/i.test(normalized)
}

export function detectLanguageHeuristic(message: string): SessionState['language'] | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null

  if (/(¿|¡|secadora|lavadora|lavander[ií]a|arranc|otra vez|pantalla|centrifug|ropa|mojad|dinero|he pulsado|he premudo|como lo|autoservicio|cobrado|doble cobro|paso a paso|lavar|secar|captura|tarjeta|local|me sale|aparece en|sale en|no arranca|no funciona|no se activa|he pagado|he puesto)/i.test(normalized)) {
    return 'es'
  }

  if (/(asciug|lavatrice|lavanderia|centrifug|bagnat|sportello|cosa devo fare|ho gia risposto|schermata|pagamento|carta|lavato|asciugato)/i.test(normalized)) {
    return 'it'
  }

  if (/(rentadora|assecadora|rentadora|rentar|assecar|carrer|localitat|cobrament|pantalla de la rentadora|no arrenca|ha cobrat|pas a pas)/i.test(normalized)) {
    return 'ca'
  }

  if (/(washer|dryer|laundromat|display shows|charged twice|double charge|step by step|card digits|screenshot|payment proof|did not start|does not start)/i.test(normalized)) {
    return 'en'
  }

  return null
}

export function isLikelyStandaloneLocationInput(state: SessionState, message: string): boolean {
  const trimmed = message.trim()
  if (!(isAwaitingLocation(state) || (!state.location && trimmed.split(/\s+/).length <= 4))) return false
  if (!trimmed || trimmed.length > 60) return false
  if (/^\d+$/.test(trimmed)) return false
  if (isShortContextReply(trimmed)) return false
  if (hasGreetingIntent(trimmed)) return false
  if (normalizeMachineType(trimmed)) return false
  if (/lavatric|washer|lavadora|asciugatric|dryer|secadora|display|alm|door|push|sel|filtro|rotacion|aspiracion/i.test(trimmed)) {
    return false
  }
  return true
}

export function getRequestedLanguage(message: string): SessionState['language'] | null {
  const normalized = message.trim().toLowerCase()
  if (/(italiano|italian\b)/i.test(normalized)) return 'it'
  if (/(español|espanol|spanish\b)/i.test(normalized)) return 'es'
  if (/(català|catala|catalan\b)/i.test(normalized)) return 'ca'
  if (/(français|francais|french\b)/i.test(normalized)) return 'fr'
  if (/(portugu[eê]s|portuguese\b)/i.test(normalized)) return 'pt'
  if (/(inglese|english\b)/i.test(normalized)) return 'en'
  return null
}

export function extractExplicitLocation(message: string): string | null {
  const match = message.match(/\b(?:sono a|sono in|mi trovo a|estoy en|estoy a|i am in|i'm in|i am at)\s+([A-Za-zÀ-ÿ' -]{2,40})/i)
  if (!match) return null
  return match[1].split(/[.,!?]/)[0].trim()
}

// ── Payment parsing ───────────────────────────────────────────────────────────

export function parsePaymentAnswer(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null

  if (/^(no|not yet|non ancora|ancora no)$/i.test(normalized)) {
    return false
  }

  if (/\b(non ho pagato|not paid|non pagato|no he pagado|todav[ií]a no)\b/i.test(normalized)) {
    return false
  }

  if (
    /^(yes|y|si|sì|sí)\b/i.test(normalized) ||
    /\b(ho pagato|pagato|paid|pagamento fatto|payment completed|fatto il pagamento|ho messo i soldi|messo i soldi|inserito i soldi)\b/i.test(normalized)
  ) {
    return true
  }

  return null
}

// ── Double charge parsing ─────────────────────────────────────────────────────

export function hasDoubleChargeConcern(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /doble cobro|cobrado dos veces|me ha cobrado dos veces|double charge|charged twice|double payment|doble pago/i.test(normalized)
}

export function hasInconsistentDoubleChargeNarrative(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  const unclearCount = /no s[eé] (cu[aá]ntas|exactamente|bien)|\b(tres|cuatro|cinco|3|4|5)\s+o\s+(tres|cuatro|cinco|3|4|5)\s+veces\b|no recuerdo cu[aá]ntas|varias veces/i.test(normalized)
  const amountMismatch = /importe no (me )?cuadra|no cuadra (el )?importe|no me cuadra|el importe es diferente|cobro diferente al esperado/i.test(normalized)
  return unclearCount || amountMismatch
}

export function parseServiceCompletedAnswer(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null
  if (/^(no|non|not yet|ancora no|todav[ií]a no)$/i.test(normalized)) return false
  if (/\b(no he podido|non ho potuto|non sono riuscito|i could not|i wasn't able to|non ho potuto usare|no pude usar)\b/i.test(normalized)) return false
  if (/^(s[iíì]|yes|y)$/i.test(normalized)) return true
  if (/\b(ho lavato|he lavado|he secado|ho asciugato|i washed|i dried|si pude|si he podido)\b/i.test(normalized)) return true
  if (/\b(lavar|lavado|lavar la ropa|wash|washed|secar|secado|dry|dried|usar la maquina|usare la macchina)\b/i.test(normalized)) return true
  return null
}

export function parseDryerStartedAnswer(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null
  if (/\b(no ha arrancado|no arranca|no ha empezado|no empieza|not started|did not start|non e partita|non parte)\b/i.test(normalized)) return false
  if (/\b(si ha arrancado|sí ha arrancado|ha arrancado|ha empezado|yes it started|started|e partita|partita)\b/i.test(normalized)) return true
  return null
}

export function parseDryerCycleContext(message: string): '' | 'first_cycle' | 'time_added' {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return ''
  if (/\b(primer ciclo|first cycle|primo ciclo)\b/i.test(normalized)) return 'first_cycle'
  if (/\b(a[nñ]adido tiempo|añad[ií] tiempo|he añadido tiempo|added time|aggiunto tempo)\b/i.test(normalized)) return 'time_added'
  return ''
}

export function extractLast4CardDigits(message: string): string | null {
  return message.match(/\b(\d{4})\b/)?.[1] || null
}

export function parsePaymentProofProvided(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null
  if (/^(no|non|not yet|todav[ií]a no)$/i.test(normalized)) return false
  if (/\b(no la tengo|non ce l\'ho|no tengo captura|non ho la schermata|i don't have the screenshot|non ho lo screenshot)\b/i.test(normalized)) return false
  if (/captura|screenshot|screen|pantallazo|adjunto|allego|te la mando|te lo mando|aqui esta|here it is/i.test(normalized)) return true
  if (/^(vale|ok|sí|si|yes|claro|de acuerdo|por supuesto|tengo una|tengo foto)$/i.test(normalized)) return true
  return null
}

export function shouldTreatAsDoubleChargeNarrative(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  if (hasDoubleChargeConcern(trimmed)) return false
  if (isAlreadyAnsweredReply(trimmed)) return false
  if (parseServiceCompletedAnswer(trimmed) !== null) return false
  if (extractLast4CardDigits(trimmed)) return false
  if (parsePaymentProofProvided(trimmed) !== null && trimmed.split(/\s+/).length <= 3) return false
  if (trimmed.length >= 12) return true
  return /\b(poi|despu[eé]s|luego|then|prima|dopo|first|second|segundo|tercero)\b/i.test(trimmed)
}

export function shouldForceDoubleChargeNarrativeStep(state: SessionState, message: string): boolean {
  if (!state.lastMissingFacts.includes('double charge step by step')) return false

  const trimmed = message.trim()
  if (!trimmed) return false
  if (isAlreadyAnsweredReply(trimmed)) return false
  if (parseServiceCompletedAnswer(trimmed) !== null) return false
  if (extractLast4CardDigits(trimmed)) return false
  if (parsePaymentProofProvided(trimmed) !== null) return false
  if (isLikelyStandaloneLocationInput(state, trimmed)) return false

  return trimmed.length >= 20 || /\b(poi|despu[eé]s|luego|then|prima|dopo|first|second|segundo|tercero|partito|arranco|arranc[oó]|pagato|pagado|messo i soldi|met[ií] el dinero)\b/i.test(trimmed)
}

export function isAlreadyAnsweredReply(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return false
  return /ho gi[aà]'? rispost|l'ho gi[aà]'? detto|te l'ho gi[aà]'? detto|already answered|already told you|i already answered|ya respond[ií]|ya lo dije|gi[aà] detto/i.test(normalized)
}

// ── Post-cycle issue detection ────────────────────────────────────────────────

export function isContextualHeuristicInput(originalInput: string, normalizedInput: string): boolean {
  return originalInput.trim() !== normalizedInput.trim()
}

export function hasDryerPostCycleIssue(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  const mentionsDrying = /secad|dry|asciug/i.test(normalized)
  const mentionsWetOutcome = /empapad|mojad|wet|bagnat|humed/i.test(normalized)
  return mentionsDrying && mentionsWetOutcome
}

export function hasWasherPostCycleIssue(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /finito|finished|terminado|centrifug|mojad|empapad|wet|bagnat|ropa.*mojad|salido.*mojad|porta non si apre|door blocked|schiuma|foam|espuma|jabon|jab[oó]n|detergent|detergente|suavizante/i.test(normalized)
}

// Re-export helpers from other modules so consumers can import from one place
export { hasExtraButtonIssue, hasStopIntent }
