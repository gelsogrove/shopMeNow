// DemoCasa chatbot — real-estate agency assistant. Prompt-driven LLM with a
// cached system prompt, session state, appointment booking (property viewings
// and franchising consultations), valuation requests, and escalation by email.
//
// Twin architecture of custom-demowash (see that module's architecture.md /
// CLAUDE.md for the 13 iron rules — they apply here verbatim).
//
// Two entry points:
//   - REPL/batch CLI (`npm run demo`) — local interactive testing
//   - `chatbotFn(input): ChatbotOutput` — contract expected by the host
//     Express backend when this module is loaded as `workspace.customChatbotId`
//
// The same core (assemble system prompt, call LLM, dispatch tools, persist
// state, drain patches) backs both entry points.

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
  resetState,
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
}

const DEFAULT_SETTINGS: Settings = {
  model: 'anthropic/claude-haiku-4.5',
  temperature: 0.3,
  maxTokens: 800,
  maxToolHops: 4,
  operatorBriefingLanguage: 'es',
  operatorEmail: '',
  emailFrom: 'DemoCasa Bot <noreply@democasa.demo>',
  emailSubjectPrefix: '[DemoCasa] Incidencia',
  maxMessageChars: 2000,
  maxMessagesPerMinute: 30,
  maxTurnsPerSession: 50,
  audioOutput: false,
  audioVoices: {},
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
const BIDI_RE = /[‪-‮⁦-⁩]/g

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
        'Record facts about the customer so they are not re-asked. Call this WHENEVER the customer provides a new fact (name, city/office, operation buy/rent, property type, listing reference, bedrooms, budget, preferred zone). Use merge semantics: only pass the fields that changed. Valid offices/cities are documented in the prompt (LOCATIONS). There is NO language field: the conversation language is declared via the ⟦LANG:xx⟧ output trailer, never via this tool.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Customer full name (e.g. "Marco Rossi")' },
          location: {
            type: 'string',
            description: 'City / office the customer is interested in (canonical: Mataró, Eixample, Gràcia, Sant Cugat, Rubí, Terrassa).',
          },
          operation: {
            type: 'string',
            enum: ['buy', 'rent'],
            description: 'The goal of a customer LOOKING FOR a home: buy = wants to purchase, rent = wants to rent. Do NOT set this for a SELLER who wants a valuation of their OWN property — "sell"/"rent out my flat" is the valuation flow, NOT this field. Leave it unset if unsure.',
          },
          propertyType: {
            type: 'string',
            description: 'Kind of property the customer wants (apartment, house, studio, penthouse, commercial, …). Free-form, store the customer\'s wording in English when clear.',
          },
          propertyRef: {
            type: 'string',
            description: 'Listing reference the customer is interested in, exactly as written in LOCATIONS (e.g. "EIX-101"). Uppercase as shown.',
          },
          bedrooms: { type: 'integer', description: 'Desired number of bedrooms (e.g. 3)' },
          budget: { type: 'string', description: 'Customer budget, free-form (e.g. "hasta 300.000 €", "1.200 €/mes").' },
          zone: { type: 'string', description: 'Preferred neighbourhood / area inside the city, free-form.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_valuation',
      description:
        'Submit a structured free-valuation request to the office by email, for a customer who wants to SELL or RENT OUT their own property. Call this ONLY when you have collected ALL 5 fields (address, propertyType, size, email, note — note can be empty). The tool validates email format (RFC 5322). If validation fails, the tool returns ok:false with a specific error — re-ask only the invalid field. After 3 failed attempts on the same field, escalate via escalate_to_operator with reason="valuation_request".',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Address / location of the property to value (street, area, city).' },
          propertyType: { type: 'string', description: 'Type of property to value (apartment, house, studio, commercial, …).' },
          size: { type: 'string', description: 'Approximate size in m² (e.g. "85 m²", "85"). Free-form.' },
          email: { type: 'string', description: 'Customer email for the valuation report.' },
          note: { type: 'string', description: 'Optional note (bedrooms, condition, asking expectations, reference). Pass empty string if customer said "no".' },
        },
        required: ['address', 'propertyType', 'size', 'email', 'note'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_appointment',
      description:
        'Book an appointment. Two purposes: "viewing" = an in-person visit to a property the customer is interested in; "franchising" = a video consultation about opening a DemoCasa agency. Call this ONLY when the customer has selected a time slot from the list you offered (by selecting 1, 2, 3, etc.). The tool creates a real Calendar event (and, for franchising, a Zoom meeting) and sends a confirmation email. It returns calendar_link and zoom_link when available — when present, include those exact links in your confirmation message. If they are null, simply confirm by date/time without inventing links. Do NOT call this twice for the same customer.',
      parameters: {
        type: 'object',
        properties: {
          slotIndex: {
            type: 'integer',
            description: 'The index of the selected time slot (1-based, e.g. customer says "2" for the second option).',
          },
          purpose: {
            type: 'string',
            enum: ['viewing', 'franchising'],
            description: 'viewing = property visit (in person). franchising = consultation about opening an agency (video call).',
          },
        },
        required: ['slotIndex', 'purpose'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_operator',
      description:
        'Send a structured briefing to a human agent by email. Call this when the customer explicitly asks for a human, when a request needs a person (a specific negotiation, an offer, paperwork, mortgage advice we cannot answer from the prompt), or when the question is not covered by the documented data. The summary should be a self-contained agent briefing following the template in common.md. The host will substitute placeholder PII tokens with real values from SessionState before sending. Call this EXACTLY ONCE per incident — never emit two escalate_to_operator calls in the same turn.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            enum: [
              'viewing_request',
              'property_question',
              'offer_negotiation',
              'mortgage_question',
              'paperwork',
              'valuation_request',
              'rental_application',
              'complaint',
              'angry_customer',
              'not_covered',
              'other',
            ],
            description: 'High-level reason code for the escalation.',
          },
          summary: {
            type: 'string',
            description:
              'Agent briefing in the language indicated by RUNTIME.operatorBriefingLanguage. Use the exact template from common.md (header, 🕒 Fecha, 📍 Oficina, 🏠 Inmueble, 👤 Cliente, 🌐 Idioma, 🚨 Petición, 📋 Resumen, ✅ Acción sugerida). Include all known facts from SESSION STATE.',
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
// The standalone module knows nothing about Prisma, Google Calendar or Zoom.
// In production the host (CustomClientChatbotService) injects a real handler
// that creates the calendar event + Zoom meeting using the workspace's stored
// connections. In REPL/batch the handler is absent → console + email only.

export interface ScheduleAppointmentParams {
  workspaceId: string
  date: string // 'YYYY-MM-DD'
  time: string // 'HH:MM' 24h, interpreted in the workspace timezone (host-side)
  durationMinutes: number
  /** 'viewing' (in-person property visit) | 'franchising' (video consultation). */
  purpose: 'viewing' | 'franchising'
  topic: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  location?: string
  propertyRef?: string
}

export interface ScheduleAppointmentResult {
  googleEventLink?: string | null
  zoomLink?: string | null
}

export type ScheduleAppointmentHandler = (
  params: ScheduleAppointmentParams,
) => Promise<ScheduleAppointmentResult>

interface ToolContext {
  sessionId: string
  customerName?: string
  customerPhone?: string
  /** Workspace running this session — needed to resolve the calendar/Zoom
   *  connection. Present in production, absent in REPL/batch. */
  workspaceId?: string
  /** Real booking side-effect, injected by the host. Absent in REPL/batch. */
  scheduleAppointment?: ScheduleAppointmentHandler
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
    if (typeof args.operation === 'string') {
      if (/\bbuy\b/i.test(args.operation)) patch.operation = 'buy'
      else if (/\brent\b/i.test(args.operation)) patch.operation = 'rent'
    }
    if (typeof args.propertyType === 'string') patch.propertyType = args.propertyType
    if (typeof args.propertyRef === 'string') patch.propertyRef = args.propertyRef
    if (typeof args.bedrooms === 'number' && Number.isFinite(args.bedrooms)) patch.bedrooms = args.bedrooms
    if (typeof args.budget === 'string') patch.budget = args.budget
    if (typeof args.zone === 'string') patch.zone = args.zone
    // NOTE: `language` is NOT accepted here. The LLM declares the language via
    // the ⟦LANG:xx⟧ reply trailer; commitLanguageFromReply persists it AFTER
    // the turn.
    const state = updateState(ctx.sessionId, patch)
    return { ok: true, state }
  }

  if (name === 'request_valuation') {
    const state = getState(ctx.sessionId)
    const address = substitutePlaceholders(
      typeof args.address === 'string' ? args.address.trim() : '',
      state,
    )
    const propertyType = typeof args.propertyType === 'string' ? args.propertyType.trim() : ''
    const size = typeof args.size === 'string' ? args.size.trim() : ''
    const email = substitutePlaceholders(
      typeof args.email === 'string' ? args.email.trim() : '',
      state,
    )
    const note = substitutePlaceholders(
      typeof args.note === 'string' ? args.note.trim() : '',
      state,
    )

    // Persist the property address / note into state so the host can mirror
    // address into Customers via patches.
    const profilePatch: Partial<SessionState> = {}
    if (address) profilePatch.address = address
    if (note) profilePatch.notes = note
    if (Object.keys(profilePatch).length > 0) {
      updateState(ctx.sessionId, profilePatch)
    }

    if (!address) return { ok: false, error: 'address is required' }
    if (!propertyType) return { ok: false, error: 'propertyType is required' }
    if (!size) return { ok: false, error: 'size is required' }
    if (!email) return { ok: false, error: 'email is required' }

    if (!isValidEmail(email)) {
      return { ok: false, error: `email "${email}" is not valid. Re-ask the customer for a valid email.` }
    }

    const valuationId = `VAL-${Date.now().toString(36).toUpperCase()}`

    try {
      await sendValuationEmail({
        valuationId,
        address,
        propertyType,
        size,
        email,
        note,
        state,
        customerName: ctx.customerName,
        customerPhone: ctx.customerPhone,
      })
      return { ok: true, valuation_id: valuationId, email_sent: !!GMAIL_USER }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[valuation_email_failed] ${msg}`)
      return { ok: true, valuation_id: valuationId, email_sent: false, email_error: msg }
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

    // Idempotency: fire the email exactly once per (session, reason).
    if (!markEscalationOnce(ctx.sessionId, reason)) {
      if (process.env.LLM_DEBUG === '1') {
        console.error(`[escalation_skipped_duplicate] reason=${reason}`)
      }
      return { ok: true, already_escalated: true, eta_minutes: 5 }
    }

    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`

    // Substitute placeholders ([CUSTOMER_NAME], [PHONE], ...) with real values
    // from SessionState before sending to the agent.
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
      return { ok: true, ticket_id: ticketId, eta_minutes: 5, email_sent: false, email_error: msg }
    }
  }

  if (name === 'schedule_appointment') {
    const state = getState(ctx.sessionId)
    const slotIndex = typeof args.slotIndex === 'number' ? args.slotIndex : 0
    const purpose: 'viewing' | 'franchising' = args.purpose === 'franchising' ? 'franchising' : 'viewing'

    // Idempotency: one appointment per session.
    if (state.appointmentDate) {
      return {
        ok: false,
        error: 'already_booked',
        instruction: `The customer already has an appointment on ${state.appointmentDate} at ${state.appointmentTime}. Tell them to contact the office if they need to reschedule.`,
      }
    }

    if (!state.name) {
      return {
        ok: false,
        error: 'Customer name is required before scheduling. Ensure remember({name: "..."}) was called.',
      }
    }
    if (!state.email) {
      return {
        ok: false,
        error: 'Customer email is required before scheduling. Ask the customer for their email address first (the system captures it automatically when they write it), then retry.',
      }
    }

    const AVAILABLE_SLOTS = getAppointmentSlots(new Date())

    if (slotIndex < 1 || slotIndex > AVAILABLE_SLOTS.length) {
      return {
        ok: false,
        error: `Invalid slot index. Valid options are 1-${AVAILABLE_SLOTS.length}.`,
      }
    }

    const selectedSlot = AVAILABLE_SLOTS[slotIndex - 1]
    const appointmentId = `APT-${Date.now().toString(36).toUpperCase()}`

    const appointmentPatch: Partial<SessionState> = {
      appointmentDate: selectedSlot.date,
      appointmentTime: selectedSlot.time,
      appointmentType: purpose === 'franchising' ? 'franchising_consultation' : 'viewing',
    }
    updateState(ctx.sessionId, appointmentPatch)

    // Real side-effects (Calendar event + Zoom meeting) run host-side through
    // the injected handler. Absent in REPL/batch → links stay null and we fall
    // back to a console + email confirmation without invented links.
    let calendarLink: string | null = null
    let zoomLink: string | null = null
    if (ctx.scheduleAppointment && ctx.workspaceId) {
      try {
        const topic = purpose === 'franchising'
          ? `DemoCasa franchising consultation — ${state.name}`
          : `DemoCasa property viewing${state.propertyRef ? ` ${state.propertyRef}` : ''} — ${state.name}`
        const booking = await ctx.scheduleAppointment({
          workspaceId: ctx.workspaceId,
          date: selectedSlot.date,
          time: selectedSlot.time,
          durationMinutes: 30,
          purpose,
          topic,
          customerName: state.name,
          customerEmail: state.email,
          customerPhone: state.phone,
          location: state.location,
          propertyRef: state.propertyRef,
        })
        calendarLink = booking.googleEventLink ?? null
        zoomLink = booking.zoomLink ?? null
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[schedule_appointment_handler_failed] ${msg}`)
      }
    }

    // Notify the office/agent with a lead briefing. Independent of the customer
    // email — a failure here must not block the booking confirmation.
    try {
      await sendAppointmentOperatorBriefing({
        appointmentId,
        purpose,
        appointmentDate: selectedSlot.date,
        appointmentTime: selectedSlot.time,
        state,
        calendarLink,
        zoomLink,
      })
    } catch (err) {
      console.error(`[appointment_operator_email_failed] ${err instanceof Error ? err.message : String(err)}`)
    }

    try {
      await sendAppointmentEmail({
        appointmentId,
        purpose,
        customerName: state.name,
        customerEmail: state.email,
        customerPhone: state.phone,
        appointmentDate: selectedSlot.date,
        appointmentTime: selectedSlot.time,
        state,
        calendarLink,
        zoomLink,
      })
      return {
        ok: true,
        appointment_id: appointmentId,
        purpose,
        date: selectedSlot.date,
        time: selectedSlot.time,
        calendar_link: calendarLink,
        zoom_link: zoomLink,
        email_sent: !!GMAIL_USER,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[appointment_email_failed] ${msg}`)
      return {
        ok: true,
        appointment_id: appointmentId,
        purpose,
        date: selectedSlot.date,
        time: selectedSlot.time,
        calendar_link: calendarLink,
        zoom_link: zoomLink,
        email_sent: false,
        email_error: msg,
      }
    }
  }

  return { ok: false, error: `unknown tool: ${name}` }
}

// ── Validators ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false
  return EMAIL_RE.test(email)
}

// ── Email — valuation request ────────────────────────────────────────────────

interface ValuationParams {
  valuationId: string
  address: string
  propertyType: string
  size: string
  email: string
  note: string
  state: SessionState
  customerName?: string
  customerPhone?: string
}

async function sendValuationEmail(params: ValuationParams): Promise<void> {
  const { valuationId, address, propertyType, size, email, note, state, customerName, customerPhone } = params

  console.error('\n══════ VALUATION REQUEST ══════')
  console.error(`Valuation ID: ${valuationId}`)
  console.error(`To: ${OPERATOR_EMAIL || '(no operatorEmail configured)'}`)
  console.error(`Property address: ${address}`)
  console.error(`Property type: ${propertyType}`)
  console.error(`Size: ${size}`)
  console.error(`Customer email: ${email}`)
  console.error(`Note: ${note || '(none)'}`)
  console.error(`Customer (from state): ${state.name ?? customerName ?? '?'}`)
  console.error(`Customer phone: ${customerPhone ?? '?'}`)
  console.error(`Office (if known): ${state.location ?? '?'}`)
  console.error('══════════════════════════════\n')

  if (!OPERATOR_EMAIL) {
    throw new Error('OPERATOR_EMAIL not configured (settings.json or env)')
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD missing in .env (valuation request logged to console only)')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })

  const subject = `${EMAIL_SUBJECT_PREFIX.replace('Incidencia', 'Valoración')} ${valuationId}`
  const textBody = [
    `Solicitud de valoración: ${valuationId}`,
    '',
    `Dirección del inmueble: ${address}`,
    `Tipo de inmueble: ${propertyType}`,
    `Superficie: ${size}`,
    `Email del cliente: ${email}`,
    `Nota: ${note || '(ninguna)'}`,
    '',
    `Cliente: ${state.name ?? customerName ?? '?'}`,
    `Teléfono: ${customerPhone ?? '?'}`,
    `Oficina (si se conoce): ${state.location ?? '?'}`,
    '',
    '— DemoCasa Bot',
  ].join('\n')

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: OPERATOR_EMAIL,
    subject,
    text: textBody,
  })
}

// ── Email — appointment confirmation (customer) ──────────────────────────────

interface AppointmentParams {
  appointmentId: string
  purpose: 'viewing' | 'franchising'
  customerName: string
  customerEmail: string
  customerPhone?: string
  appointmentDate: string
  appointmentTime: string
  state: SessionState
  calendarLink?: string | null
  zoomLink?: string | null
}

async function sendAppointmentEmail(params: AppointmentParams): Promise<void> {
  const { appointmentId, purpose, customerName, customerEmail, customerPhone, appointmentDate, appointmentTime, state, calendarLink, zoomLink } = params

  console.error('\n══════ APPOINTMENT CONFIRMATION ══════')
  console.error(`Appointment ID: ${appointmentId}`)
  console.error(`Purpose: ${purpose}`)
  console.error(`To: ${customerEmail}`)
  console.error(`Customer: ${customerName}`)
  console.error(`Phone: ${customerPhone ?? '(not provided)'}`)
  console.error(`Office: ${state.location ?? '(not specified)'}`)
  console.error(`Property: ${state.propertyRef ?? '(n/a)'}`)
  console.error(`Date: ${appointmentDate}`)
  console.error(`Time: ${appointmentTime}`)
  console.error(`Zoom: ${zoomLink ?? '(not created)'}`)
  console.error(`Calendar: ${calendarLink ?? '(not created)'}`)
  console.error('════════════════════════════════════════\n')

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD missing in .env (appointment logged to console only)')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })

  const dateObj = new Date(`${appointmentDate}T${appointmentTime}:00Z`)
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const timeStr = appointmentTime

  let subject: string
  let textBody: string

  if (purpose === 'franchising') {
    subject = `[DemoCasa] Franchising Consultation Confirmed — ${appointmentId}`
    textBody = [
      `Hello ${customerName},`,
      '',
      'Your franchising consultation has been confirmed! 👋',
      '',
      `📅 Date: ${dateStr}`,
      `🕐 Time: ${timeStr} (UTC)`,
      ...(zoomLink ? ['', `🔗 Zoom: ${zoomLink}`] : []),
      ...(calendarLink ? ['', `📆 Calendar: ${calendarLink}`] : []),
      '',
      'Our team will discuss:',
      '- Franchising model & business structure',
      '- Startup costs & investment details',
      '- Ongoing support & training',
      '- Timeline & next steps',
      '',
      'See you soon!',
      '',
      '— DemoCasa Team',
    ].join('\n')
  } else {
    subject = `[DemoCasa] Property Viewing Confirmed — ${appointmentId}`
    textBody = [
      `Hello ${customerName},`,
      '',
      'Your property viewing has been confirmed! 🏠',
      '',
      `📅 Date: ${dateStr}`,
      `🕐 Time: ${timeStr} (UTC)`,
      `📍 Office: ${state.location ?? '(to be confirmed)'}`,
      ...(state.propertyRef ? [`🏷️ Property: ${state.propertyRef}`] : []),
      ...(calendarLink ? ['', `📆 Calendar: ${calendarLink}`] : []),
      '',
      'An agent will meet you to show the property and answer your questions.',
      'If anything changes, just reply to this email.',
      '',
      'See you soon!',
      '',
      '— DemoCasa Team',
    ].join('\n')
  }

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: customerEmail,
    subject,
    text: textBody,
  })
}

// ── Email — appointment lead briefing (office/agent) ─────────────────────────

interface AppointmentBriefingParams {
  appointmentId: string
  purpose: 'viewing' | 'franchising'
  appointmentDate: string
  appointmentTime: string
  state: SessionState
  calendarLink?: string | null
  zoomLink?: string | null
}

async function sendAppointmentOperatorBriefing(params: AppointmentBriefingParams): Promise<void> {
  const { appointmentId, purpose, appointmentDate, appointmentTime, state, calendarLink, zoomLink } = params

  console.error('\n══════ APPOINTMENT LEAD (operator) ══════')
  console.error(`Appointment ID: ${appointmentId}`)
  console.error(`Purpose: ${purpose}`)
  console.error(`To: ${OPERATOR_EMAIL || '(no operatorEmail configured)'}`)
  console.error(`Customer: ${state.name ?? '?'}`)
  console.error(`Email: ${state.email ?? '?'}`)
  console.error(`Phone: ${state.phone ?? '?'}`)
  console.error(`Office: ${state.location ?? '?'}`)
  console.error(`Property: ${state.propertyRef ?? '?'}`)
  console.error(`Slot: ${appointmentDate} ${appointmentTime}`)
  console.error('══════════════════════════════════════════\n')

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

  const isFranchising = purpose === 'franchising'
  const subject = isFranchising
    ? `[DemoCasa] Nueva consulta franchising — ${appointmentId}`
    : `[DemoCasa] Nueva visita de inmueble — ${appointmentId}`
  const textBody = [
    isFranchising
      ? 'Nueva solicitud de consulta de franchising.'
      : 'Nueva solicitud de visita a un inmueble.',
    '',
    `🆔 Cita: ${appointmentId}`,
    `🗓️ Fecha/hora: ${appointmentDate} ${appointmentTime} (UTC)`,
    '',
    '— Cliente —',
    `👤 Nombre: ${state.name ?? '(no facilitado)'}`,
    `📧 Email: ${state.email ?? '(no facilitado)'}`,
    `📞 Teléfono: ${state.phone ?? '(no facilitado)'}`,
    `📍 Oficina/Ciudad: ${state.location ?? '(no especificada)'}`,
    ...(state.propertyRef ? [`🏷️ Inmueble: ${state.propertyRef}`] : []),
    ...(state.operation ? [`🔁 Operación: ${state.operation}`] : []),
    `🌐 Idioma: ${state.language ?? '(desconocido)'}`,
    '',
    '— Interés —',
    isFranchising
      ? 'Consulta de franchising (apertura de agencia DemoCasa).'
      : 'Visita a inmueble.',
    ...(zoomLink ? ['', `🔗 Zoom: ${zoomLink}`] : []),
    ...(calendarLink ? [`📆 Calendar: ${calendarLink}`] : []),
    '',
    '— DemoCasa Bot',
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
  console.error(`Office: ${state.location ?? '?'}`)
  console.error(`Property: ${state.propertyRef ?? '?'}`)
  console.error(`Operation: ${state.operation ?? '?'}`)
  console.error(`Language: ${state.language ?? '?'}`)
  console.error('---')
  console.error(summary)
  console.error('══════════════════════════════════\n')

  if (!OPERATOR_EMAIL) {
    throw new Error('OPERATOR_EMAIL not configured (settings.json or env)')
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD missing in .env (briefing logged to console only)')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })

  const subject = `${EMAIL_SUBJECT_PREFIX} ${ticketId} — ${state.location ?? 'oficina ?'} — ${reason}`
  const textBody = [
    `Ticket: ${ticketId}`,
    `Razón: ${reason}`,
    '',
    summary,
    '',
    '— DemoCasa Bot',
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
  const runtimeBlock = formatRuntimeBlock(operatorBriefingLanguageOverride, isFirstTurn)

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
  // `cache_control`. In local mode, flatten the system message to a plain
  // string so the request is valid, and append Qwen's `/no_think` soft-switch.
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
      'X-Title': 'DemoCasa',
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
  const isFirstTurn = history.length === 0

  history.push({ role: 'user', content: sanitizedMessage })

  let nudgedAfterEmpty = false
  let tokensUsed = 0
  let escalated = false
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
      const { reply: text, lang } = extractLanguage(response.content || '')

      // Empty-reply recovery.
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

      history.push({ role: 'assistant', content: text })
      if (process.env.LLM_DEBUG === '1') {
        console.error(`[state] ${formatStateOneLine(getState(ctx.sessionId))}`)
      }
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
        'Esta conversación es muy larga. Por favor inicia una nueva sesión o contacta directamente con la oficina.',
      tokensUsed: 0,
      escalated: false,
    }
  }

  // Language is judged by the LLM (⟦LANG:xx⟧ trailer), not detected here.

  // PII redaction (see pii.ts).
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
// prompts/faqs.md + prompts/flows/*.md + prompts/locations/*.md. Concatenated
// in deterministic (alphabetical) order so the resulting blob is byte-identical
// across boots → cache hit always.

async function buildSystemPrompt(): Promise<string> {
  const common = await readFile(path.join(PROMPTS_DIR, 'common.md'), 'utf8')
  const franchising = await readFileOrEmpty(path.join(PROMPTS_DIR, 'franchising.md'))
  const faqs = await readFileOrEmpty(path.join(PROMPTS_DIR, 'faqs.md'))
  const flows = await loadDir(path.join(PROMPTS_DIR, 'flows'))
  const locations = await loadDir(path.join(PROMPTS_DIR, 'locations'))

  const parts: string[] = [common]

  if (franchising) {
    parts.push('', '════════ FRANCHISING CONSULTATION ════════', '', franchising)
  }

  if (faqs) {
    parts.push('', '════════ FAQS ════════', '', faqs)
  }

  if (flows.length > 0) {
    parts.push('', '════════ FLOWS ════════', '')
    for (const { name, content } of flows) {
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

// Demo availability: next Monday 10:00 + 15:00 and next Tuesday 11:00,
// always strictly in the future relative to `now`. In production, fetch
// real availability from the database. Used both by the RUNTIME block (so
// the model offers real dates) and by the schedule_appointment handler
// (so slotIndex resolves to the same dates the model offered).
interface AppointmentSlot {
  date: string // YYYY-MM-DD
  time: string // HH:MM
  dayName: string
}

function getAppointmentSlots(now: Date): AppointmentSlot[] {
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
  const monday = nextWeekday(1)
  const tuesday = nextWeekday(2)
  return [
    { date: iso(monday), time: '10:00', dayName: 'Monday' },
    { date: iso(monday), time: '15:00', dayName: 'Monday' },
    { date: iso(tuesday), time: '11:00', dayName: 'Tuesday' },
  ]
}

function formatRuntimeBlock(
  operatorBriefingLanguageOverride?: string | null,
  isFirstTurn = false,
): string {
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
  const briefingLanguage =
    (operatorBriefingLanguageOverride && operatorBriefingLanguageOverride.trim()) ||
    OPERATOR_BRIEFING_LANGUAGE
  const slots = getAppointmentSlots(now)
  return [
    '',
    '═══ RUNTIME ═══',
    `Current date: ${date}`,
    `Current time: ${time}`,
    `Turn: ${isFirstTurn ? 1 : 2}`,
    `Operator briefing language: ${briefingLanguage}`,
    'Appointment slots (offer EXACTLY these, by index — used for both property viewings and franchising consultations):',
    ...slots.map((s, i) => `  ${i + 1}. ${s.dayName} ${s.date} ${s.time}`),
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
// `chatbotFn(input)`.

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
    /** Open ISO 2-letter language code (a phone-prefix guess from the host). */
    language?: string
    /** Per-turn override for the operator briefing language only. */
    operatorBriefingLanguageOverride?: string | null
    /** Real side-effect handlers injected by the host. Absent in REPL/batch. */
    handlers?: {
      scheduleAppointment?: ScheduleAppointmentHandler
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
  /** ISO 2-letter code of the language the bot actually replied in. */
  language?: string
  shouldEscalate: boolean
  escalationSummary?: string
  notificationEmails?: string
  /** When true, the host should close this chat session. */
  closeChat: boolean
  patches?: CustomerPatch[]
  audioOutput: boolean
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
        meta: { tokensUsed: 0, agentChain: ['custom-democasa'] },
        error: 'llm_unavailable',
      }
    }

    const systemPrompt = await getCachedSystemPrompt()
    const sessionId = input.context.sessionId

    // 🌐 LANGUAGE = decided by the CUSTOMER'S MESSAGE, never by the phone
    // prefix. We deliberately DO NOT seed the session language from
    // input.config.language. With no seed, on the first turn the LLM detects
    // the language from the message and falls back to Spanish only when the
    // message is genuinely undecidable. From there the ⟦LANG:xx⟧ trailer keeps
    // it sticky.

    const history: Message[] = input.context.history.map((h) => ({
      role: h.role,
      content: h.content,
    }))

    const ctx: ToolContext = {
      sessionId,
      customerName: input.userName,
      customerPhone: input.context.phoneNumber,
      workspaceId: input.config.workspaceId,
      scheduleAppointment: input.config.handlers?.scheduleAppointment,
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
      language: getState(sessionId).language,
      shouldEscalate: result.escalated,
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
        agentChain: ['custom-democasa'],
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
      meta: { tokensUsed: 0, agentChain: ['custom-democasa'] },
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function runInteractive(systemPrompt: string): Promise<void> {
  const sessionId = 'cli-interactive'
  const history: Message[] = []
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  console.log('DemoCasa chatbot — assembled prompt + state + tools + escalation.')
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
  // Accept both `--debug` (canonical) and a bare `debug` token, so
  // `npm run test debug` works exactly as typed (npm forwards `debug` as a
  // plain argv entry, not `--debug`).
  if (process.argv.includes('--debug') || process.argv.includes('debug')) {
    process.env.LLM_DEBUG = '1'
  }
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
