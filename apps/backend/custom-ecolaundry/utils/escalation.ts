// Escalation to operator: collect customer name and generate summary for
// operator. The EscalationContext type lives in ../models/escalation.ts.
//
// F106 (2026-05-25) — multilingual operator briefing. All customer-facing
// summary strings are now keyed in `json/i18n/<lang>.json` under the
// `summary*` namespace. `buildEscalationSummary(ctx, lang?)` accepts an
// optional language override (defaults to 'es' for backwards-compat with
// existing tests). The active tenant configures the language via
// `settings.operatorBriefingLanguage`.
import type { EscalationContext, SessionState, SupportedLanguage } from '../models/index.js'
import { sanitizeForDisplay } from './input-sanitize.js'
import { t, tt } from './localization.js'

// Map operatorBriefingLanguage -> Intl locale used by formatHandoverTimestamp.
// Adding a language requires both: an entry here AND parity in json/i18n/<lang>.json
// (summary* keys). validateSettings in utils/runtime.ts ensures the language is
// in enabledLanguages, so unknown values cannot reach here at runtime.
const TIMESTAMP_LOCALE: Record<SupportedLanguage, string> = {
  es: 'es-ES',
  it: 'it-IT',
  en: 'en-GB',
  ca: 'ca-ES',
  pt: 'pt-PT',
  fr: 'fr-FR',
}

/**
 * Operator-facing timestamp prefix. Every handover summary opens with the
 * localised "el [day] [date] at [HH:MM]" so the operator sees WHEN the case
 * happened without parsing the dialog.
 *
 * Timezone is fixed to Europe/Madrid (tenant location). Locale follows
 * `lang` (default 'es' for back-compat with the deterministic test suite).
 *
 * Exported so `utils/operator-briefing.ts` can pass the same timestamp into
 * the LLM user prompt — both deterministic and LLM paths produce identically
 * stamped briefings.
 */
export function formatHandoverTimestamp(lang: SupportedLanguage = 'es'): string {
  const now = new Date()
  const locale = TIMESTAMP_LOCALE[lang] || TIMESTAMP_LOCALE.es
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    timeZone: 'Europe/Madrid',
  }).format(now)
  const date = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Madrid',
  }).format(now)
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Madrid',
  }).format(now)
  // F106 — the prefix wording itself is localised via the
  // `summaryTimestampPrefix` template (e.g. "El {day} {date} a las {time}").
  return tt('summaryTimestampPrefix', lang, { day, date, time })
}

/**
 * Compose the operator-visible location string from `state.location` (the
 * pueblo/laundromat key) and `state.locationStreet` (street within that
 * laundromat, used for Mataró disambiguation).
 *
 * Rule: never repeat the same value twice. When the LLM treats a street
 * answer as a fresh location (e.g. customer says "Alemanya" to disambiguate
 * Mataró → set_location resolves it as the standalone Alemanya laundry AND
 * sets locationStreet="Alemanya"), the naive `${a}, ${b}` produces
 * "Alemanya, Alemanya". This formatter normalises and dedups.
 */
function formatLocationDisplay(location: string, street: string): string {
  if (!street) return location
  if (street.trim().toLowerCase() === location.trim().toLowerCase()) {
    return location
  }
  return `${location}, ${street}`
}

const NON_TROUBLE_KEY: Record<string, string> = {
  'datafono-wrong-amount': 'summaryNonTroubleDatafono',
  'cameras-or-ajax': 'summaryNonTroubleCameras',
  'dryer-minutes-not-credited': 'summaryNonTroubleDryerMinutes',
  'card-payment': 'summaryNonTroubleCardPayment',
  'refund-demand': 'summaryNonTroubleRefund',
  'compensation-demand': 'summaryNonTroubleCompensation',
  'contradictory-narrative': 'summaryNonTroubleContradictory',
  'numeric-only-code': 'summaryNonTroubleNumericCode',
  'undocumented-display': 'summaryNonTroubleUndocumentedDisplay',
}

/**
 * F106 — Optional `lang` argument. Defaults to 'es' so the existing test
 * suite (27 calls without lang) keeps producing Spanish output identical to
 * the pre-i18n behaviour. Production call sites pass
 * `ar.runtime.settings.operatorBriefingLanguage ?? 'es'`.
 */
export function buildEscalationSummary(
  context: EscalationContext,
  lang: SupportedLanguage = 'es',
): string {
  const timestamp = formatHandoverTimestamp(lang)
  return `${timestamp}, ${buildEscalationSummaryBody(context, lang)}`
}

function machineWord(machineType: string, lang: SupportedLanguage): string {
  return machineType === 'dryer' ? t('summaryDryer', lang) : t('summaryWasher', lang)
}

function machineLabel(machineType: string, machineNumber: string, lang: SupportedLanguage): string {
  return tt('summaryMachineLabel', lang, {
    machine: machineWord(machineType, lang),
    number: machineNumber || t('summaryMachineNumberUnknown', lang),
  })
}

function buildEscalationSummaryBody(context: EscalationContext, lang: SupportedLanguage): string {
  // Defence in depth: even if upstream sanitisers were skipped, strip markdown
  // delimiters here so an attacker-controlled customerName/customerPhone can't
  // break formatting or fake links in the operator handover note.
  const safeName = sanitizeForDisplay(context.customerName)
  const safePhone = sanitizeForDisplay(context.customerPhone)
  const baseName = safeName
    ? tt('summaryUserWith', lang, { name: safeName })
    : t('summaryUserAnonymous', lang)
  const name = safePhone ? `${baseName} (${safePhone})` : baseName
  const location = context.locationDisplay || t('summaryLocationUnknown', lang)

  // Case 6: double charge.
  if (/double charge/i.test(context.issueSummary)) {
    const usedServiceNo = /used service:\s*no\b/i.test(context.issueSummary)
    const narrative = context.issueSummary.includes('narrative:')
      ? context.issueSummary.replace(/.*narrative:\s*/i, '').trim()
      : null
    const customerReply = context.issueSummary.includes('customer reply:')
      ? context.issueSummary
          .replace(/.*customer reply:\s*/i, '')
          .replace(/\s*—\s*narrative:.*$/i, '')
          .trim()
      : null
    const mLabel = context.machineNumber
      ? machineLabel(context.machineType, context.machineNumber, lang)
      : ''
    const narrativePart = narrative
      ? tt('summaryDoubleChargeNarrativePart', lang, { narrative })
      : ''
    const replyPart =
      customerReply && !narrative
        ? tt('summaryDoubleChargeReplyPart', lang, { reply: customerReply })
        : ''
    const isContradictory = /contradictory|relato\s+contradictorio|relato\s+confuso/i.test(
      context.escalationReason || '',
    )
    const contradictoryPart = isContradictory ? t('summaryDoubleChargeContradictory', lang) : ''

    if (usedServiceNo) {
      return tt('summaryDoubleChargeNotUsed', lang, {
        name,
        location,
        machineLabel: mLabel,
        replyPart,
        narrativePart,
        contradictoryPart,
      })
    }
    return tt('summaryDoubleChargeUsed', lang, {
      name,
      location,
      machineLabel: mLabel,
      narrativePart,
      contradictoryPart,
    })
  }

  // Case 18: numeric-only code.
  const reasonLower = context.escalationReason || ''
  const isCaso18 =
    /numeric-only\s+code|caso\s*18/i.test(reasonLower) ||
    (/c[oó]digo\s+no\s+documentado|incoherenc/i.test(reasonLower) && /^\d{3,}$/.test(context.discountCode)) ||
    (/^\d{3,}$/.test(context.discountCode) && !/importe|pendiente|completar/i.test(reasonLower))
  if (isCaso18 && context.discountCode) {
    return tt('summaryNumericOnlyCode', lang, {
      name,
      location,
      code: context.discountCode,
    })
  }

  // Case 8: discount code.
  if (context.discountCodeData && context.discountCodeData.letters) {
    const c = context.discountCodeData
    const mLabel = context.machineNumber
      ? tt('summaryDiscountCodeMachine', lang, { number: context.machineNumber })
      : t('summaryDiscountCodeMachineUnknown', lang)
    const doorLabel =
      c.doorClosed === true
        ? t('summaryDiscountCodeDoorClosed', lang)
        : c.doorClosed === false
        ? t('summaryDiscountCodeDoorOpen', lang)
        : t('summaryDiscountCodeDoorUnknown', lang)
    const importeAmbiguous = !c.importe || c.importe.length < 2
    const importePart = importeAmbiguous
      ? t('summaryDiscountCodeImporteUnknown', lang)
      : tt('summaryDiscountCodeImporte', lang, { importe: c.importe })
    return tt('summaryDiscountCodeValid', lang, {
      name,
      location,
      code: context.discountCode,
      letters: c.letters,
      fechaIso: c.fechaIso,
      importePart,
      machineLabel: mLabel,
      doorLabel,
    })
  }
  if (context.discountCode || /caso\s*8/i.test(context.escalationReason || '')) {
    const code = context.discountCode || t('summaryMachineNumberUnknown', lang)
    return tt('summaryDiscountCodeInvalid', lang, { name, location, code })
  }

  // Case 28: contradictory narrative.
  if (/caso\s*28|contradictory|relato\s+contradictorio|relato\s+confuso/i.test(context.escalationReason || '')) {
    return tt('summaryContradictoryNarrative', lang, { name, location })
  }

  // Case 25: angry customer.
  if (/caso\s*25|muy\s+enfadado|cliente.*alterado|angry\s+customer/i.test(context.escalationReason || '')) {
    const machinePart =
      context.machineNumber || context.machineType
        ? ` (${machineLabel(context.machineType, context.machineNumber, lang)})`
        : ''
    const isDoubleCharge = /double-charge-/.test(context.pendingFlow || '')
    const key = isDoubleCharge ? 'summaryAngryDoubleCharge' : 'summaryAngry'
    return tt(key, lang, { name, location, machinePart })
  }

  // Case 5: AL001 sequence error.
  if (/caso\s*5/i.test(context.escalationReason || '')) {
    const display = context.displayLabel || context.displayState
    const displayPart = display ? tt('summaryDisplayPart', lang, { display }) : ''
    return tt('summaryAlarmCase5', lang, {
      name,
      location,
      machineLabel: machineLabel(context.machineType, context.machineNumber, lang),
      displayPart,
    })
  }

  // No-change incident (paid + not activated + central did not return change).
  const isNoChange =
    /^no-change-/i.test(context.pendingFlow || '') ||
    /no-change\s+incident/i.test(context.escalationReason || '')
  if (isNoChange) {
    return tt('summaryNoChange', lang, {
      name,
      location,
      machineLabel: machineLabel(context.machineType, context.machineNumber, lang),
    })
  }

  // Invoice request.
  if (/Invoice\s+request|invoice|factura/i.test(context.escalationReason || '') && context.invoiceData) {
    const inv = context.invoiceData
    const fechaLabel = inv.fechaIso ? `${inv.fecha} (${inv.fechaIso})` : inv.fecha
    const machine = machineWord(context.machineType, lang)
    const costePart = inv.costeTotal
      ? tt('summaryInvoiceCostePart', lang, { coste: inv.costeTotal })
      : ''
    const notesPart = inv.notes ? tt('summaryInvoiceNotesPart', lang, { notes: inv.notes }) : ''
    return tt('summaryInvoice', lang, {
      name,
      location,
      razonSocial: inv.razonSocial,
      direccion: inv.direccion,
      cif: inv.cif,
      fechaLabel,
      machine,
      costePart,
      email: inv.email,
      notesPart,
    })
  }

  // Non-troubleshooting incidents.
  if (context.nonTroubleshootingIncident && NON_TROUBLE_KEY[context.nonTroubleshootingIncident]) {
    const incidentLabel = t(NON_TROUBLE_KEY[context.nonTroubleshootingIncident], lang)
    return tt('summaryNonTrouble', lang, { name, location, incidentLabel })
  }

  // Default: machine-related incident.
  const display = context.displayLabel || context.displayState
  const canonical = context.displayState
  const paymentClause =
    context.paymentCompleted === true
      ? t('summaryPaymentDone', lang)
      : context.paymentCompleted === false
      ? t('summaryPaymentNotDone', lang)
      : t('summaryPaymentUnknown', lang)

  let detail = ''
  if (display) {
    const d = canonical.toUpperCase().replace(/\s+/g, '')
    if (d.startsWith('PUSH')) {
      detail = tt('summaryDisplayPush', lang, { display })
    } else if (d === 'DOOR' || d === 'ALM/DOOR' || d === 'ALMDOOR') {
      detail = tt('summaryDisplayDoor', lang, { display })
    } else if (d === 'SEL') {
      detail = tt('summaryDisplaySel', lang, { display })
    } else if (d === 'PR' || d.startsWith('PRICE')) {
      detail = tt('summaryDisplayPrice', lang, { display })
    } else if (d.startsWith('AL') || d === '001' || d.startsWith('ALM') || d.startsWith('ALN')) {
      detail = tt('summaryDisplayAlarm', lang, { display })
    } else if (d.startsWith('ERR')) {
      detail = tt('summaryDisplayError', lang, { display })
    } else if (d === 'BLANK') {
      detail = t('summaryDisplayBlank', lang)
    } else {
      detail = tt('summaryDisplayGeneric', lang, { display })
    }
  } else {
    detail = t('summaryDisplayNoInfo', lang)
  }

  // F27 — full display sequence when the customer has shown more than one.
  const history = context.displayHistory || []
  const historyPart =
    history.length > 1
      ? tt('summaryHistorySequence', lang, { sequence: history.join(' → ') })
      : ''

  return tt('summaryMachineDefault', lang, {
    name,
    location,
    paymentClause,
    machineLabel: machineLabel(context.machineType, context.machineNumber, lang),
    detail,
    historyPart,
  })
}

export function extractEscalationContext(state: SessionState, customerName: string | null): EscalationContext {
  const baseLocation = state.location || 'ubicación no identificada'
  const location = formatLocationDisplay(baseLocation, state.locationStreet)
  const now = new Date().toLocaleString('es-ES')

  return {
    customerName,
    customerPhone: state.customerPhone,
    locationDisplay: location,
    machineType: state.machineType,
    machineNumber: state.machineNumber,
    paymentCompleted: state.paymentCompleted,
    displayState: state.displayState,
    displayLabel: state.displayLabel || state.displayState,
    displayHistory: state.displayHistory || [],
    issueSummary: state.issueSummary,
    nonTroubleshootingIncident: state.nonTroubleshootingIncident || '',
    discountCode: state.faqCodeValue || '',
    escalationReason: state.escalationReason || '',
    timestamp: now,
    pendingFlow: state.pendingFlow || '',
    invoiceData: state.invoiceData?.email ? { ...state.invoiceData } : undefined,
    discountCodeData: state.discountCodeData?.letters ? { ...state.discountCodeData } : undefined,
  }
}
