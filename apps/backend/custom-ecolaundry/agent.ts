// Ecolaundry chatbot — prompt-driven LLM with cached system prompt,
// session state, escalation by email.
//
// Two entry points:
//   - REPL/batch CLI (`npm run demo`) — local interactive testing
//   - `chatbotFn(input): ChatbotOutput` — contract expected by the host
//     Express backend when this module is loaded as `workspace.customChatbotId`
//
// The same core (assemble system prompt, call LLM, dispatch tools, persist
// state, drain patches) backs both entry points. See architecture.md.

import { readFile, readdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

import nodemailer from 'nodemailer'

import {
  type CustomerPatch,
  type SessionState,
  drainPatches,
  dehydrateState,
  hydrateState,
  pushPatch,
  formatStateForPrompt,
  formatStateOneLine,
  getState,
  getTurnCount,
  incrementTurn,
  registerMessageTimestamp,
  resetState,
  updateLanguageOnTurn,
  updateState,
} from './state.js'
import { processIncomingMessage, substitutePlaceholders } from './pii.js'

// ── Config ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROMPTS_DIR = path.resolve(__dirname, 'prompts')
const SETTINGS_PATH = path.resolve(__dirname, 'settings.json')

interface Settings {
  model: string
  temperature: number
  maxTokens: number
  maxToolHops: number
  operatorBriefingLanguage: string
  operatorEmail: string
  emailFrom: string
  emailSubjectPrefix: string
  maxMessageChars: number
  maxMessagesPerMinute: number
  maxTurnsPerSession: number
  // Customer-facing copy for the deterministic guards that reply WITHOUT an
  // LLM call. Content lives in settings.json / the workspace Advanced
  // Settings JSON (rule 1A); empty string = the guard stays silent rather
  // than emitting copy hardcoded here. Key names match the platform schema
  // (ChatbotSettingsJson in chatbot-settings-json.service.ts).
  rateLimitedMessage: string
  sessionTooLongMessage: string
  /** Opening line for a customer we have never seen. Written in one language;
   *  the LLM renders it in the customer's. Empty = no greeting at all. */
  welcomeMessage: string
  /** Opening line for a customer the host already knows (recognised phone /
   *  customer record). Falls back to `welcomeMessage` when not configured. */
  welcomeBackMessage: string
  /** Languages the chatbot may reply in. A detected language outside this list
   *  falls back to `defaultLanguage`. Empty list = no restriction. */
  enabledLanguages: string[]
  /** ISO 639-1 used when the detected language is not enabled. */
  defaultLanguage: string
}

const DEFAULT_SETTINGS: Settings = {
  model: 'anthropic/claude-haiku-4.5',
  temperature: 0.3,
  maxTokens: 800,
  maxToolHops: 4,
  operatorBriefingLanguage: 'es',
  operatorEmail: '',
  emailFrom: 'Ecolaundry Bot <noreply@ecolaundry.demo>',
  emailSubjectPrefix: '[Ecolaundry] Incidencia',
  maxMessageChars: 2000,
  maxMessagesPerMinute: 30,
  maxTurnsPerSession: 50,
  rateLimitedMessage: '',
  sessionTooLongMessage: '',
  welcomeMessage: '',
  welcomeBackMessage: '',
  enabledLanguages: [],
  defaultLanguage: 'es',
}

function loadSettings(): Settings {
  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code !== 'ENOENT') {
      console.warn(`[warn] failed to load settings.json: ${err instanceof Error ? err.message : String(err)}`)
    }
    return DEFAULT_SETTINGS
  }
}

loadDotEnv(path.resolve(__dirname, '.env'))

const SETTINGS = loadSettings()
const BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'

// Per-turn settings: the host resolves the workspace's effective settings from
// the database on every message and passes them as `config.settings`, so a
// value saved in the Settings UI takes effect on the very next turn — no
// restart, no deploy (settings.json alone would be read once at boot and
// reverted by every deploy). File values act as defaults under the override.
function effectiveSettings(override?: Partial<Settings> | null): Settings {
  return override ? { ...SETTINGS, ...stripEmpty(override) } : SETTINGS
}

function stripEmpty(o: Partial<Settings>): Partial<Settings> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return out as Partial<Settings>
}

// Env vars remain the top-priority override (local dev / CLI experiments).
function resolveModel(s: Settings): string {
  return process.env.LLM_MODEL || s.model
}
function resolveMaxTokens(s: Settings): number {
  return Number(process.env.LLM_MAX_TOKENS || s.maxTokens)
}
function resolveTemperature(s: Settings): number {
  return Number(process.env.LLM_TEMPERATURE || s.temperature)
}
function resolveOperatorEmail(s: Settings): string {
  return process.env.OPERATOR_EMAIL || s.operatorEmail
}

const API_KEY = process.env.OPENROUTER_API_KEY || ''
const GMAIL_USER = process.env.GMAIL_USER || ''
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || ''

// ── Types ─────────────────────────────────────────────────────────────────────

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

// ── Concurrency: per-sessionId async lock ─────────────────────────────────────
// Two messages from the same sessionId must be processed in series, never in
// parallel. Otherwise tool dispatch and SessionState writes race. The lock is
// a Map<sessionId, Promise> — each new turn chains onto the previous one.

const sessionLocks = new Map<string, Promise<unknown>>()

async function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const previous = sessionLocks.get(sessionId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(fn)
  sessionLocks.set(sessionId, next)
  try {
    return await next
  } finally {
    if (sessionLocks.get(sessionId) === next) sessionLocks.delete(sessionId)
  }
}

// ── Input sanitization (anti prompt-injection) ────────────────────────────────
// Strip control chars, zero-width, bidi-override. Cap length. Defends against
// prompt-stuffing and homograph/bidi injection payloads.

const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
const ZERO_WIDTH_RE = /[​-‍﻿]/g
const BIDI_RE = /[\u202A-\u202E\u2066-\u2069]/g

function sanitizeUserMessage(raw: string, maxChars: number): string {
  let s = (raw ?? '').toString()
  s = s.replace(CONTROL_CHARS_RE, '')
  s = s.replace(ZERO_WIDTH_RE, '')
  s = s.replace(BIDI_RE, '')
  s = s.trim()
  if (s.length > maxChars) {
    s = s.slice(0, maxChars)
  }
  return s
}

// ── Tool schema ───────────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'remember',
      description:
        'Record facts about the customer so they are not re-asked. Call this WHENEVER the customer provides a new fact (name, location/laundromat, machine number, machine type, display code, reported symptom). Use merge semantics: only pass the fields that changed. Valid locations are documented in the prompt (LOCATIONS). Display codes are the exact strings the customer reads from the machine screen. The `symptom` field is for documented Category-D symptoms (no display code) and MUST persist across the whole gather flow — set it as soon as the customer describes the problem.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Customer full name (e.g. "Marco Rossi")' },
          location: {
            type: 'string',
            description: 'Laundromat name (canonical: Hortes, Goya, Alemanya, Pineda, L\'Escala, Platja d\'Aro). Do NOT pass a value the customer named that is not on this list — instead disambiguate in the reply.',
          },
          machineType: {
            type: 'string',
            enum: ['washer', 'dryer'],
            description: 'washer = lavadora/lavatrice. dryer = secadora/asciugatrice.',
          },
          machine: { type: 'integer', description: 'Machine number (e.g. 5)' },
          displayCode: {
            type: 'string',
            description: 'Exact display string (e.g. "DOOR", "SEL", "PUSH PROG", "ALM"). Uppercase as shown.',
          },
          symptom: {
            type: 'string',
            description:
              'Canonical token for a documented Category-D symptom WITHOUT a display code. Use one of: "no_centrifuga" (clothes came out soaking wet / washer didn\'t spin), "ropa_humeda" (clothes still damp after dryer), "ropa_quemada" (clothes came out burnt/stained/with plastic). Call this AS SOON AS the customer reports the symptom (turn 1) so it survives the gather flow.',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_invoice',
      description:
        'Submit a structured invoice request to the operator by email. Call this ONLY when you have collected ALL 5 fields from the customer (companyName, amount, serviceDate, email, note — note can be empty). The tool validates email format (RFC 5322) and serviceDate (accepts ISO date, DD/MM/YYYY, or natural language "oggi"/"ayer"/"today"/"yesterday"). If validation fails, the tool returns ok:false with a specific error — re-ask only the invalid field. After 3 failed attempts on the same field, escalate via escalate_to_operator with reason="invoice_request".',
      parameters: {
        type: 'object',
        properties: {
          companyName: { type: 'string', description: 'Company / business name (razón social / ragione sociale).' },
          amount: { type: 'string', description: 'Amount paid in euros (e.g. "8.50", "8,50 €", "8 euros"). Free-form.' },
          serviceDate: { type: 'string', description: 'When the service was used: ISO ("2026-05-27"), DD/MM/YYYY ("27/05/2026"), or natural ("oggi", "ayer", "today", "yesterday").' },
          email: { type: 'string', description: 'Customer email for invoice delivery.' },
          note: { type: 'string', description: 'Optional note (CIF, customer code, reference). Pass empty string if customer said "no".' },
        },
        required: ['companyName', 'amount', 'serviceDate', 'email', 'note'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_operator',
      description:
        'Send a structured briefing to the human operator by email. Call this when the procedure documented in MACHINES says ESCALAR, when the customer explicitly asks for a human, or when a problem persists after the documented steps. The summary should be a self-contained operator briefing following the template in common.md. The host will substitute placeholder PII tokens with real values from SessionState before sending.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            enum: [
              'machine_broken',
              'door_persistent',
              'alarm_technical',
              'double_charge',
              'no_change',
              'invoice_request',
              'loyalty_card',
              'no_soap',
              'no_spin',
              'angry_customer',
              'not_covered',
              'other',
            ],
            description: 'High-level reason code for the escalation.',
          },
          summary: {
            type: 'string',
            description:
              `CRITICAL: Write the ENTIRE briefing in ${SETTINGS.operatorBriefingLanguage.toUpperCase()} (ISO code: ${SETTINGS.operatorBriefingLanguage}). NEVER use the customer conversation language. Even if the customer spoke Italian, the briefing MUST be in ${SETTINGS.operatorBriefingLanguage.toUpperCase()}. Use the exact template from common.md. Include all known facts from SESSION STATE.`,
          },
        },
        required: ['reason', 'summary'],
        additionalProperties: false,
      },
    },
  },
]

// ── Tool dispatcher ───────────────────────────────────────────────────────────

interface ToolResult {
  ok: boolean
  [k: string]: unknown
}

interface ToolContext {
  sessionId: string
  customerName?: string
  customerPhone?: string
  /** Effective settings for this turn: DB-merged overrides from the host
   *  (config.settings) spread over the module's settings.json defaults. */
  settings: Settings
  /** Workspace-owned guard copy from config.messages, already rendered by the
   *  host. Takes priority over the settings keys of the same meaning. */
  guardMessages?: {
    rateLimited?: string | null
    sessionTooLong?: string | null
  } | null
  /** Operator briefing produced by escalate_to_operator this turn, with PII
   *  placeholders already resolved. chatbotFn hands it to the host, which owns
   *  the actual delivery (shared SMTP transport + recipient routing). */
  escalationBriefing?: string
}

/** Machine number from a tool argument, accepting both 4 and "4". */
function parseMachineNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{1,3}$/.test(trimmed)) {
      const parsed = Number(trimmed)
      if (parsed > 0) return parsed
    }
  }
  return null
}

async function executeTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  if (name === 'remember') {
    const patch: Partial<SessionState> = {}
    if (typeof args.name === 'string') patch.name = args.name
    if (typeof args.location === 'string') patch.location = args.location
    if (args.machineType === 'washer' || args.machineType === 'dryer') patch.machineType = args.machineType
    // The schema says integer, but models routinely send "4" as a string. It
    // used to be dropped silently, losing the machine number for the rest of
    // the conversation — and a price answered without it comes from the wrong
    // table row (seen live 2026-08-20: 7 € quoted for Alemanya washer 4).
    const machine = parseMachineNumber(args.machine)
    if (machine !== null) patch.machine = machine
    if (typeof args.displayCode === 'string') patch.displayCode = args.displayCode
    if (typeof args.symptom === 'string' && args.symptom.trim()) patch.symptom = args.symptom.trim()
    // NOTE: `language` is NOT accepted here anymore. Language is detected
    // deterministically by `updateLanguageOnTurn()` before each turn. See
    // architecture.md §"T1 empty-reply fix".
    const state = updateState(ctx.sessionId, patch)
    return { ok: true, state }
  }

  if (name === 'request_invoice') {
    const state = getState(ctx.sessionId)
    // Substitute placeholders the LLM may have used (e.g. [COMPANY_NAME] if
    // the customer's company was de-redacted in history). The real values
    // live in SessionState. PII fields (email, cif, ...) are typically
    // captured fresh in the current turn by the pre-scan, so they arrive
    // here as literal values; placeholders are mostly a defense for
    // non-PII profile fields (companyName, address) reused across turns.
    const companyName = substitutePlaceholders(
      typeof args.companyName === 'string' ? args.companyName.trim() : '',
      state,
    )
    const amount = typeof args.amount === 'string' ? args.amount.trim() : ''
    const serviceDate = typeof args.serviceDate === 'string' ? args.serviceDate.trim() : ''
    const email = substitutePlaceholders(
      typeof args.email === 'string' ? args.email.trim() : '',
      state,
    )
    const note = substitutePlaceholders(
      typeof args.note === 'string' ? args.note.trim() : '',
      state,
    )

    // Persist customer's structured invoice profile into the state so the
    // host can mirror it into Customers via patches.
    const profilePatch: Partial<SessionState> = {}
    if (companyName) profilePatch.companyName = companyName
    if (note) profilePatch.notes = note
    if (Object.keys(profilePatch).length > 0) {
      updateState(ctx.sessionId, profilePatch)
    }

    if (!companyName) return { ok: false, error: 'companyName is required' }
    if (!amount) return { ok: false, error: 'amount is required' }
    if (!serviceDate) return { ok: false, error: 'serviceDate is required' }
    if (!email) return { ok: false, error: 'email is required' }

    if (!isValidEmail(email)) {
      return { ok: false, error: `email "${email}" is not valid. Re-ask the customer for a valid email.` }
    }

    const normalizedDate = normalizeDate(serviceDate)
    if (!normalizedDate) {
      return {
        ok: false,
        error: `serviceDate "${serviceDate}" is not recognized. Accept ISO ("2026-05-27"), DD/MM/YYYY, or "today"/"yesterday"/"oggi"/"ayer". Re-ask the customer.`,
      }
    }

    // 🧾 Consent-gated PII persistence: the customer explicitly asked for an
    // invoice, so persist their email into the Customers anagrafica (for future
    // invoices). This is the ONLY path that writes email to the DB — PII is
    // never auto-mirrored (iron rule #5). Decided with Andrea 2026-06-05.
    pushPatch(ctx.sessionId, 'email', email)

    const invoiceId = `INV-${Date.now().toString(36).toUpperCase()}`

    try {
      await sendInvoiceEmail({
        invoiceId,
        companyName,
        amount,
        serviceDate: normalizedDate,
        email,
        note,
        state,
        settings: ctx.settings,
        customerName: ctx.customerName,
        customerPhone: ctx.customerPhone,
      })
      return { ok: true, invoice_id: invoiceId, email_sent: !!GMAIL_USER }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[invoice_email_failed] ${msg}`)
      // Return ok:true so the bot can still tell the customer the request
      // is registered — operator will see the audit log entry.
      return { ok: true, invoice_id: invoiceId, email_sent: false, email_error: msg }
    }
  }

  if (name === 'escalate_to_operator') {
    const reason = typeof args.reason === 'string' ? args.reason : 'other'
    const rawSummary = typeof args.summary === 'string' ? args.summary : ''
    if (!rawSummary) {
      return { ok: false, error: 'summary is required and must be a non-empty string' }
    }
    const state = getState(ctx.sessionId)

    if (!state.name) {
      return {
        ok: false,
        error: 'missing_customer_name',
        instruction: 'Customer name is required before escalation. Ask the customer their name in their language, save it with remember({name: "..."}), then retry escalate_to_operator with the same summary.',
      }
    }

    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`

    // Substitute placeholders ([CUSTOMER_NAME], [CIF], ...) with real values
    // from SessionState before sending to the operator. The LLM-produced
    // summary contains placeholders because the LLM never saw real PII.
    const summary = substitutePlaceholders(rawSummary, state)

    // Delivery belongs to the HOST: it already owns the shared SMTP transport
    // (SMTP_HOST/SMTP_USER/… — the module's own Gmail credentials do not exist
    // in production) plus recipient routing and multi-operator delivery modes.
    // We only build the briefing and hand it up through ChatbotOutput.
    logEscalationBriefing({ ticketId, reason, summary, state, settings: ctx.settings, customerName: ctx.customerName, customerPhone: ctx.customerPhone })
    ctx.escalationBriefing = summary

    return { ok: true, ticket_id: ticketId, eta_minutes: 5 }
  }

  return { ok: false, error: `unknown tool: ${name}` }
}

// ── Validators (used by request_invoice tool) ────────────────────────────────

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false
  return EMAIL_RE.test(email)
}

// Accept: ISO ("2026-05-27"), DD/MM/YYYY ("27/05/2026"), DD-MM-YYYY,
// "today"/"yesterday"/"oggi"/"ieri"/"ayer"/"hoy"/"aujourd'hui"/"hier"/"hoje"/"ontem"/"avui"/"ahir".
// Returns ISO date string ("YYYY-MM-DD") if recognized, null otherwise.
function normalizeDate(input: string): string | null {
  const s = input.trim().toLowerCase()
  if (!s) return null

  const TODAY = /^(today|oggi|hoy|aujourd'hui|hoje|avui)$/
  const YESTERDAY = /^(yesterday|ieri|ayer|hier|ontem|ahir)$/

  if (TODAY.test(s)) return new Date().toISOString().slice(0, 10)
  if (YESTERDAY.test(s)) {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }

  // ISO: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`)
    if (!Number.isNaN(d.getTime())) return `${iso[1]}-${iso[2]}-${iso[3]}`
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const eu = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (eu) {
    const dd = eu[1].padStart(2, '0')
    const mm = eu[2].padStart(2, '0')
    const yyyy = eu[3]
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`)
    if (!Number.isNaN(d.getTime())) return `${yyyy}-${mm}-${dd}`
  }

  return null
}

// ── Email — invoice request ──────────────────────────────────────────────────

interface InvoiceParams {
  invoiceId: string
  companyName: string
  amount: string
  serviceDate: string
  email: string
  note: string
  state: SessionState
  settings: Settings
  customerName?: string
  customerPhone?: string
}

async function sendInvoiceEmail(params: InvoiceParams): Promise<void> {
  const { invoiceId, companyName, amount, serviceDate, email, note, state, settings, customerName, customerPhone } = params
  const operatorEmail = resolveOperatorEmail(settings)

  console.error('\n══════ INVOICE REQUEST ══════')
  console.error(`Invoice ID: ${invoiceId}`)
  console.error(`To: ${operatorEmail || '(no operatorEmail configured)'}`)
  console.error(`Company: ${companyName}`)
  console.error(`Amount: ${amount}`)
  console.error(`Service date: ${serviceDate}`)
  console.error(`Customer email: ${email}`)
  console.error(`Note: ${note || '(none)'}`)
  console.error(`Customer (from state): ${state.name ?? customerName ?? '?'}`)
  console.error(`Customer phone: ${customerPhone ?? '?'}`)
  console.error(`Location (if known): ${state.location ?? '?'}`)
  console.error('══════════════════════════════\n')

  if (!operatorEmail) {
    throw new Error('operatorEmail not configured (settings or env)')
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD missing in .env (invoice request logged to console only)')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })

  const subject = `${settings.emailSubjectPrefix.replace('Incidencia', 'Factura')} ${invoiceId} — ${companyName}`
  const textBody = [
    `Solicitud de factura: ${invoiceId}`,
    '',
    `Razón social: ${companyName}`,
    `Importe: ${amount}`,
    `Fecha del servicio: ${serviceDate}`,
    `Email del cliente: ${email}`,
    `Nota: ${note || '(ninguna)'}`,
    '',
    `Cliente: ${state.name ?? customerName ?? '?'}`,
    `Teléfono: ${customerPhone ?? '?'}`,
    `Sede (si se conoce): ${state.location ?? '?'}`,
    '',
    '— Ecolaundry Bot',
  ].join('\n')

  await transporter.sendMail({
    from: settings.emailFrom,
    to: operatorEmail,
    subject,
    text: textBody,
  })
}

// ── Escalation briefing (audit log) ───────────────────────────────────────────
// The briefing is logged here as the module's audit trail; the EMAIL itself is
// sent by the host from ChatbotOutput.escalationSummary (see chatbotFn).

interface EscalationParams {
  ticketId: string
  reason: string
  summary: string
  state: SessionState
  settings: Settings
  customerName?: string
  customerPhone?: string
}

function logEscalationBriefing(params: EscalationParams): void {
  const { ticketId, reason, summary, state, settings, customerName, customerPhone } = params

  console.error('\n══════ ESCALATION BRIEFING ══════')
  console.error(`Ticket: ${ticketId}`)
  console.error(`Reason: ${reason}`)
  console.error(`To: ${resolveOperatorEmail(settings) || '(recipient resolved by host)'}`)
  console.error(`Customer (from state): ${state.name ?? customerName ?? '?'}`)
  console.error(`Phone: ${customerPhone ?? '?'}`)
  console.error(`Location: ${state.location ?? '?'}`)
  console.error(`Machine: ${state.machine ?? '?'} (${state.machineType ?? '?'})`)
  console.error(`Display: ${state.displayCode ?? '?'}`)
  console.error(`Language: ${state.language ?? '?'}`)
  console.error('---')
  console.error(summary)
  console.error('══════════════════════════════════\n')
}

// ── LLM call with system-prompt caching ───────────────────────────────────────

interface LlmResponse {
  content: string | null
  tool_calls?: ToolCall[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

async function callLLM(
  cachedSystemPrompt: string,
  state: SessionState,
  history: Message[],
  settings: Settings,
  greeting?: string,
  options?: { withoutTools?: boolean },
): Promise<LlmResponse> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY missing in environment')

  const stateBlock = formatStateForPrompt(state)
  const missingFactsBlock = formatMissingFactsBlock(state)
  const runtimeBlock = formatRuntimeBlock(settings, greeting)

  // Cached block first (cache_control: ephemeral). State + runtime blocks are
  // appended WITHOUT cache_control so they can change per turn / per day
  // without invalidating the cache.
  const systemContent: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: cachedSystemPrompt,
      cache_control: { type: 'ephemeral' },
    },
  ]
  if (stateBlock) {
    systemContent.push({ type: 'text', text: stateBlock })
  }
  if (missingFactsBlock) {
    systemContent.push({ type: 'text', text: missingFactsBlock })
  }
  systemContent.push({ type: 'text', text: runtimeBlock })

  const payload: Record<string, unknown> = {
    model: resolveModel(settings),
    messages: [{ role: 'system', content: systemContent }, ...history],
    temperature: resolveTemperature(settings),
    max_tokens: resolveMaxTokens(settings),
  }
  // Omitting tools entirely (rather than tool_choice:'none') leaves the model
  // no way to reply except with text — used by the last-resort empty-reply call.
  if (!options?.withoutTools) {
    payload.tools = TOOLS
    payload.tool_choice = 'auto'
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://echatbot.ai',
      'X-Title': 'Ecolaundry',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenRouter HTTP ${res.status}: ${body.slice(0, 500)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      prompt_tokens_details?: { cached_tokens?: number }
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }

  if (process.env.LLM_DEBUG === '1' && data.usage) {
    const u = data.usage
    const cached = u.cache_read_input_tokens ?? u.prompt_tokens_details?.cached_tokens ?? 0
    const created = u.cache_creation_input_tokens ?? 0
    console.error(
      `[usage] prompt=${u.prompt_tokens ?? '?'} completion=${u.completion_tokens ?? '?'} cache_read=${cached} cache_write=${created}`,
    )
  }

  const msg = data.choices?.[0]?.message
  return {
    content: msg?.content ?? null,
    tool_calls: msg?.tool_calls,
    usage: {
      prompt_tokens: data.usage?.prompt_tokens,
      completion_tokens: data.usage?.completion_tokens,
    },
  }
}

// ── Turn pipeline ─────────────────────────────────────────────────────────────

interface TurnResult {
  reply: string
  tokensUsed: number
  escalated: boolean
}

async function agentTurnInternal(
  ctx: ToolContext,
  cachedSystemPrompt: string,
  history: Message[],
  sanitizedMessage: string,
  greeting?: string,
): Promise<TurnResult> {
  history.push({ role: 'user', content: sanitizedMessage })

  let tokensUsed = 0
  let escalated = false
  const maxToolHops = ctx.settings.maxToolHops

  for (let hop = 0; hop < maxToolHops; hop++) {
    const state = getState(ctx.sessionId)
    const response = await callLLM(cachedSystemPrompt, state, history, ctx.settings, greeting)
    tokensUsed +=
      (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0)

    // No tool calls → final text reply.
    if (!response.tool_calls || response.tool_calls.length === 0) {
      const text = (response.content || '').trim()

      // Empty-reply recovery (see architecture.md §7). Retried on EVERY empty
      // hop, not just the first: seen live 2026-08-20, the model went empty
      // twice in one turn and the single-shot nudge let the second one through
      // to the customer as silence.
      if (!text && hop < maxToolHops - 1) {
        history.push({ role: 'assistant', content: '' })
        history.push({
          role: 'user',
          content:
            '[system] Your previous reply was empty. Please respond to the customer now, in their language, following the rules in the system prompt. Do not call any more tools unless strictly necessary.',
        })
        console.error('[empty_reply_nudge] retrying with explicit instruction')
        continue
      }

      history.push({ role: 'assistant', content: text })
      if (process.env.LLM_DEBUG === '1') {
        console.error(`[state] ${formatStateOneLine(getState(ctx.sessionId))}`)
      }
      return { reply: text, tokensUsed, escalated }
    }

    // Tool calls present → execute each, append results, loop.
    history.push({
      role: 'assistant',
      content: response.content ?? null,
      tool_calls: response.tool_calls,
    })
    for (const call of response.tool_calls) {
      let args: Record<string, unknown> = {}
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {}
      } catch (err) {
        args = {}
        if (process.env.LLM_DEBUG === '1') {
          console.error(
            `[tool_call_parse_error] ${call.function.name}: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }
      if (process.env.LLM_DEBUG === '1') {
        console.error(`[tool_call] ${call.function.name}(${JSON.stringify(args)})`)
      }
      const result = await executeTool(ctx, call.function.name, args)
      if (call.function.name === 'escalate_to_operator' && result.ok) {
        escalated = true
      }
      history.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result),
      })
    }
  }

  // Hop budget exhausted with no text. Rather than hand the customer silence,
  // make one last tools-disabled call: with no tools on the request the model
  // has nothing to answer with except words.
  console.error(`[warn] max tool hops (${maxToolHops}) reached without text reply — final text-only attempt`)
  try {
    const lastResort = await callLLM(cachedSystemPrompt, getState(ctx.sessionId), history, ctx.settings, greeting, {
      withoutTools: true,
    })
    tokensUsed += (lastResort.usage?.prompt_tokens ?? 0) + (lastResort.usage?.completion_tokens ?? 0)
    const text = (lastResort.content || '').trim()
    if (text) {
      history.push({ role: 'assistant', content: text })
      return { reply: text, tokensUsed, escalated }
    }
  } catch (err) {
    console.error(`[empty_reply_last_resort_failed] ${err instanceof Error ? err.message : String(err)}`)
  }

  // Still nothing: surface it as an error so the host serves its configured
  // fallback instead of the customer seeing an empty bubble.
  console.error(`[empty_reply] session=${ctx.sessionId} produced no text after ${maxToolHops} hops`)
  return { reply: '', tokensUsed, escalated }
}

// Public per-turn entry point used by REPL/batch. Wraps with sanitize +
// rate-limit + per-session lock + turn cap. The backend integration
// (`chatbotFn`) calls this through the same wrapper.

async function agentTurn(
  ctx: ToolContext,
  cachedSystemPrompt: string,
  history: Message[],
  rawMessage: string,
  greeting?: string,
): Promise<TurnResult> {
  const sanitized = sanitizeUserMessage(rawMessage, ctx.settings.maxMessageChars)
  if (!sanitized) {
    return { reply: '', tokensUsed: 0, escalated: false }
  }

  const now = Date.now()
  const recentCount = registerMessageTimestamp(ctx.sessionId, now, 60_000)
  if (recentCount > ctx.settings.maxMessagesPerMinute) {
    const copy = ctx.guardMessages?.rateLimited ?? ctx.settings.rateLimitedMessage
    return { reply: copy || '', tokensUsed: 0, escalated: false }
  }

  const turnNum = incrementTurn(ctx.sessionId)
  if (turnNum > ctx.settings.maxTurnsPerSession) {
    const copy = ctx.guardMessages?.sessionTooLong ?? ctx.settings.sessionTooLongMessage
    return { reply: copy || '', tokensUsed: 0, escalated: false }
  }

  // Deterministic language detection BEFORE the LLM turn. Eliminates the
  // T1 empty-reply bug caused by `remember({language})` standalone tool calls.
  updateLanguageOnTurn(
    ctx.sessionId,
    sanitized,
    ctx.settings.enabledLanguages,
    ctx.settings.defaultLanguage,
  )

  // PII redaction (see pii.ts). Pre-scan extracts structured PII
  // (email/CIF/NIF/IBAN/card/phone) into SessionState and replaces them
  // with placeholders. De-redact uses already-known state to mask
  // re-occurrences of name/address/companyName. The cleaned text is what
  // goes into history and reaches the LLM.
  const state = getState(ctx.sessionId)
  const { cleanText, capturedKeys } = processIncomingMessage(ctx.sessionId, sanitized, state)
  if (process.env.LLM_DEBUG === '1' && capturedKeys.length > 0) {
    console.error(`[pii_redacted] ${capturedKeys.join(', ')}`)
  }

  return withSessionLock(ctx.sessionId, () =>
    agentTurnInternal(ctx, cachedSystemPrompt, history, cleanText, greeting),
  )
}

// ── System prompt ─────────────────────────────────────────────────────────────
// Assembled at boot from prompts/common.md + prompts/faqs.md +
// prompts/machines/*.md + prompts/locations/*.md. Concatenated in deterministic
// (alphabetical) order so the resulting blob is byte-identical across boots
// → cache hit always.

async function buildSystemPrompt(): Promise<string> {
  const common = await readFile(path.join(PROMPTS_DIR, 'common.md'), 'utf8')
  const faqs = await readFileOrEmpty(path.join(PROMPTS_DIR, 'faqs.md'))
  const machines = await loadDir(path.join(PROMPTS_DIR, 'machines'))
  const locations = await loadDir(path.join(PROMPTS_DIR, 'locations'))

  const parts: string[] = [common]

  if (faqs) {
    parts.push('', '════════ FAQS ════════', '', faqs)
  }

  if (machines.length > 0) {
    parts.push('', '════════ MACHINES ════════', '')
    for (const { name, content } of machines) {
      parts.push(`## ${name}`, '', content, '')
    }
  }

  if (locations.length > 0) {
    parts.push('', '════════ LOCATIONS ════════', '')
    for (const { name, content } of locations) {
      parts.push(`## ${name}`, '', content, '')
    }
  }

  return parts.join('\n')
}

/**
 * Whether a name identifies the customer or is one of the host's stand-ins for
 * "we don't know yet" (widget visitors arrive as "New Customer").
 */
function isRealCustomerName(name?: string): boolean {
  const trimmed = (name || '').trim()
  if (trimmed === '' || trimmed === 'Customer' || trimmed === 'New Customer') return false
  // Anonymous widget visitors reach us as "Visitor <last 8 chars of the id>"
  // (widget-chat.controller). That is an internal handle, not a name: greeting
  // someone as "Ciao Visitor 8_vcllde!" is worse than not naming them at all.
  if (/^Visitor(\s+\S+)?$/i.test(trimmed)) return false
  return true
}

/**
 * The configured greeting with {{customerName}} resolved, or undefined when
 * nothing is configured (no greeting is then delivered — never an invented one).
 * When the name is unknown the placeholder is dropped together with any
 * punctuation left dangling around it, so "Ciao {{customerName}}!" degrades to
 * "Ciao!" and not "Ciao !".
 */
function resolveGreetingText(
  settings: Settings,
  customerName: string | undefined,
  greeting: Greeting,
  hostMessages?: { welcomeBack?: string | null } | null,
): string | undefined {
  if (greeting === 'none') return undefined

  // Returning customer: workspace copy first (the host renders it), then the
  // module default, then the new-customer line rather than no greeting at all.
  const raw =
    greeting === 'returning'
      ? (hostMessages?.welcomeBack?.trim() ||
         settings.welcomeBackMessage?.trim() ||
         settings.welcomeMessage?.trim())
      : settings.welcomeMessage?.trim()
  if (!raw) return undefined

  const name = isRealCustomerName(customerName) ? customerName!.trim() : ''
  const resolved = name
    ? raw.replace(/\{\{\s*customerName\s*\}\}/g, name)
    // Drop the placeholder together with the separator that introduced it, so
    // "Hola {{customerName}}!" degrades to "Hola!" and never "Hola !".
    : raw.replace(/[ \t]*[,;:]?[ \t]*\{\{\s*customerName\s*\}\}/g, '')

  return resolved.trim() || undefined
}

/**
 * Facts the model must not infer from the absence of a SESSION STATE line.
 * A missing `Machine:` reads as "nothing to see here", and the model answered a
 * price anyway by picking a table row (2026-08-20: 7 € quoted for Alemanya
 * washer 4, which costs 4 €). Stating the gap outright — and what to do about
 * it — is a code-side guarantee, not another rule buried in common.md.
 */
function formatMissingFactsBlock(state: SessionState): string {
  const missing: string[] = []
  if (!state.location) missing.push('- Sede (location): DESCONOCIDA')
  if (state.machine === undefined) missing.push('- Número de máquina: DESCONOCIDO')
  if (!state.machineType) missing.push('- Tipo de máquina (lavadora/secadora): DESCONOCIDO')
  if (missing.length === 0) return ''

  return [
    '',
    '═══ DATOS QUE AÚN NO TIENES ═══',
    ...missing,
    '',
    'Un precio depende de la sede Y del tipo Y del número exacto de máquina:',
    'máquinas contiguas cuestan distinto. Si el cliente pide un precio y alguno',
    'de esos datos falta arriba, PREGÚNTALO en vez de responder con un importe.',
    'Nunca deduzcas el dato que falta ni des un precio "aproximado".',
    '',
  ].join('\n')
}

function formatRuntimeBlock(settings: Settings, greeting?: string): string {
  const now = new Date()
  const date = now.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const time = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const lines = [
    '',
    '═══ RUNTIME ═══',
    `Current date: ${date}`,
    `Current time: ${time}`,
    `Operator briefing language: ${settings.operatorBriefingLanguage}`,
  ]

  if (greeting) {
    lines.push(
      '',
      '═══ SALUDO DE APERTURA (primer turno) ═══',
      'Es el primer mensaje de este cliente. Abre tu respuesta con este saludo,',
      "TRADUCIDO al idioma del cliente y escrito con naturalidad en ese idioma:",
      '',
      greeting,
      '',
      'Luego, en el MISMO mensaje, atiende lo que el cliente acaba de pedir.',
      'No lo saludes dos veces ni añadas otra presentación tuya.',
    )
  }

  lines.push('')
  return lines.join('\n')
}

async function readFileOrEmpty(filepath: string): Promise<string> {
  try {
    return await readFile(filepath, 'utf8')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return ''
    throw err
  }
}

async function loadDir(dir: string): Promise<Array<{ name: string; content: string }>> {
  const files = await readdir(dir)
  const mdFiles = files.filter((f) => f.endsWith('.md')).sort()
  const out: Array<{ name: string; content: string }> = []
  for (const f of mdFiles) {
    const content = await readFile(path.join(dir, f), 'utf8')
    out.push({ name: f.replace(/\.md$/, ''), content })
  }
  return out
}

// ── Public API for backend integration ────────────────────────────────────────
// Contract expected by apps/backend/src/application/services/
// custom-client-chatbot.service.ts (CustomClientChatbotService.invoke).
// The backend loads this module via `workspace.customChatbotId` and calls
// `chatbotFn(input)`. See architecture.md §"Backend integration".

export interface HistoryEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface ChatbotInput {
  userMessage: string
  userName: string
  channel: 'whatsapp' | 'widget' | 'playground'
  config: {
    workspaceId: string
    debugChannel: boolean
    isPlayground: boolean
    // Host's phone-prefix/DB guess. Deliberately ignored (see chatbotFn) —
    // language is detected per turn from the message. Open string because the
    // detector + LLM cover far more than any closed list.
    language?: string
    /** Effective settings the host resolves from the DATABASE on every turn
     *  (Settings UI saves land here). Merged over settings.json defaults via
     *  effectiveSettings() — same contract as the other custom-* modules. */
    settings?: Partial<Settings> | null
    /** Workspace-owned customer copy, rendered by the host. */
    messages?: {
      rateLimited?: string | null
      sessionTooLong?: string | null
    } | null
  }
  context: {
    sessionId: string
    customerId?: string
    phoneNumber?: string
    history: HistoryEntry[]
    /** Durable state this module returned on a previous turn, possibly from
     *  another dyno. Hydrated back into the in-RAM session map. */
    persistedState?: unknown
  }
}

export interface ChatbotOutput {
  reply: string | null
  shouldEscalate: boolean
  /** Operator briefing, PII resolved. The host emails it (shared SMTP). */
  escalationSummary?: string
  notificationEmails?: string
  /** Durable session state; the host stores it on ChatSession.context and
   *  returns it as `context.persistedState` on the next turn. */
  persistedState?: unknown
  /** When true, the host should close this chat session and stop forwarding
   *  new customer messages to the bot. Set after the bot completes an
   *  escalation flow (the operator now owns the conversation). */
  closeChat: boolean
  patches?: CustomerPatch[]
  meta: {
    tokensUsed: number
    agentChain: string[]
  }
  error?: string
}

// Build the system prompt once at module load. Cached across all backend
// invocations because the file content doesn't change at runtime.
let cachedSystemPromptPromise: Promise<string> | null = null
function getCachedSystemPrompt(): Promise<string> {
  if (!cachedSystemPromptPromise) cachedSystemPromptPromise = buildSystemPrompt()
  return cachedSystemPromptPromise
}

export async function chatbotFn(input: ChatbotInput): Promise<ChatbotOutput> {
  try {
    if (!API_KEY) {
      return {
        reply: null,
        shouldEscalate: false,
        closeChat: false,
        meta: { tokensUsed: 0, agentChain: ['custom-ecolaundry'] },
        error: 'llm_unavailable',
      }
    }

    const systemPrompt = await getCachedSystemPrompt()
    const sessionId = input.context.sessionId

    // 🌐 LANGUAGE = decided by the CUSTOMER'S MESSAGE, never by the phone
    // prefix. We deliberately DO NOT seed state.language from
    // input.config.language (a phone-prefix / DB guess): doing so makes the bot
    // keep the guessed language instead of detecting from what the customer
    // actually wrote. Language is detected deterministically from the message
    // by updateLanguageOnTurn(sanitized) inside the turn.

    // Convert backend history → our internal Message[]. The backend may
    // have a richer history than what's in our RAM if this process just
    // restarted; we rebuild the conversation context from their record.
    const history: Message[] = input.context.history.map((h) => ({
      role: h.role,
      content: h.content,
    }))

    const settings = effectiveSettings(input.config.settings)

    // Restore durable state before anything reads it: Heroku recycles dynos and
    // may run several, so the in-RAM Map alone loses the conversation mid-flow.
    hydrateState(sessionId, input.context.persistedState)

    const ctx: ToolContext = {
      sessionId,
      customerName: input.userName,
      customerPhone: input.context.phoneNumber,
      settings,
      guardMessages: input.config.messages ?? null,
    }

    // 👤 Pre-seed the name from the WhatsApp profile (input.userName) so the bot
    // greets the customer by name and does NOT ask "how shall I call you?" again.
    // Only seed when we don't already have a name in state and the profile name
    // is a real one (not the "New Customer"/"Customer" placeholder).
    const seededState = getState(sessionId)
    if (!seededState.name && isRealCustomerName(input.userName)) {
      updateState(sessionId, { name: input.userName.trim() })
    }

    // 👋 Greeting: the host skips its own standalone welcome for workspaces
    // running a custom module (welcome-message.handler), so the opening line is
    // ours to deliver. CODE decides WHEN (first turn only, no prior history);
    // the TEXT comes from configuration and the LLM renders it in the
    // customer's language. Nothing configured → no greeting at all, never a
    // hardcoded one (CLAUDE.md §1A).
    const isFirstTurn = input.context.history.length === 0
    const greeting = isFirstTurn ? resolveGreetingText(settings, getState(sessionId).name) : undefined

    const result = await agentTurn(ctx, systemPrompt, history, input.userMessage, greeting)
    const patches = drainPatches(sessionId)

    // Silence is never an acceptable answer: after the retries inside the turn
    // still produced nothing, report it as an LLM failure so the host serves
    // its configured fallback instead of an empty bubble (seen live
    // 2026-08-20 — two empty replies out of four messages).
    const reply = result.reply || null
    if (reply === null && !result.escalated) {
      console.error(`[chatbotFn] empty reply for session=${sessionId} — serving host fallback`)
      return {
        reply: null,
        shouldEscalate: false,
        closeChat: false,
        patches: patches.length > 0 ? patches : undefined,
        persistedState: dehydrateState(sessionId),
        meta: { tokensUsed: result.tokensUsed, agentChain: ['custom-ecolaundry'] },
        error: 'llm_unavailable',
      }
    }

    return {
      reply,
      shouldEscalate: result.escalated,
      // The real operator briefing (PII already resolved), not a bare ticket id:
      // the host emails exactly this text through its shared SMTP transport.
      escalationSummary: ctx.escalationBriefing,
      notificationEmails: result.escalated ? resolveOperatorEmail(settings) || undefined : undefined,
      closeChat: result.escalated,
      patches: patches.length > 0 ? patches : undefined,
      persistedState: dehydrateState(sessionId),
      meta: {
        tokensUsed: result.tokensUsed,
        agentChain: ['custom-ecolaundry'],
      },
    }
  } catch (err) {
    console.error(`[chatbotFn] error: ${err instanceof Error ? err.message : String(err)}`)
    return {
      reply: null,
      shouldEscalate: false,
      closeChat: false,
      meta: { tokensUsed: 0, agentChain: ['custom-ecolaundry'] },
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function runInteractive(systemPrompt: string): Promise<void> {
  const sessionId = 'cli-interactive'
  const history: Message[] = []
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  console.log('Ecolaundry chatbot — assembled prompt + state + tools + escalation.')
  console.log('Commands: /exit /quit /reset /state')
  console.log(`model=${resolveModel(SETTINGS)} prompts=${PROMPTS_DIR}`)
  const cliOperatorEmail = resolveOperatorEmail(SETTINGS)
  if (cliOperatorEmail) {
    console.log(`operator email: ${cliOperatorEmail} ${GMAIL_USER ? '(SMTP active)' : '(SMTP not configured — briefings logged to console)'}`)
  }
  console.log('')

  const ctx: ToolContext = { sessionId, customerName: 'CLI User', settings: SETTINGS }

  while (true) {
    const input = (await rl.question('> ')).trim()
    if (!input) continue
    if (input === '/exit' || input === '/quit') break
    if (input === '/reset') {
      history.length = 0
      resetState(sessionId)
      console.log('[reset] history + state cleared')
      continue
    }
    if (input === '/state') {
      console.log(`[state] ${formatStateOneLine(getState(sessionId))} (turn ${getTurnCount(sessionId)})`)
      continue
    }
    try {
      const result = await agentTurn(ctx, systemPrompt, history, input)
      console.log(`\n${result.reply}\n`)
    } catch (err) {
      console.error(`[error] ${err instanceof Error ? err.message : String(err)}`)
      if (history.at(-1)?.role === 'user') history.pop()
    }
  }
  rl.close()
}

async function runBatch(systemPrompt: string, rawJson: string): Promise<void> {
  let plan: Array<string[] | string>
  try {
    plan = JSON.parse(rawJson)
    if (!Array.isArray(plan)) throw new Error('top-level must be an array')
  } catch (err) {
    console.error('Invalid --batch JSON:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  let sessionId = 'cli-batch-1'
  let history: Message[] = []
  let scenarioIdx = 0
  let ctx: ToolContext = { sessionId, customerName: 'Batch User', settings: SETTINGS }

  for (const entry of plan) {
    if (entry === '/reset') {
      console.log('\n[RESET] ──────────────────────────────────────────────')
      history = []
      resetState(sessionId)
      sessionId = `cli-batch-${scenarioIdx + 1}`
      ctx = { sessionId, customerName: 'Batch User', settings: SETTINGS }
      continue
    }
    if (!Array.isArray(entry)) {
      console.log(`\n[SKIP] non-array, non-reset entry: ${JSON.stringify(entry)}`)
      continue
    }
    scenarioIdx += 1
    console.log(`\n[SCENARIO ${scenarioIdx}] ═══════════════════════════════════`)
    for (let i = 0; i < entry.length; i += 1) {
      const turn = entry[i]
      console.log(`\n[USER T${i + 1}] ${turn}`)
      try {
        const result = await agentTurn(ctx, systemPrompt, history, turn)
        console.log(`[BOT T${i + 1}] ${result.reply}`)
      } catch (err) {
        console.log(`[ERROR T${i + 1}] ${err instanceof Error ? err.message : String(err)}`)
        if (history.at(-1)?.role === 'user') history.pop()
      }
    }
  }
  console.log('\n[BATCH DONE] ─────────────────────────────────────────────')
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function loadDotEnv(envFile: string): void {
  try {
    process.loadEnvFile(envFile)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return
    console.warn(`[warn] failed to load ${envFile}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function findBatchArg(): string | null {
  const i = process.argv.indexOf('--batch')
  if (i === -1) return null
  return process.argv[i + 1] ?? null
}

function isDirectExecution(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(path.resolve(entry)).href
}

if (isDirectExecution()) {
  if (process.argv.includes('--debug')) process.env.LLM_DEBUG = '1'
  if (!API_KEY) {
    console.error('OPENROUTER_API_KEY missing. Set it in this folder\'s .env file.')
    process.exit(1)
  }
  const main = async () => {
    const systemPrompt = await buildSystemPrompt()
    const batch = findBatchArg()
    if (batch !== null) {
      await runBatch(systemPrompt, batch)
    } else {
      await runInteractive(systemPrompt)
    }
  }
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
