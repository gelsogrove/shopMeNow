// Invoice request — Factura: multi-step data collection then escalation.
//
// Flow:
//   1. lavandería  (skip if state.location already set)
//   2. machineType (skip if state.machineType already set)
//   3. razón social
//   4. dirección
//   5. CIF/NIF/NIE
//   6. fecha de uso  (parsed to ISO when possible, raw kept anyway)
//   7. email         (validated; retry until valid)
//   8. nombre        (sets customerName + escalation summary)
//   9. final reply with name + fecha + email

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { parseRelativeDate } from '../relative-date.js'
import { buildEscalationSummary, extractEscalationContext } from '../escalation.js'
import { captureCustomerName, closeAsEscalated, escalate, requireCustomerName } from '../state-transitions.js'
import { detectInvoiceIntent } from '../intent.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function nextCaso9Step(
  ar: { state: { location: string; machineType: string; pendingFlow: string } },
): { reply: string; nextFlow: string } | null {
  // Returns the next question + flow marker, skipping steps whose data is already known.
  if (!ar.state.location) return { reply: 'invoiceAskLocation', nextFlow: 'invoice-ask-location' }
  if (!ar.state.machineType) return { reply: 'invoiceAskMachineType', nextFlow: 'invoice-ask-machine-type' }
  return null
}

export const guardInvoiceFlow: Guard = (ar, userMessage) => {
  const trimmed = userMessage.trim()
  const flow = ar.state.pendingFlow
  const isCaso9Flow = flow.startsWith('invoice-')

  // Block if already in operator handoff for an unrelated case.
  if (!isCaso9Flow && (ar.state.operatorRequested || ar.state.customerNameRequested)) {
    return null
  }

  // Entry point: customer mentions invoice and we are not already in the flow.
  // Detection delegated to `detectInvoiceIntent` (utils/intent.ts) — multi-
  // language + typo-tolerant. REGRESSION 2026-05-09: typo "factra" / "fctra"
  // used to fall through silently and drop the customer into the machine flow.
  if (!isCaso9Flow) {
    if (!detectInvoiceIntent(userMessage)) return null
    ar.state.lastResolvedIntent = 'faq'
    ar.state.faqTopic = 'invoice'
    // Decide which step to start from based on already-known sticky facts.
    const skipped = nextCaso9Step(ar)
    if (skipped) {
      ar.state.pendingFlow = skipped.nextFlow as typeof ar.state.pendingFlow
      return { reply: t(skipped.reply, lang(ar)), reason: 'invoice' }
    }
    ar.state.pendingFlow = 'invoice-ask-company-name'
    return { reply: t('invoiceAskCompanyName', lang(ar)), reason: 'invoice' }
  }

  // In-flow: each step consumes the user message as the answer.
  switch (flow) {
    case 'invoice-ask-location': {
      // Location auto-extracted by autoExtractFacts before this guard runs.
      // If it still didn't set location, store the raw answer as location anyway.
      if (!ar.state.location) ar.state.location = trimmed
      ar.state.pendingFlow = 'invoice-ask-machine-type'
      return { reply: t('invoiceAskMachineType', lang(ar)), reason: 'invoice' }
    }
    case 'invoice-ask-machine-type': {
      if (!ar.state.machineType) {
        // Lightweight heuristic: only "lavadora/secadora" tokens. The autoExtractor
        // normally handles this before the guard, so this is a fallback.
        const low = trimmed.toLowerCase()
        if (/\b(lavadora|washer|lavatrice|laveuse|machine\s+a\s+laver)\b/.test(low)) ar.state.machineType = 'washer'
        else if (/\b(secadora|dryer|asciugatrice|s[èe]che[- ]linge)\b/.test(low)) ar.state.machineType = 'dryer'
        else ar.state.machineType = 'washer' // accept any text, default washer; raw message is in history for the operator
      }
      ar.state.pendingFlow = 'invoice-ask-company-name'
      return { reply: t('invoiceAskCompanyName', lang(ar)), reason: 'invoice' }
    }
    case 'invoice-ask-company-name': {
      ar.state.invoiceData.razonSocial = trimmed
      ar.state.pendingFlow = 'invoice-ask-address'
      return { reply: t('invoiceAskAddress', lang(ar)), reason: 'invoice' }
    }
    case 'invoice-ask-address': {
      ar.state.invoiceData.direccion = trimmed
      ar.state.pendingFlow = 'invoice-ask-tax-id'
      return { reply: t('invoiceAskTaxId', lang(ar)), reason: 'invoice' }
    }
    case 'invoice-ask-tax-id': {
      ar.state.invoiceData.cif = trimmed
      ar.state.pendingFlow = 'invoice-ask-date'
      return { reply: t('invoiceAskDate', lang(ar)), reason: 'invoice' }
    }
    case 'invoice-ask-date': {
      ar.state.invoiceData.fecha = trimmed
      ar.state.invoiceData.fechaIso = parseRelativeDate(trimmed, ar.state.language)
      ar.state.pendingFlow = 'invoice-ask-email'
      return { reply: t('invoiceAskEmail', lang(ar)), reason: 'invoice' }
    }
    case 'invoice-ask-email': {
      if (!EMAIL_RE.test(trimmed)) {
        // Stay on the same step until a valid email arrives.
        return { reply: t('invoiceAskEmailRetry', lang(ar)), reason: 'invoice' }
      }
      ar.state.invoiceData.email = trimmed
      // F35 — Andrea 2026-05-10: ask optional notes before the name. Customer
      // can type "no" / "ninguna" / free-form text. Whatever they type goes
      // into invoiceData.notes verbatim.
      ar.state.pendingFlow = 'invoice-ask-notes'
      return { reply: t('invoiceAskNotes', lang(ar)), reason: 'invoice' }
    }
    case 'invoice-ask-notes': {
      // F35 — accept any text including "no/ninguna/nessuna" → store as empty.
      const lower = trimmed.toLowerCase()
      const isNegative = /^(no|ninguna|nessuna|nothing|none|nada|rien)\b/i.test(lower)
      ar.state.invoiceData.notes = isNegative ? '' : trimmed
      ar.state.pendingFlow = 'invoice-ask-name'
      requireCustomerName(ar)
      return { reply: t('invoiceAskName', lang(ar)), reason: 'invoice' }
    }
    case 'invoice-ask-name': {
      // Accept the raw input as the customer's name (no validation per Andrea's rules).
      captureCustomerName(ar, trimmed)
      escalate(ar, 'Invoice request — invoice request, data collected')
      ar.state.pendingFlow = ''
      closeAsEscalated(ar)
      const fechaDisplay = ar.state.invoiceData.fechaIso || ar.state.invoiceData.fecha
      const customerReply = t('invoiceFinal', lang(ar))
        .replace('{name}', ar.state.customerName)
        .replace('{fecha}', fechaDisplay)
        .replace('{email}', ar.state.invoiceData.email)
      // Append the operator handoff summary in-place: guard outcomes short-circuit
      // agent.ts before the auto-escalation block runs, so we mirror that block here.
      // F35 — invoice case carries sensitive PII (email, CIF, address). The
      // summary is built deterministically here, NEVER passed through the
      // operator-briefing LLM (which would forward it to a third-party API).
      const ctx = extractEscalationContext(ar.state, ar.state.customerName)
      const summary = buildEscalationSummary(ctx)
      ar.pendingEscalation = null
      const final = `${customerReply}\n\n**👤 Human Support message**\n${summary}`
      return { reply: final, reason: 'invoice-final' }
    }
  }
  return null
}
