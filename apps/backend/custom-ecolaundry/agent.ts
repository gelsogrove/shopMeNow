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
  formatStateForPrompt,
  formatStateOneLine,
  getState,
  getTurnCount,
  incrementTurn,
  registerMessageTimestamp,
  resetState,
  seedLanguageIfNeeded,
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
const MODEL = process.env.LLM_MODEL || SETTINGS.model
const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS || SETTINGS.maxTokens)
const TEMPERATURE = Number(process.env.LLM_TEMPERATURE || SETTINGS.temperature)
const MAX_TOOL_HOPS = SETTINGS.maxToolHops
const OPERATOR_BRIEFING_LANGUAGE = SETTINGS.operatorBriefingLanguage
const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || SETTINGS.operatorEmail
const EMAIL_FROM = SETTINGS.emailFrom
const EMAIL_SUBJECT_PREFIX = SETTINGS.emailSubjectPrefix
const MAX_MESSAGE_CHARS = SETTINGS.maxMessageChars
const MAX_MESSAGES_PER_MINUTE = SETTINGS.maxMessagesPerMinute
const MAX_TURNS_PER_SESSION = SETTINGS.maxTurnsPerSession

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

function sanitizeUserMessage(raw: string): string {
  let s = (raw ?? '').toString()
  s = s.replace(CONTROL_CHARS_RE, '')
  s = s.replace(ZERO_WIDTH_RE, '')
  s = s.replace(BIDI_RE, '')
  s = s.trim()
  if (s.length > MAX_MESSAGE_CHARS) {
    s = s.slice(0, MAX_MESSAGE_CHARS)
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
              'Operator briefing in the language indicated by RUNTIME.operatorBriefingLanguage. Use the exact template from common.md (header, 🕒 Fecha, 📍 Sede, 🔢 Máquina, 👤 Cliente, 🌐 Idioma, 🚨 Incidencia, 📋 Resumen, ✅ Acción sugerida). Include all known facts from SESSION STATE.',
          },
        },
        required: ['reason', 'summary'],
        additionalProperties: false,
      },
    },
  },
] as const

// ── Tool dispatcher ───────────────────────────────────────────────────────────

interface ToolResult {
  ok: boolean
  [k: string]: unknown
}

interface ToolContext {
  sessionId: string
  customerName?: string
  customerPhone?: string
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
    if (typeof args.machine === 'number' && Number.isFinite(args.machine)) patch.machine = args.machine
    if (typeof args.displayCode === 'string') patch.displayCode = args.displayCode
    if (typeof args.symptom === 'string' && args.symptom.trim()) patch.symptom = args.symptom.trim()
    // NOTE: `language` is NOT accepted here anymore. Language is detected
    // deterministically by `seedLanguageIfNeeded()` before each turn. See
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

    try {
      await sendEscalationEmail({
        ticketId,
        reason,
        summary,
        state,
        customerName: ctx.customerName,
        customerPhone: ctx.customerPhone,
      })
      return { ok: true, ticket_id: ticketId, eta_minutes: 5, email_sent: !!GMAIL_USER }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[escalation_email_failed] ${msg}`)
      // Still return ok:true so the bot can tell the customer the case has
      // been registered — the briefing is logged for retry/audit even if
      // email failed (e.g. SMTP down). The ticket exists.
      return { ok: true, ticket_id: ticketId, eta_minutes: 5, email_sent: false, email_error: msg }
    }
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
  customerName?: string
  customerPhone?: string
}

async function sendInvoiceEmail(params: InvoiceParams): Promise<void> {
  const { invoiceId, companyName, amount, serviceDate, email, note, state, customerName, customerPhone } = params

  console.error('\n══════ INVOICE REQUEST ══════')
  console.error(`Invoice ID: ${invoiceId}`)
  console.error(`To: ${OPERATOR_EMAIL || '(no operatorEmail configured)'}`)
  console.error(`Company: ${companyName}`)
  console.error(`Amount: ${amount}`)
  console.error(`Service date: ${serviceDate}`)
  console.error(`Customer email: ${email}`)
  console.error(`Note: ${note || '(none)'}`)
  console.error(`Customer (from state): ${state.name ?? customerName ?? '?'}`)
  console.error(`Customer phone: ${customerPhone ?? '?'}`)
  console.error(`Location (if known): ${state.location ?? '?'}`)
  console.error('══════════════════════════════\n')

  if (!OPERATOR_EMAIL) {
    throw new Error('OPERATOR_EMAIL not configured (settings.json or env)')
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD missing in .env (invoice request logged to console only)')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })

  const subject = `${EMAIL_SUBJECT_PREFIX.replace('Incidencia', 'Factura')} ${invoiceId} — ${companyName}`
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
    from: EMAIL_FROM,
    to: OPERATOR_EMAIL,
    subject,
    text: textBody,
  })
}

// ── Email escalation ──────────────────────────────────────────────────────────
// Real SMTP via Gmail App Password. Falls back to console-only briefing when
// GMAIL_USER/GMAIL_APP_PASSWORD are not set (POC / first run).

interface EscalationParams {
  ticketId: string
  reason: string
  summary: string
  state: SessionState
  customerName?: string
  customerPhone?: string
}

async function sendEscalationEmail(params: EscalationParams): Promise<void> {
  const { ticketId, reason, summary, state, customerName, customerPhone } = params

  // Always log the briefing — single source of truth for audit / fallback.
  console.error('\n══════ ESCALATION BRIEFING ══════')
  console.error(`Ticket: ${ticketId}`)
  console.error(`Reason: ${reason}`)
  console.error(`To: ${OPERATOR_EMAIL || '(no operatorEmail configured)'}`)
  console.error(`Customer (from state): ${state.name ?? customerName ?? '?'}`)
  console.error(`Phone: ${customerPhone ?? '?'}`)
  console.error(`Location: ${state.location ?? '?'}`)
  console.error(`Machine: ${state.machine ?? '?'} (${state.machineType ?? '?'})`)
  console.error(`Display: ${state.displayCode ?? '?'}`)
  console.error(`Language: ${state.language ?? '?'}`)
  console.error('---')
  console.error(summary)
  console.error('══════════════════════════════════\n')

  if (!OPERATOR_EMAIL) {
    throw new Error('OPERATOR_EMAIL not configured (settings.json or env)')
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    // Soft-fail in POC: log warning, don't crash. Production should make this hard.
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD missing in .env (briefing logged to console only)')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })

  const subject = `${EMAIL_SUBJECT_PREFIX} ${ticketId} — ${state.location ?? 'sede ?'} — ${reason}`
  const textBody = [
    `Ticket: ${ticketId}`,
    `Razón: ${reason}`,
    '',
    summary,
    '',
    '— Ecolaundry Bot',
  ].join('\n')

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: OPERATOR_EMAIL,
    subject,
    text: textBody,
  })
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
): Promise<LlmResponse> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY missing in environment')

  const stateBlock = formatStateForPrompt(state)
  const runtimeBlock = formatRuntimeBlock()

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
  systemContent.push({ type: 'text', text: runtimeBlock })

  const payload = {
    model: MODEL,
    messages: [{ role: 'system', content: systemContent }, ...history],
    tools: TOOLS,
    tool_choice: 'auto',
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
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
): Promise<TurnResult> {
  history.push({ role: 'user', content: sanitizedMessage })

  let nudgedAfterEmpty = false
  let tokensUsed = 0
  let escalated = false

  for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
    const state = getState(ctx.sessionId)
    const response = await callLLM(cachedSystemPrompt, state, history)
    tokensUsed +=
      (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0)

    // No tool calls → final text reply.
    if (!response.tool_calls || response.tool_calls.length === 0) {
      const text = (response.content || '').trim()

      // Empty-reply recovery (see architecture.md §7).
      if (!text && !nudgedAfterEmpty && hop < MAX_TOOL_HOPS - 1) {
        nudgedAfterEmpty = true
        history.push({ role: 'assistant', content: '' })
        history.push({
          role: 'user',
          content:
            '[system] Your previous reply was empty. Please respond to the customer now, in their language, following the rules in the system prompt. Do not call any more tools unless strictly necessary.',
        })
        if (process.env.LLM_DEBUG === '1') {
          console.error('[empty_reply_nudge] retrying with explicit instruction')
        }
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

  if (process.env.LLM_DEBUG === '1') {
    console.error(`[warn] max tool hops (${MAX_TOOL_HOPS}) reached without text reply`)
  }
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
): Promise<TurnResult> {
  const sanitized = sanitizeUserMessage(rawMessage)
  if (!sanitized) {
    return { reply: '', tokensUsed: 0, escalated: false }
  }

  const now = Date.now()
  const recentCount = registerMessageTimestamp(ctx.sessionId, now, 60_000)
  if (recentCount > MAX_MESSAGES_PER_MINUTE) {
    return {
      reply:
        'Has enviado muchos mensajes en poco tiempo. Por favor espera un momento antes de continuar.',
      tokensUsed: 0,
      escalated: false,
    }
  }

  const turnNum = incrementTurn(ctx.sessionId)
  if (turnNum > MAX_TURNS_PER_SESSION) {
    return {
      reply:
        'Esta conversación es muy larga. Por favor inicia una nueva sesión o contacta directamente con un operador.',
      tokensUsed: 0,
      escalated: false,
    }
  }

  // Deterministic language detection BEFORE the LLM turn. Eliminates the
  // T1 empty-reply bug caused by `remember({language})` standalone tool calls.
  seedLanguageIfNeeded(ctx.sessionId, sanitized)

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
    agentTurnInternal(ctx, cachedSystemPrompt, history, cleanText),
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

function formatRuntimeBlock(): string {
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
  return [
    '',
    '═══ RUNTIME ═══',
    `Current date: ${date}`,
    `Current time: ${time}`,
    `Operator briefing language: ${OPERATOR_BRIEFING_LANGUAGE}`,
    '',
  ].join('\n')
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
    language?: 'es' | 'ca' | 'en' | 'it' | 'fr' | 'pt'
  }
  context: {
    sessionId: string
    customerId?: string
    phoneNumber?: string
    history: HistoryEntry[]
  }
}

export interface ChatbotOutput {
  reply: string | null
  shouldEscalate: boolean
  escalationSummary?: string
  notificationEmails?: string
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
    // by seedLanguageIfNeeded(sanitized) inside the turn.

    // Convert backend history → our internal Message[]. The backend may
    // have a richer history than what's in our RAM if this process just
    // restarted; we rebuild the conversation context from their record.
    const history: Message[] = input.context.history.map((h) => ({
      role: h.role,
      content: h.content,
    }))

    const ctx: ToolContext = {
      sessionId,
      customerName: input.userName,
      customerPhone: input.context.phoneNumber,
    }

    const result = await agentTurn(ctx, systemPrompt, history, input.userMessage)
    const patches = drainPatches(sessionId)

    return {
      reply: result.reply || null,
      shouldEscalate: result.escalated,
      escalationSummary: result.escalated ? `Ticket created for ${sessionId}` : undefined,
      notificationEmails: result.escalated ? OPERATOR_EMAIL || undefined : undefined,
      closeChat: result.escalated,
      patches: patches.length > 0 ? patches : undefined,
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
  console.log(`model=${MODEL} prompts=${PROMPTS_DIR}`)
  if (OPERATOR_EMAIL) {
    console.log(`operator email: ${OPERATOR_EMAIL} ${GMAIL_USER ? '(SMTP active)' : '(SMTP not configured — briefings logged to console)'}`)
  }
  console.log('')

  const ctx: ToolContext = { sessionId, customerName: 'CLI User' }

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
  let ctx: ToolContext = { sessionId, customerName: 'Batch User' }

  for (const entry of plan) {
    if (entry === '/reset') {
      console.log('\n[RESET] ──────────────────────────────────────────────')
      history = []
      resetState(sessionId)
      sessionId = `cli-batch-${scenarioIdx + 1}`
      ctx = { sessionId, customerName: 'Batch User' }
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
