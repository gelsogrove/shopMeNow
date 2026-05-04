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
  // "AL001" or "ALM 001" → AL001 (caso 5: error in payment sequence).
  const alarm001Match = trimmed.match(/\b(?:AL|ALM\s*)0*01\b/i)
  if (alarm001Match) return 'AL001'
  // Bare "001" / "01" code (without "AL"/"ALM" prefix) → C001 (caso 15:
  // selection-before-payment, always escalates). Use \D boundary so "1001"
  // or "100" don't false-match.
  if (/(?:^|\D)0*01(?:\D|$)/.test(trimmed) && !/\b\d{4,}\b/.test(trimmed)) return 'C001'

  // Accept the sub-code separated by "/", whitespace, or nothing — "ALM DOOR",
  // "ALM/DOOR", "ALMDOOR" should all collapse to the same display token.
  const specificAlarmMatch = trimmed.match(/\b(ALM[\/\s]?A|ALM[\/\s]?E|ALM[\/\s]?DOOR|ALM[\/\s]?V(?:AR|Ar))\b/i)
  if (specificAlarmMatch) return normalizeDisplayState(specificAlarmMatch[1])

  // ALN family ("ALN", "ALN A", "ALN N") is treated as an undocumented alarm —
  // matched here so it surfaces as a display state and the flow engine can
  // route it through the troubleshooting → escalate path (case 16).
  const alnMatch = trimmed.match(/\bALN(?:\s*[AN])?\b/i)
  if (alnMatch) return normalizeDisplayState(alnMatch[0])

  // Generic ERR/ERROR codes ("ERR 52", "ERROR 47", "ERR-50") — surfaces as
  // an undocumented display so the bot escalates per Caso 30.
  const errMatch = trimmed.match(/\b(ERR(?:OR)?[\s\-]?\d{1,3})\b/i)
  if (errMatch) return errMatch[1].toUpperCase().replace(/\s+/g, ' ')

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
    /^(yes|y|si|sì|sí|no|n|ok|ok risolto|risolto|fatto|ora funziona|water|perfecto|perfect|perfetto|gracias|grazie|thanks|vale|claro|de\s+acuerdo|entendido|capito|got\s+it|d'accordo|adelante|continuamos)$/i.test(trimmed) ||
    isBlankDisplayReply(trimmed) ||
    isDisplayCodeLikeInput(trimmed)
  )
}

// ── Non-troubleshooting incident detection ──────────────────────────────────
// These are customer reports that should NOT enter the machine-troubleshooting
// flow (no machineType / machineNumber / displayState gathering). After
// capturing location, the case escalates to a human operator with a manual
// review message that includes "revisar / revisión".
// MULTILINGUA TODO: today the patterns are Spanish-only because cliente-0 is
// configured for Spanish. When more languages are enabled, move these strings
// to a per-language file or use an LLM classifier.
// ── Angry / frustrated tone detection ──────────────────────────────────────
// Detects when the customer's tone is aggressive, demanding, or very upset so
// the bot can prepend an empathetic acknowledgement ("Entiendo tu malestar...")
// before continuing the normal data gathering. MULTILINGUA TODO: kept Spanish
// + a few Italian/English roots since cliente-0 is Spanish-only today.
// ── Operational context ───────────────────────────────────────────────────────

export function hasOperationalContextIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /ho messo i soldi|messo i soldi|metto i soldi|sto mettendo i soldi|inserito i soldi|ho pagato|he pagado|hemos pagado|paid already|already paid|payment completed|pagamento fatto|cosa devo fare adesso|what do i do now|que hago ahora|non aumentano i minuti|minutes did not increase|minuti non aumentano|no se ha activado|no se activa|activarla|activarse|puesta en marcha|se ha puesto en marcha/i.test(normalized)
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

// ── Machine type + route normalization ───────────────────────────────────────

export function normalizeMachineType(value: unknown): '' | 'washer' | 'dryer' {
  const normalized = String(value || '').trim().toLowerCase()
  if (['washer', 'lavatrice', 'lavadora', 'washing machine'].includes(normalized)) return 'washer'
  if (['dryer', 'asciugatrice', 'secadora'].includes(normalized)) return 'dryer'
  if (/lavat(?:rice|ric|rce)|lavador|wash(?:er|ing machine)/i.test(normalized)) return 'washer'
  if (/asci(?:ugatrice|ugatric)|ascig(?:atrice|aatrice|a+trice)|secador|dry(?:er|ing)/i.test(normalized)) return 'dryer'
  return ''
}

// ── Location / greeting / reset ───────────────────────────────────────────────

export function isAwaitingLocation(state: SessionState): boolean {
  return !state.location && state.lastMissingFacts.includes('location')
}

export function hasGreetingIntent(message: string): boolean {
  return /\b(ciao|ciao\s+come\s+stai|hello|hi|hola|buongiorno|buonasera)\b/i.test(message.trim())
}

export function hasTechnicalIssueIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /non si chiude|sportello|door|non parte|non funziona|non si avvia|does not start|doesn't start|won't start|does not work|doesn't work|not working|no arranca|no funciona|no empieza|no inicia|no comienza|no se pone en marcha|no se ha activado|no se activa|activarla|activarse|puesta en marcha|stop|display|alm|sel|push|errore|error|filtro|rotacion|aspiracion|bagnat|wet|smell|odore/i.test(normalized)
}

export function detectLanguageHeuristic(message: string): SessionState['language'] | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null

  if (/(¿|¡|secadora|lavadora|lavander[ií]a|arranc|otra vez|pantalla|centrifug|ropa|mojad|dinero|he pulsado|he premudo|como lo|autoservicio|cobrado|doble cobro|paso a paso|lavar|secar|captura|tarjeta|local|me sale|aparece en|sale en|no arranca|no funciona|no se activa|he pagado|he puesto|teneis|tenéis|ten[eé]is|qu[eé] horario|qu[eé] precio|cu[aá]nto cuesta|hola|estoy en|sí|por favor)/i.test(normalized)) {
    return 'es'
  }

  if (/(asciug|lavatrice|lavanderia|centrifug|bagnat|sportello|cosa devo fare|ho gia risposto|schermata|pagamento|carta|lavato|asciugato)/i.test(normalized)) {
    return 'it'
  }

  if (/(rentadora|assecadora|rentadora|rentar|assecar|carrer|localitat|cobrament|pantalla de la rentadora|no arrenca|ha cobrat|pas a pas)/i.test(normalized)) {
    return 'ca'
  }

  if (/(washer|dryer|laundromat|display shows|charged twice|double charge|step by step|card digits|screenshot|payment proof|did not start|does not start|i can'?t|hi|hello|my\s+(washer|dryer|machine))/i.test(normalized)) {
    return 'en'
  }

  // Portuguese: avoid matching Spanish "hola" as PT. Require explicit PT
  // markers (accented olá, ã, ç, voce, etc.) or PT-only spellings.
  if (/(\bolá\b|n[ãâ]o\s|lavandaria|m[áa]quina de lavar|m[áa]quina de secar|j[áa] paguei|comprovante|você|voce|estou em|obrigad[oa])/i.test(normalized)) {
    return 'pt'
  }

  if (/(bonjour|salut|lave-linge|s[èe]che-linge|laverie|ne marche pas|ne fonctionne pas|j'?ai pay[ée]|je n'?arrive pas|d[ée]j[àa] pay[ée]|machine [aà])/i.test(normalized)) {
    return 'fr'
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
  // "No lo sé / no sé / no me acuerdo / ni idea" must not be captured as a
  // location — Caso 31 needs the bot to insist on the location instead.
  if (/^(no\s+lo\s+s[eé]|no\s+s[eé]|no\s+me\s+acuerdo|ni\s+idea|no\s+tengo\s+idea)(?:\s|$|[.,!?])/i.test(trimmed)) {
    return false
  }
  // Messages that mention an incident keyword are NOT a standalone location.
  // E.g. "Tengo un código: 23432023" is Caso 18, not a location guess.
  if (/c[oó]digo|cobr|pag[uoa]|tarjeta|datafono|factura|recargar|fidelizaci[oó]n|horario|cuesta|devolv|devu[ée]lv|reembolso|c[aá]maras|ajax|monedas|dinero|cuesta|gratis|compensaci[oó]n/i.test(trimmed)) {
    return false
  }
  return true
}

export function extractExplicitLocation(message: string): string | null {
  // Patterns:
  //   "estoy en Goya", "sono a Pineda", "i am at Hortes" → explicit "I am at"
  //   "...en Goya", "...en Pineda" → trailing "en <Loc>" reference (e.g.
  //     "el datáfono me ha cobrado 10€ en Goya"). Restricted to single-word
  //     known-style location names to avoid false positives.
  const explicit = message.match(/\b(?:sono a|sono in|mi trovo a|estoy en|estoy a|i am in|i'm in|i am at)\s+([A-Za-zÀ-ÿ' -]{2,40})/i)
  if (explicit) return explicit[1].split(/[.,!?]/)[0].trim()
  // Inline "en/a <Location>" pattern, case-insensitive — covers "En Pineda
  // me ha cobrado", "...a Goya", "Sto usando una lavatrice a Goya", etc.
  // Restrict to a single word after the preposition to avoid eating sentences
  // ("en realidad", "a la 5", etc. handled by filler skip).
  const trailing = message.match(/\b(?:en|a)\s+([A-ZÀ-ÿ][a-zà-ÿ']{2,20})\b/i)
  if (trailing) {
    const candidate = trailing[1].split(/[.,!?]/)[0].trim()
    // Skip filler words that often follow "en"/"a"
    if (!/^(realidad|verdad|cuanto|qu[eé]|la|el|los|las|este|esta|cu[aá]l|que)$/i.test(candidate)) {
      return candidate
    }
  }
  return null
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
  return /doble cobro|cobrado dos veces|cobr[oó]\s+dos\s+veces|me ha cobrado dos veces|double charge|charged twice|double payment|doble pago|dos veces con la tarjeta/i.test(normalized)
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

export function extractLast4CardDigits(message: string): string | null {
  return message.match(/\b(\d{4})\b/)?.[1] || null
}

// Detect "I cannot read / see / describe what is on the display" in any
// supported language. The router prompt already documents this exception, but
// the deterministic guard chain (machineNumber → display) needs an explicit
// detector to skip straight to the photo / escalate path.
// Detect a "mixed incident" first message — the customer reports multiple
// concerns at once (paid + machine + double-pay confusion). The right answer
// is to slow down and propose a "paso a paso" walkthrough. UC32.
// Detect "I don't know" replies in any supported language. Used to insist on
// the location question when the customer cannot or does not want to identify
// the laundry on the first ask.
// Detect "I cannot send a photo" — used after the bot asked for a photo of the
// display. Triggers escalation in UC17.
export function parsePaymentProofProvided(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null
  if (/^(no|non|not yet|todav[ií]a no)$/i.test(normalized)) return false
  if (/\b(no la tengo|non ce l\'ho|no tengo captura|non ho la schermata|i don't have the screenshot|non ho lo screenshot)\b/i.test(normalized)) return false
  if (/captura|screenshot|screen|pantallazo|adjunto|allego|te la mando|te lo mando|aqui esta|here it is/i.test(normalized)) return true
  if (/^(vale|ok|sí|si|yes|claro|de acuerdo|por supuesto|tengo una|tengo foto)$/i.test(normalized)) return true
  return null
}

export function isAlreadyAnsweredReply(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return false
  return /ho gi[aà]'? rispost|l'ho gi[aà]'? detto|te l'ho gi[aà]'? detto|already answered|already told you|i already answered|ya respond[ií]|ya lo dije|gi[aà] detto/i.test(normalized)
}

// ── Post-cycle issue detection ────────────────────────────────────────────────

// Re-export helpers from other modules so consumers can import from one place
export { hasExtraButtonIssue, hasStopIntent }
