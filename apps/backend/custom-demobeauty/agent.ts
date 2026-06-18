// Demobeauty chatbot — beauty-center franchise (multi-sede, per-sede services
// and prices). Prompt-driven LLM with cached system prompt, session state,
// appointment booking and escalation by email.
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
  type CartItem,
  type CustomerPatch,
  type SessionState,
  cartTotal,
  commitLanguageFromReply,
  drainPatches,
  extractLanguage,
  formatStateForPrompt,
  formatStateOneLine,
  getState,
  getTurnCount,
  incrementTurn,
  markEscalationOnce,
  registerMessageTimestamp,
  resetCart,
  resetState,
  setCart,
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
  /** When true, the host may reply with audio if the customer sent audio.
   *  When false, the host always replies with text regardless of input. */
  audioOutput: boolean
  /** Per-language ElevenLabs voice IDs. Key = language code (it/es/en/…),
   *  plus a "default" used when the customer language has no entry. */
  audioVoices: Record<string, string>
  /** Public URL of the legal/privacy notice ("aviso legal") shown in the
   *  first-turn GDPR disclaimer. Environment-dependent: production points to
   *  https://www.echatbot.ai/aviso-legal (note: the www subdomain is required —
   *  the bare echatbot.ai host 404s), local dev to http://localhost:3000/aviso-legal.
   *  Overridable at runtime via the PRIVACY_POLICY_URL env var. */
  privacyPolicyUrl: string
}

const DEFAULT_SETTINGS: Settings = {
  model: 'anthropic/claude-haiku-4.5',
  temperature: 0.3,
  maxTokens: 800,
  maxToolHops: 4,
  operatorBriefingLanguage: 'it',
  operatorEmail: '',
  emailFrom: 'Demobeauty Bot <noreply@demobeauty.demo>',
  emailSubjectPrefix: '[Demobeauty] Richiesta',
  maxMessageChars: 2000,
  maxMessagesPerMinute: 30,
  maxTurnsPerSession: 50,
  audioOutput: false,
  audioVoices: {},
  privacyPolicyUrl: 'https://www.echatbot.ai/aviso-legal',
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

// ── Local LLM mode (Ollama) ─────────────────────────────────────────────────
// Enable with:  npm run demo --local   (npm sets npm_config_local=true)
//          or:  npm run demo -- --local   /   node --import tsx agent.ts --local
// In local mode we point at Ollama's OpenAI-compatible endpoint and use a local
// model. Ollama ignores the bearer token, but the code paths below require a
// non-empty key, so we set a placeholder.
const LOCAL_MODE =
  process.argv.includes('--local') || process.env.npm_config_local === 'true'

if (LOCAL_MODE) {
  process.env.LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://localhost:11434/v1'
  process.env.LLM_MODEL = process.env.LLM_MODEL || 'qwen3:14b'
  process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'ollama'
}

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
const AUDIO_OUTPUT = SETTINGS.audioOutput
const AUDIO_VOICES = SETTINGS.audioVoices
const PRIVACY_POLICY_URL = process.env.PRIVACY_POLICY_URL || SETTINGS.privacyPolicyUrl

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
        'Record facts about the customer so they are not re-asked. Call this WHENEVER the customer provides a new fact (name, sede/centro, or the main service they are interested in). Use merge semantics: only pass the fields that changed. Valid sedi are documented in the prompt (LOCATIONS): Navigli, Isola, Monza. There is NO language field: the conversation language is declared via the ⟦LANG:xx⟧ output trailer, never via this tool.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Customer full name (e.g. "Giulia Rossi")' },
          location: {
            type: 'string',
            description: 'Sede / centro name (canonical: Navigli, Isola, Monza).',
          },
          service: {
            type: 'string',
            description: 'Main treatment the customer is interested in (free text, e.g. "pulizia viso", "semipermanente").',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_cart',
      description:
        'Set the customer\'s cart to the FULL current list of items they want (services + products). REPLACE semantics: pass the complete cart every time it changes — including when the customer removes or swaps an item. Prices and durations MUST come from the LOCATIONS data for the customer\'s active sede; never invent them. The cart is held in memory and is automatically cleared after a successful booking. Call this whenever the customer adds, removes, or changes a service/product.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'The full cart. Empty array clears it.',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['service', 'product'], description: 'service = treatment in cabin; product = retail item.' },
                name: { type: 'string', description: 'Exact item name from the sede catalog.' },
                price: { type: 'number', description: 'Unit price in euros, from the sede catalog.' },
                durationMin: { type: 'integer', description: 'Service duration in minutes (services only).' },
                qty: { type: 'integer', description: 'Quantity (products only, default 1).' },
              },
              required: ['kind', 'name', 'price'],
              additionalProperties: false,
            },
          },
        },
        required: ['items'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description:
        'Book a treatment appointment at the customer\'s active sede. Call this ONLY when: (a) the customer has selected a time slot from the list you offered (1, 2, 3…), AND (b) you already know their name, phone and email (email is captured automatically when they type it). The cart (services + products) is taken from SESSION STATE. The tool creates a Google Calendar event in the sede calendar, sends a confirmation email to the customer, and clears the cart. It returns calendar_link when available — include it only if present. Do NOT call this twice for the same customer.',
      parameters: {
        type: 'object',
        properties: {
          slotIndex: {
            type: 'integer',
            description: 'The 1-based index of the selected time slot (e.g. customer says "2" for the second option offered in RUNTIME).',
          },
        },
        required: ['slotIndex'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_operator',
      description:
        'Send a structured briefing to the human operator by email and hand the conversation over to a person. Call this when the customer explicitly asks for a human, when they want to make a payment or dispute a charge, for a complaint you cannot resolve, or for a franchising/business enquiry (opening a Demobeauty center). The summary must be a self-contained operator briefing following the template in common.md. The host substitutes placeholder PII tokens with real values before sending, and disables the bot for this customer (activeChatbot=false). Call this EXACTLY ONCE per incident.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            enum: [
              'payment_request',
              'payment_dispute',
              'complaint',
              'human_requested',
              'franchising_lead',
              'booking_problem',
              'not_covered',
              'other',
            ],
            description: 'High-level reason code for the escalation.',
          },
          summary: {
            type: 'string',
            description:
              'Operator briefing in the language indicated by RUNTIME.operatorBriefingLanguage. Use the exact template from common.md (header, 🕒 Data, 📍 Sede, 👤 Cliente, 🌐 Lingua, 🚨 Richiesta, 📋 Riepilogo, ✅ Azione suggerita). Include all known facts from SESSION STATE (name, sede, cart, appointment).',
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

// ── Injectable side-effect handlers ──────────────────────────────────────────
// The standalone module knows nothing about Prisma or Google Calendar. In
// production the host (CustomClientChatbotService) injects a real handler that
// creates the calendar event in the SEDE's Google Calendar using the workspace's
// stored connection. In REPL/batch the handler is absent → console + email only.

export interface BookAppointmentParams {
  workspaceId: string
  date: string // 'YYYY-MM-DD'
  time: string // 'HH:MM' 24h, interpreted in the workspace timezone (host-side)
  durationMinutes: number
  topic: string             // e.g. "Pulizia viso + Semipermanente — Giulia Rossi"
  customerName: string
  customerEmail: string
  customerPhone?: string
  location?: string         // sede (Navigli/Isola/Monza) → maps to the sede calendar
  services: CartItem[]      // services booked (for the event description)
  products: CartItem[]      // products to prepare for pickup
}

export interface BookAppointmentResult {
  googleEventLink?: string | null
}

export type BookAppointmentHandler = (
  params: BookAppointmentParams,
) => Promise<BookAppointmentResult>

interface ToolContext {
  sessionId: string
  customerName?: string
  customerPhone?: string
  /** Workspace running this session — needed to resolve the sede calendar
   *  connection. Present in production, absent in REPL/batch. */
  workspaceId?: string
  /** Real booking side-effect, injected by the host. Absent in REPL/batch. */
  bookAppointment?: BookAppointmentHandler
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
    if (typeof args.service === 'string') patch.service = args.service
    // NOTE: `language` is NOT accepted here (would resurrect the T1 empty-reply
    // bug — see iron rule #3). The LLM declares the language via the ⟦LANG:xx⟧
    // reply trailer; commitLanguageFromReply persists it AFTER the turn.
    const state = updateState(ctx.sessionId, patch)
    return { ok: true, state }
  }

  if (name === 'update_cart') {
    // Replace the whole cart with the items the LLM passed. Prices/durations are
    // the LLM's responsibility to copy from the LOCATIONS data; we only normalize
    // shape and recompute the total server-side (never trust an LLM-typed total).
    const rawItems = Array.isArray(args.items) ? args.items : []
    const items: CartItem[] = []
    for (const raw of rawItems) {
      if (!raw || typeof raw !== 'object') continue
      const r = raw as Record<string, unknown>
      const kind = r.kind === 'product' ? 'product' : 'service'
      const itemName = typeof r.name === 'string' ? r.name.trim() : ''
      const price = typeof r.price === 'number' && Number.isFinite(r.price) ? r.price : NaN
      if (!itemName || Number.isNaN(price)) continue
      const item: CartItem = { kind, name: itemName, price }
      if (kind === 'service' && typeof r.durationMin === 'number' && Number.isFinite(r.durationMin)) {
        item.durationMin = r.durationMin
      }
      if (kind === 'product' && typeof r.qty === 'number' && Number.isFinite(r.qty) && r.qty > 1) {
        item.qty = r.qty
      }
      items.push(item)
    }
    setCart(ctx.sessionId, items)
    return { ok: true, cart: items, total: cartTotal(items) }
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

    // Idempotency: the LLM occasionally calls escalate_to_operator twice in the
    // same turn (e.g. it retries after a missing_customer_name failure but also
    // re-emits the original call). Fire the email exactly once per (session,
    // reason). A duplicate returns ok:true with already_escalated so the bot
    // still confirms to the customer, but no second operator email is sent.
    if (!markEscalationOnce(ctx.sessionId, reason)) {
      if (process.env.LLM_DEBUG === '1') {
        console.error(`[escalation_skipped_duplicate] reason=${reason}`)
      }
      return { ok: true, already_escalated: true, eta_minutes: 5 }
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

  if (name === 'book_appointment') {
    const state = getState(ctx.sessionId)
    const slotIndex = typeof args.slotIndex === 'number' ? args.slotIndex : 0

    // Idempotency: one booking per session. A second call must not create a
    // duplicate Calendar event / email.
    if (state.appointmentDate) {
      return {
        ok: false,
        error: 'already_booked',
        instruction: `The customer already has an appointment on ${state.appointmentDate} at ${state.appointmentTime}. To change it, escalate_to_operator with reason="booking_problem".`,
      }
    }

    if (!state.location) {
      return {
        ok: false,
        error: 'missing_sede',
        instruction: 'No sede selected yet. Ask which sede (Navigli, Isola, Monza) and save it with remember({location}) before booking.',
      }
    }
    if (!state.name) {
      return {
        ok: false,
        error: 'missing_customer_name',
        instruction: 'Customer name is required. Ask for it, save with remember({name}), then retry.',
      }
    }
    if (!state.phone) {
      return {
        ok: false,
        error: 'missing_phone',
        instruction: 'Customer phone is required for the booking. Ask for it (captured automatically when typed), then retry.',
      }
    }
    if (!state.email) {
      return {
        ok: false,
        error: 'missing_email',
        instruction: 'Customer email is required to send the confirmation. Ask for their email address (captured automatically when they write it), then retry.',
      }
    }

    const AVAILABLE_SLOTS = getAppointmentSlots(new Date(), state.location)
    if (slotIndex < 1 || slotIndex > AVAILABLE_SLOTS.length) {
      return {
        ok: false,
        error: `Invalid slot index. Valid options are 1-${AVAILABLE_SLOTS.length} (see RUNTIME slots for ${state.location}).`,
      }
    }

    const cart = state.cart ?? []
    const services = cart.filter((i) => i.kind === 'service')
    const products = cart.filter((i) => i.kind === 'product')

    // The calendar event and confirmation email are built FROM the cart. If the
    // LLM tracked the treatments only in conversation but never persisted them
    // via update_cart, state.cart is empty → the booking would be created with
    // no services, wrong duration and 0€ total. Refuse and make the LLM persist
    // the agreed cart first (iron rule: tool refuses, LLM corrects).
    if (services.length === 0) {
      return {
        ok: false,
        error: 'empty_cart',
        instruction: 'No services in the cart yet. Call update_cart with the full list of agreed services (and any products), using the exact names/prices/durations from the active sede LOCATIONS, then retry book_appointment.',
      }
    }

    const selectedSlot = AVAILABLE_SLOTS[slotIndex - 1]
    const appointmentId = `APT-${Date.now().toString(36).toUpperCase()}`
    const durationMinutes = services.reduce((sum, s) => sum + (s.durationMin ?? 0), 0) || 30
    const topic = services.length > 0
      ? `${services.map((s) => s.name).join(' + ')} — ${state.name}`
      : `Appuntamento — ${state.name}`

    // Persist appointment details in state.
    updateState(ctx.sessionId, {
      appointmentDate: selectedSlot.date,
      appointmentTime: selectedSlot.time,
      appointmentType: 'treatment_booking',
    })

    // Real side-effect (Google Calendar event in the sede calendar) runs
    // host-side via the injected handler. Absent in REPL/batch → link stays null.
    let calendarLink: string | null = null
    if (ctx.bookAppointment && ctx.workspaceId) {
      try {
        const booking = await ctx.bookAppointment({
          workspaceId: ctx.workspaceId,
          date: selectedSlot.date,
          time: selectedSlot.time,
          durationMinutes,
          topic,
          customerName: state.name,
          customerEmail: state.email,
          customerPhone: state.phone,
          location: state.location,
          services,
          products,
        })
        calendarLink = booking.googleEventLink ?? null
      } catch (err) {
        console.error(`[book_appointment_handler_failed] ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Operator/sede lead briefing — independent of the customer email.
    try {
      await sendAppointmentOperatorBriefing({
        appointmentId,
        appointmentDate: selectedSlot.date,
        appointmentTime: selectedSlot.time,
        durationMinutes,
        services,
        products,
        state,
        calendarLink,
      })
    } catch (err) {
      console.error(`[appointment_operator_email_failed] ${err instanceof Error ? err.message : String(err)}`)
    }

    let emailSent = !!GMAIL_USER
    try {
      await sendAppointmentEmail({
        appointmentId,
        customerName: state.name,
        customerEmail: state.email,
        customerPhone: state.phone,
        appointmentDate: selectedSlot.date,
        appointmentTime: selectedSlot.time,
        durationMinutes,
        services,
        products,
        state,
        calendarLink,
      })
    } catch (err) {
      emailSent = false
      console.error(`[appointment_email_failed] ${err instanceof Error ? err.message : String(err)}`)
    }

    // Cart fulfilled → clear it (in-memory, no DB). Next conversation starts empty.
    resetCart(ctx.sessionId)

    return {
      ok: true,
      appointment_id: appointmentId,
      date: selectedSlot.date,
      time: selectedSlot.time,
      duration_minutes: durationMinutes,
      total: cartTotal(cart),
      calendar_link: calendarLink,
      email_sent: emailSent,
    }
  }

  return { ok: false, error: `unknown tool: ${name}` }
}

// ── Cart / appointment formatting helpers ────────────────────────────────────

function formatCartLines(items: CartItem[]): string[] {
  return items.map((i) => {
    const qty = i.kind === 'product' && (i.qty ?? 1) > 1 ? ` x${i.qty}` : ''
    const dur = i.durationMin ? ` (${i.durationMin}min)` : ''
    const line = i.price * (i.qty ?? 1)
    return `- ${i.name}${qty}${dur}: ${line}€`
  })
}

// Compute the appointment end time "HH:MM" from a start time + total duration.
function computeEndTime(startTime: string, durationMin: number): string {
  const m = startTime.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return startTime
  const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + durationMin
  const hh = String(Math.floor((total % (24 * 60)) / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

// ── Email — appointment confirmation (to the customer) ───────────────────────

interface AppointmentEmailParams {
  appointmentId: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  appointmentDate: string
  appointmentTime: string
  durationMinutes: number
  services: CartItem[]
  products: CartItem[]
  state: SessionState
  /** Real Google Calendar event link, when the booking handler produced one. */
  calendarLink?: string | null
}

async function sendAppointmentEmail(params: AppointmentEmailParams): Promise<void> {
  const { appointmentId, customerName, customerEmail, customerPhone, appointmentDate, appointmentTime, durationMinutes, services, products, state, calendarLink } = params
  const endTime = computeEndTime(appointmentTime, durationMinutes)
  const total = cartTotal([...services, ...products])

  console.error('\n══════ APPOINTMENT CONFIRMATION ══════')
  console.error(`Appointment ID: ${appointmentId}`)
  console.error(`To: ${customerEmail}`)
  console.error(`Customer: ${customerName}`)
  console.error(`Phone: ${customerPhone ?? '(not provided)'}`)
  console.error(`Sede: ${state.location ?? '(not specified)'}`)
  console.error(`Date: ${appointmentDate} ${appointmentTime}–${endTime}`)
  console.error(`Services: ${services.map((s) => s.name).join(', ') || '(none)'}`)
  console.error(`Products: ${products.map((p) => p.name).join(', ') || '(none)'}`)
  console.error(`Total: ${total}€`)
  console.error(`Calendar: ${calendarLink ?? '(not created)'}`)
  console.error('════════════════════════════════════════\n')

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD missing in .env (appointment logged to console only)')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })

  const subject = `[Demobeauty] Prenotazione confermata — ${appointmentId}`
  const textBody = [
    `Ciao ${customerName}, ✨`,
    '',
    'La tua prenotazione è confermata!',
    '',
    `📍 Sede: ${state.location ?? '(da definire)'}`,
    `📅 Data: ${appointmentDate}`,
    `🕐 Orario: ${appointmentTime}–${endTime}`,
    '',
    ...(services.length > 0 ? ['— Trattamenti —', ...formatCartLines(services), ''] : []),
    ...(products.length > 0 ? ['— Prodotti da ritirare —', ...formatCartLines(products), ''] : []),
    `💶 Totale: ${total}€`,
    ...(calendarLink ? ['', `📆 Calendario: ${calendarLink}`] : []),
    '',
    'Ti chiediamo la cortesia di avvisarci con almeno 24 ore di anticipo in caso di imprevisti.',
    '',
    'A presto! 🌸',
    '',
    '— Demobeauty',
  ].join('\n')

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: customerEmail,
    subject,
    text: textBody,
  })
}

// ── Email appointment — sede/operator lead briefing ──────────────────────────
// Sent to OPERATOR_EMAIL whenever a booking is made, so the sede sees the full
// appointment (contacts + services + products to prepare) without reading the chat.

interface AppointmentBriefingParams {
  appointmentId: string
  appointmentDate: string
  appointmentTime: string
  durationMinutes: number
  services: CartItem[]
  products: CartItem[]
  state: SessionState
  calendarLink?: string | null
}

async function sendAppointmentOperatorBriefing(params: AppointmentBriefingParams): Promise<void> {
  const { appointmentId, appointmentDate, appointmentTime, durationMinutes, services, products, state, calendarLink } = params
  const endTime = computeEndTime(appointmentTime, durationMinutes)
  const total = cartTotal([...services, ...products])

  console.error('\n══════ APPOINTMENT (sede) ══════')
  console.error(`Appointment ID: ${appointmentId}`)
  console.error(`To: ${OPERATOR_EMAIL || '(no operatorEmail configured)'}`)
  console.error(`Customer: ${state.name ?? '?'}`)
  console.error(`Phone: ${state.phone ?? '?'}`)
  console.error(`Sede: ${state.location ?? '?'}`)
  console.error(`Slot: ${appointmentDate} ${appointmentTime}–${endTime}`)
  console.error('═════════════════════════════════\n')

  if (!OPERATOR_EMAIL) {
    throw new Error('OPERATOR_EMAIL not configured (settings.json or env)')
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD missing in .env (lead briefing logged to console only)')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })

  const subject = `[Demobeauty] Nuova prenotazione — ${state.location ?? 'sede ?'} — ${appointmentId}`
  const textBody = [
    'Nuova prenotazione dal chatbot.',
    '',
    `🆔 Appuntamento: ${appointmentId}`,
    `📍 Sede: ${state.location ?? '(non specificata)'}`,
    `🗓️ Data/ora: ${appointmentDate} ${appointmentTime}–${endTime}`,
    '',
    '— Cliente —',
    `👤 Nome: ${state.name ?? '(non fornito)'}`,
    `📧 Email: ${state.email ?? '(non fornita)'}`,
    `📞 Telefono: ${state.phone ?? '(non fornito)'}`,
    `🌐 Lingua: ${state.language ?? '(sconosciuta)'}`,
    '',
    ...(services.length > 0 ? ['— Trattamenti —', ...formatCartLines(services), ''] : []),
    ...(products.length > 0 ? ['— Prodotti da preparare —', ...formatCartLines(products), ''] : []),
    `💶 Totale: ${total}€`,
    ...(calendarLink ? [`📆 Calendar: ${calendarLink}`] : []),
    '',
    '— Demobeauty Bot',
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
  console.error(`Sede: ${state.location ?? '?'}`)
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
    `Motivo: ${reason}`,
    '',
    summary,
    '',
    '— Demobeauty Bot',
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
  operatorBriefingLanguageOverride?: string | null,
  isFirstTurn = false,
): Promise<LlmResponse> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY missing in environment')

  const stateBlock = formatStateForPrompt(state)
  const runtimeBlock = formatRuntimeBlock(operatorBriefingLanguageOverride, isFirstTurn, state.location)

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

  // Ollama's OpenAI-compatible endpoint doesn't support typed content blocks or
  // `cache_control` (an Anthropic/OpenRouter prompt-caching feature). In local
  // mode, flatten the system message to a plain string so the request is valid.
  // We also append Qwen's `/no_think` soft-switch to disable the model's hidden
  // reasoning trace (much faster for a customer-service bot). Re-enable with
  // LLM_THINK=1. Harmless on non-Qwen models (treated as plain text).
  const disableThinking = LOCAL_MODE && process.env.LLM_THINK !== '1'
  const systemMessageContent: unknown = LOCAL_MODE
    ? systemContent.map((b) => (b as { text?: string }).text ?? '').join('\n\n') +
      (disableThinking ? '\n\n/no_think' : '')
    : systemContent

  const payload = {
    model: MODEL,
    messages: [{ role: 'system', content: systemMessageContent }, ...history],
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
      'X-Title': 'Demobeauty',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    const provider = LOCAL_MODE ? 'Ollama' : 'OpenRouter'
    throw new Error(`${provider} HTTP ${res.status}: ${body.slice(0, 500)}`)
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
  // When the LLM calls `escalate_to_operator`, this holds the briefing
  // it produced (already post-substituted with real PII values from
  // SessionState). Surfaced upward so the host can ship it to the
  // operator email — replaces the meaningless "Ticket created for
  // <uuid>" placeholder we used before.
  operatorBriefing?: string | null
}

async function agentTurnInternal(
  ctx: ToolContext,
  cachedSystemPrompt: string,
  history: Message[],
  sanitizedMessage: string,
  operatorBriefingLanguageOverride?: string | null,
): Promise<TurnResult> {
  // FIRST-TURN detection for the welcome message. The prompt (common.md) opens
  // every conversation with the localized greeting "when history.length == 0".
  // We read it HERE, before pushing the incoming message, because the host
  // rebuilds `history` from its DB each call — so the prior conversation length
  // is the single reliable signal (the in-RAM turn counter is lost on process
  // restart / cache eviction, which is exactly why the welcome was skipped).
  const isFirstTurn = history.length === 0

  history.push({ role: 'user', content: sanitizedMessage })

  let nudgedAfterEmpty = false
  let tokensUsed = 0
  let escalated = false
  // Captured when escalate_to_operator runs successfully. Appended after the
  // HUMAN_SUPPORT marker so the playground / backoffice can render the
  // briefing in an internal orange balloon (host strips it before sending to
  // the customer — see src/utils/custom-chatbot-reply.ts).
  let operatorBriefing: string | null = null

  for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
    const state = getState(ctx.sessionId)
    const response = await callLLM(
      cachedSystemPrompt,
      state,
      history,
      operatorBriefingLanguageOverride,
      isFirstTurn,
    )
    tokensUsed +=
      (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0)

    // No tool calls → final text reply.
    if (!response.tool_calls || response.tool_calls.length === 0) {
      // The LLM appends a ⟦LANG:xx⟧ control trailer (see state.ts). Split it
      // off: `text` is the clean customer-facing reply (marker removed), `lang`
      // is the language the model says it replied in. A trailer-only completion
      // yields an empty `text` → handled by the empty-reply recovery below.
      const { reply: text, lang } = extractLanguage(response.content || '')

      // Empty-reply recovery (see architecture.md §7).
      if (!text && !nudgedAfterEmpty && hop < MAX_TOOL_HOPS - 1) {
        nudgedAfterEmpty = true
        history.push({ role: 'assistant', content: '' })
        history.push({
          role: 'user',
          content:
            '[system] Your previous reply was empty. Please respond to the customer now, in their language, following the rules in the system prompt. Remember to append the ⟦LANG:xx⟧ marker on its own line after a real reply. Do not call any more tools unless strictly necessary.',
        })
        if (process.env.LLM_DEBUG === '1') {
          console.error('[empty_reply_nudge] retrying with explicit instruction')
        }
        continue
      }

      // Commit the LLM-declared language (no-op if missing/invalid → sticky).
      commitLanguageFromReply(ctx.sessionId, lang)
      if (process.env.LLM_DEBUG === '1') {
        console.error(`[lang] declared=${lang ?? '(none → sticky)'}`)
      }

      // Persist the CLEAN reply (no trailer) to history so the marker never
      // leaks into future context windows.
      history.push({ role: 'assistant', content: text })
      if (process.env.LLM_DEBUG === '1') {
        console.error(`[state] ${formatStateOneLine(getState(ctx.sessionId))}`)
      }
      // Internal operator balloon: the escalation briefing (if any). Stripped
      // before the customer delivery by splitCustomChatbotReply (HUMAN_SUPPORT
      // marker).
      const finalReply = operatorBriefing
        ? `${text}\n\n**👤 Human Support message**\n${operatorBriefing}`
        : text
      return { reply: finalReply, tokensUsed, escalated, operatorBriefing }
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
        // Capture the substituted briefing for the internal-operator balloon.
        // The LLM produced the summary against redacted PII placeholders;
        // substitute against current SessionState before exposing it.
        const rawSummary = typeof args.summary === 'string' ? args.summary : ''
        if (rawSummary) {
          operatorBriefing = substitutePlaceholders(rawSummary, getState(ctx.sessionId))
        }
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
  operatorBriefingLanguageOverride?: string | null,
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

  // Language is no longer detected here. The LLM judges the customer's
  // language itself and appends a ⟦LANG:xx⟧ trailer to its reply, which is
  // extracted + committed AFTER the turn (see agentTurnInternal). The host
  // already seeded an initial language hint once (mirror:false) at invoke().

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
    agentTurnInternal(
      ctx,
      cachedSystemPrompt,
      history,
      cleanText,
      operatorBriefingLanguageOverride,
    ),
  )
}

// ── System prompt ─────────────────────────────────────────────────────────────
// Assembled at boot from prompts/common.md + prompts/franchising.md +
// prompts/faqs.md + prompts/locations/*.md. Concatenated in a fixed,
// deterministic order so the resulting blob is byte-identical across boots →
// cache hit always.

async function buildSystemPrompt(): Promise<string> {
  const common = await readFile(path.join(PROMPTS_DIR, 'common.md'), 'utf8')
  const franchising = await readFileOrEmpty(path.join(PROMPTS_DIR, 'franchising.md'))
  const faqs = await readFileOrEmpty(path.join(PROMPTS_DIR, 'faqs.md'))
  const locations = await loadDir(path.join(PROMPTS_DIR, 'locations'))

  const parts: string[] = [common]

  if (franchising) {
    parts.push('', '════════ FRANCHISING ════════', '', franchising)
  }

  if (faqs) {
    parts.push('', '════════ FAQS ════════', '', faqs)
  }

  if (locations.length > 0) {
    parts.push('', '════════ LOCATIONS ════════', '')
    for (const { name, content } of locations) {
      parts.push(`## ${name}`, '', content, '')
    }
  }

  return parts.join('\n')
}

// Demo availability per sede. Returns slots strictly in the future relative to
// `now`. Some slots are intentionally OMITTED per sede to simulate "occupato"
// (a booked slot the bot must never offer). In production, the host injects a
// real availability handler that queries the sede's Google Calendar; here we
// fake it deterministically so the demo shows the "slot non disponibile" flow.
interface AppointmentSlot {
  date: string // YYYY-MM-DD
  time: string // HH:MM
  dayName: string
}

function getAppointmentSlots(now: Date, location?: string): AppointmentSlot[] {
  const nextWeekday = (target: number): Date => {
    const d = new Date(now)
    let delta = (target - d.getDay() + 7) % 7
    if (delta === 0) delta = 7
    d.setDate(d.getDate() + delta)
    return d
  }
  const iso = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const friday = nextWeekday(5)
  const saturday = nextWeekday(6)
  const fri = iso(friday)
  const sat = iso(saturday)

  // Per-sede demo availability. Navigli (3 estetiste) has more parallel slots;
  // Isola/Monza (2 estetiste) fewer. The 16:00 Friday slot is deliberately
  // missing everywhere → demonstrates the "occupato" answer.
  const byLocation: Record<string, AppointmentSlot[]> = {
    Navigli: [
      { date: fri, time: '14:30', dayName: 'Venerdì' },
      { date: fri, time: '17:30', dayName: 'Venerdì' },
      { date: sat, time: '10:00', dayName: 'Sabato' },
      { date: sat, time: '11:30', dayName: 'Sabato' },
    ],
    Isola: [
      { date: fri, time: '15:00', dayName: 'Venerdì' },
      { date: sat, time: '09:30', dayName: 'Sabato' },
    ],
    Monza: [
      { date: fri, time: '14:00', dayName: 'Venerdì' },
      { date: sat, time: '10:30', dayName: 'Sabato' },
    ],
  }
  return byLocation[location ?? ''] ?? byLocation.Navigli
}

function formatRuntimeBlock(
  operatorBriefingLanguageOverride?: string | null,
  isFirstTurn = false,
  location?: string,
): string {
  const now = new Date()
  const date = now.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const time = now.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const briefingLanguage =
    (operatorBriefingLanguageOverride && operatorBriefingLanguageOverride.trim()) ||
    OPERATOR_BRIEFING_LANGUAGE
  const lines = [
    '',
    '═══ RUNTIME ═══',
    `Current date: ${date}`,
    `Current time: ${time}`,
    // The prompt (common.md) opens the conversation with the welcome greeting
    // when Turn == 1. Emit it explicitly so the model never has to infer it
    // from history (which the host rebuilds per call).
    `Turn: ${isFirstTurn ? 1 : 2}`,
    `Privacy policy URL: ${PRIVACY_POLICY_URL}`,
    `Operator briefing language: ${briefingLanguage}`,
  ]
  // Available booking slots are sede-specific. Only inject them once a sede is
  // selected — these are the ONLY slots the bot may offer (everything else is
  // occupato). Pass slotIndex to book_appointment.
  if (location) {
    const slots = getAppointmentSlots(now, location)
    lines.push(
      `Available booking slots at ${location} (offer EXACTLY these by index; anything not listed is occupato/unavailable):`,
      ...slots.map((s, i) => `  ${i + 1}. ${s.dayName} ${s.date} ${s.time}`),
    )
  } else {
    lines.push('No sede selected yet — ask which sede before offering booking slots.')
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
    /** Open ISO 2-letter language code. The bot replies in ANY language Claude supports;
     *  the deterministic detector covers a handful of common ones, the rest flow through the prompt. */
    language?: string
    /** Per-turn override for the operator briefing language only (not the
     *  customer-facing reply). Used by the playground so the flag selected
     *  in the Use Cases panel flips the language of the "Human Support
     *  message" without dragging the bot's reply into the same language. */
    operatorBriefingLanguageOverride?: string | null
    /** Real side-effect handlers injected by the host. Absent in REPL/batch. */
    handlers?: {
      bookAppointment?: BookAppointmentHandler
    }
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
  /** ISO 2-letter code of the language the bot actually replied in (declared by
   *  the LLM via the ⟦LANG:xx⟧ trailer and committed to session state). The host
   *  uses this so the deterministic welcome-video intro line matches the reply
   *  language exactly. Undefined only when no turn ran (early returns). */
  language?: string
  shouldEscalate: boolean
  escalationSummary?: string
  notificationEmails?: string
  /** When true, the host should close this chat session and stop forwarding
   *  new customer messages to the bot. Set after the bot completes an
   *  escalation flow (the operator now owns the conversation). */
  closeChat: boolean
  patches?: CustomerPatch[]
  /** Tenant audio policy from settings.json. When false the host must always
   *  reply with text; when true it may mirror the input modality (audio→audio). */
  audioOutput: boolean
  /** Per-language ElevenLabs voice IDs from settings.json (key = lang code,
   *  plus "default"). The host picks by customer language for the TTS voice. */
  audioVoices: Record<string, string>
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
        audioOutput: AUDIO_OUTPUT,
        audioVoices: AUDIO_VOICES,
        meta: { tokensUsed: 0, agentChain: ['custom-demobeauty'] },
        error: 'llm_unavailable',
      }
    }

    const systemPrompt = await getCachedSystemPrompt()
    const sessionId = input.context.sessionId

    // 🌐 LANGUAGE = decided by the CUSTOMER'S MESSAGE, never by the phone
    // prefix. We deliberately DO NOT seed the session language from
    // input.config.language (a phone-prefix guess): seeding it makes the prompt
    // treat the language as "already established" and the bot would keep that
    // guessed language instead of detecting from what the customer actually
    // wrote (e.g. a +33 French number writing in Spanish must get a Spanish
    // reply, not English/French). With no seed, on the first turn the LLM
    // detects the language from the message (even a single word) and falls back
    // to Spanish only when the message is genuinely undecidable — see the
    // ## LANGUAGE block in formatStateForPrompt. From there the ⟦LANG:xx⟧ reply
    // trailer keeps it sticky.

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
      workspaceId: input.config.workspaceId,
      bookAppointment: input.config.handlers?.bookAppointment,
    }

    const result = await agentTurn(
      ctx,
      systemPrompt,
      history,
      input.userMessage,
      input.config.operatorBriefingLanguageOverride ?? null,
    )
    const patches = drainPatches(sessionId)

    return {
      reply: result.reply || null,
      // Language the bot replied in — declared by the LLM via ⟦LANG:xx⟧ and
      // committed to state by commitLanguageFromReply. The host uses this for
      // the welcome-video intro so it matches the reply, instead of a phone/DB
      // guess (which can disagree on first contact).
      language: getState(sessionId).language,
      shouldEscalate: result.escalated,
      // Ship the real operator briefing produced by the LLM (post-PII
      // substitution) so the email shows the structured incident summary
      // — customer name, location, machine, problem, ID — instead of an
      // opaque ticket UUID. Falls back to a session reference only when
      // the briefing is missing (defensive — should never happen if
      // escalate_to_operator ran successfully).
      escalationSummary: result.escalated
        ? result.operatorBriefing || `Session ${sessionId} escalated (no briefing captured)`
        : undefined,
      notificationEmails: result.escalated ? OPERATOR_EMAIL || undefined : undefined,
      closeChat: result.escalated,
      patches: patches.length > 0 ? patches : undefined,
      audioOutput: AUDIO_OUTPUT,
      audioVoices: AUDIO_VOICES,
      meta: {
        tokensUsed: result.tokensUsed,
        agentChain: ['custom-demobeauty'],
      },
    }
  } catch (err) {
    console.error(`[chatbotFn] error: ${err instanceof Error ? err.message : String(err)}`)
    return {
      reply: null,
      shouldEscalate: false,
      closeChat: false,
      audioOutput: AUDIO_OUTPUT,
      audioVoices: AUDIO_VOICES,
      meta: { tokensUsed: 0, agentChain: ['custom-demobeauty'] },
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function runInteractive(systemPrompt: string): Promise<void> {
  const sessionId = 'cli-interactive'
  const history: Message[] = []
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  console.log('Demobeauty chatbot — assembled prompt + state + tools + escalation.')
  console.log('Commands: /exit /quit /reset /state')
  console.log(`model=${MODEL} prompts=${PROMPTS_DIR}${LOCAL_MODE ? ` [LOCAL: ${BASE_URL}]` : ''}`)
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
