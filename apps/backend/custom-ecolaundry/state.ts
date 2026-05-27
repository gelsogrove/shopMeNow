// Per-session state. In-RAM Map for POC. Production: Redis/DB with same API.

export interface SessionState {
  // Operational
  name?:        string
  location?:    string
  machineType?: 'washer' | 'dryer'
  machine?:     number
  displayCode?: string
  language?:    'es' | 'ca' | 'en' | 'it' | 'fr' | 'pt'

  // Profile (also mirrored to backend Customers via patches)
  companyName?: string
  address?:     string
  phone?:       string
  notes?:       string

  // PII — server-only, NEVER mirrored to patches, NEVER re-emitted in LLM input
  // unless captured by the customer in the current turn (initial pre-scan).
  email?:       string
  cif?:         string
  nif?:         string
  iban?:        string
  cardFull?:    string
  cardLast4?:   string
}

// Patches that the backend should persist into the Customers table.
// Accumulated during a turn (via `remember`) and drained by `chatbotFn`
// to return to the host app.
export type PatchKey = 'name' | 'language' | 'phone' | 'company' | 'address' | 'notes'

export interface CustomerPatch {
  key: PatchKey
  value: string
}

interface SessionEntry {
  state: SessionState
  patches: CustomerPatch[]
  turnCount: number
  recentMessageTimestamps: number[]
}

const sessions = new Map<string, SessionEntry>()

function entry(sessionId: string): SessionEntry {
  let e = sessions.get(sessionId)
  if (!e) {
    e = { state: {}, patches: [], turnCount: 0, recentMessageTimestamps: [] }
    sessions.set(sessionId, e)
  }
  return e
}

export function getState(sessionId: string): SessionState {
  return entry(sessionId).state
}

export function updateState(sessionId: string, patch: Partial<SessionState>): SessionState {
  const e = entry(sessionId)
  for (const k of Object.keys(patch) as Array<keyof SessionState>) {
    const v = patch[k]
    if (v !== undefined && v !== null && v !== '') {
      const prev = (e.state as Record<string, unknown>)[k]
      if (prev !== v) {
        (e.state as Record<string, unknown>)[k] = v
        // Mirror to backend-persistable patches when the key has a Customers
        // column. Keep last-write-wins by overwriting any earlier patch of
        // the same key.
        // IMPORTANT: PII fields (email, cif, nif, iban, cardFull, cardLast4)
        // are deliberately NOT mirrored to patches — they are server-only,
        // captured by the pre-scan layer (pii.ts), and travel separately
        // (e.g. via escalation email payloads, never via Customers profile).
        const MIRRORED_KEYS: ReadonlyArray<keyof SessionState> = [
          'name', 'language', 'companyName', 'address', 'phone', 'notes',
        ]
        if (MIRRORED_KEYS.includes(k)) {
          const patchKey = k as PatchKey
          e.patches = e.patches.filter((p) => p.key !== patchKey)
          e.patches.push({ key: patchKey, value: String(v) })
        }
      }
    }
  }
  return e.state
}

export function resetState(sessionId: string): void {
  sessions.delete(sessionId)
}

export function drainPatches(sessionId: string): CustomerPatch[] {
  const e = entry(sessionId)
  const out = e.patches
  e.patches = []
  return out
}

export function incrementTurn(sessionId: string): number {
  const e = entry(sessionId)
  e.turnCount += 1
  return e.turnCount
}

export function getTurnCount(sessionId: string): number {
  return entry(sessionId).turnCount
}

export function registerMessageTimestamp(sessionId: string, now: number, windowMs: number): number {
  const e = entry(sessionId)
  e.recentMessageTimestamps = e.recentMessageTimestamps.filter((t) => now - t < windowMs)
  e.recentMessageTimestamps.push(now)
  return e.recentMessageTimestamps.length
}

// ── Deterministic language detection ─────────────────────────────────────────
// Scoring heuristic over short distinctive words/articles per language.
// Called by the orchestrator BEFORE the LLM turn so the model never has to
// emit a `remember({language})` tool call — this used to cause the T1
// empty-reply bug (model "completed the task" with the tool, then produced
// empty text at hop 2).

type Lang = NonNullable<SessionState['language']>

const LANG_MARKERS: Record<Lang, RegExp[]> = {
  it: [
    /\b(ciao|sono|non|lavatrice|asciugatrice|funziona|grazie|prego|però|già|qui|adesso|vorrei|posso|cosa|dove|quando|perché|tessera|fidelizzazione|trovo|che|mi|ti|si|della|delle|dei|degli|gli|gli|gli)\b/i,
  ],
  es: [
    /\b(hola|gracias|por\s+favor|qué|cómo|dónde|cuándo|por\s+qué|estoy|estás|está|estamos|están|sí|no|también|aquí|ahora|necesito|quiero|puedo|cuánto|cuesta|dinero|tarjeta|fidelización|lavadora|secadora|funciona|en\s+qué|cómo\s+puedo)\b/i,
  ],
  en: [
    /\b(hello|hi|thanks|thank\s+you|please|what|where|when|why|how|i\s+am|i'm|you\s+are|we\s+are|they\s+are|yes|no|also|here|now|need|want|can\s+i|how\s+much|washing|machine|dryer|loyalty|card|works)\b/i,
  ],
  ca: [
    /\b(hola|bon\s+dia|gràcies|si\s+us\s+plau|què|com|on|quan|perquè|sóc|ets|és|som|sou|són|sí|no|també|aquí|ara|necessito|vull|puc|quant|costa|rentadora|assecadora|funciona|targeta|fidelització|bugaderia)\b/i,
  ],
  fr: [
    /\b(bonjour|salut|merci|s'il\s+vous\s+plaît|quoi|comment|où|quand|pourquoi|je\s+suis|tu\s+es|nous\s+sommes|oui|non|aussi|ici|maintenant|besoin|veux|peux|combien|coûte|lave-linge|sèche-linge|fonctionne|carte|fidélité|laverie)\b/i,
  ],
  pt: [
    /\b(olá|oi|obrigado|obrigada|por\s+favor|o\s+que|como|onde|quando|porquê|eu\s+sou|tu\s+és|nós\s+somos|sim|não|também|aqui|agora|preciso|quero|posso|quanto|custa|máquina\s+de\s+lavar|secadora|funciona|cartão|fidelização|lavandaria)\b/i,
  ],
}

export function detectLanguageHeuristic(text: string): Lang | null {
  const normalized = (text || '').toLowerCase()
  if (!normalized.trim()) return null

  const scores: Record<Lang, number> = { es: 0, it: 0, en: 0, ca: 0, fr: 0, pt: 0 }
  for (const lang of Object.keys(LANG_MARKERS) as Lang[]) {
    for (const re of LANG_MARKERS[lang]) {
      const matches = normalized.match(new RegExp(re.source, re.flags + 'g'))
      if (matches) scores[lang] += matches.length
    }
  }

  let best: Lang | null = null
  let bestScore = 0
  for (const lang of Object.keys(scores) as Lang[]) {
    if (scores[lang] > bestScore) {
      best = lang
      bestScore = scores[lang]
    }
  }
  // Require at least 1 marker. Otherwise we don't know.
  return bestScore >= 1 ? best : null
}

export function seedLanguageIfNeeded(sessionId: string, text: string): Lang | null {
  const state = getState(sessionId)
  if (state.language) return state.language
  const detected = detectLanguageHeuristic(text)
  if (detected) {
    updateState(sessionId, { language: detected })
    return detected
  }
  return null
}

export function formatStateForPrompt(state: SessionState): string {
  const fields: string[] = []
  if (state.name) fields.push(`Customer name: ${state.name}`)
  if (state.location) fields.push(`Active location: ${state.location}`)
  if (state.machine !== undefined) {
    const type = state.machineType ? ` (${state.machineType})` : ''
    fields.push(`Machine: ${state.machine}${type}`)
  } else if (state.machineType) {
    fields.push(`Machine type: ${state.machineType}`)
  }
  if (state.displayCode) fields.push(`Display: ${state.displayCode}`)
  if (state.language) fields.push(`Language: ${state.language}`)
  if (fields.length === 0) return ''
  return ['', '═══ SESSION STATE ═══', ...fields, ''].join('\n')
}

export function formatStateOneLine(state: SessionState): string {
  // PII fields are redacted in the debug output too — never log real values.
  const PII_KEYS = new Set<keyof SessionState>(['email', 'cif', 'nif', 'iban', 'cardFull', 'cardLast4', 'phone'])
  const parts: string[] = []
  for (const k of Object.keys(state) as Array<keyof SessionState>) {
    const v = state[k]
    if (v !== undefined && v !== null && v !== '') {
      const display = PII_KEYS.has(k) ? '[REDACTED]' : v
      parts.push(`${k}=${display}`)
    }
  }
  return parts.join(' ') || '(empty)'
}
