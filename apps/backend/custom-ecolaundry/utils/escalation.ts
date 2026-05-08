// Escalation to operator: collect customer name and generate summary for
// operator. The EscalationContext type lives in ../models/escalation.ts.
import type { EscalationContext, SessionState } from '../models/index.js'
import { sanitizeForDisplay } from './input-sanitize.js'

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

const NON_TROUBLE_LABEL: Record<string, string> = {
  'datafono-wrong-amount': 'una incoherencia en el importe del datáfono',
  'cameras-or-ajax': 'una incidencia que requiere revisión de cámaras o AJAX',
  'dryer-minutes-not-credited': 'que ha añadido monedas a la secadora pero no se han sumado minutos',
  'card-payment': 'que no ha podido pagar con la tarjeta',
  'refund-demand': 'una solicitud de devolución',
  'compensation-demand': 'una solicitud de compensación',
  'contradictory-narrative': 'un relato contradictorio sobre un cobro',
  'numeric-only-code': 'un código solo numérico que requiere revisión',
  'undocumented-display': 'un código de pantalla no documentado',
}

export function buildEscalationSummary(context: EscalationContext): string {
  // Defence in depth: even if upstream sanitisers were skipped, strip markdown
  // delimiters here so an attacker-controlled customerName/customerPhone can't
  // break formatting or fake links in the operator handover note.
  const safeName = sanitizeForDisplay(context.customerName)
  const safePhone = sanitizeForDisplay(context.customerPhone)
  const baseName = safeName ? `Usuario ${safeName}` : 'Usuario sin nombre'
  const name = safePhone ? `${baseName} (${safePhone})` : baseName
  const location = context.locationDisplay || 'ubicación desconocida'

  // Case 6: double charge — no machine info needed
  if (/double charge/i.test(context.issueSummary)) {
    const narrative = context.issueSummary.includes('narrative:')
      ? context.issueSummary.replace(/.*narrative:\s*/i, '').trim()
      : null
    const narrativePart = narrative ? ` Relato del cliente: ${narrative}` : ''
    return `${name} en ${location} ha reportado un doble cobro.${narrativePart}`
  }

  // Case 18: numeric-only code without letters — incoherence, escalate
  // without confronting the customer. Detect via:
  //   - reason starts with "Numeric-only code" (set by the deterministic guard)
  //   - reason contains "código no documentado" or "incoherencia" (LLM rewrites)
  //   - discountCode is purely numeric (≥3 digits, no letters)
  // Detect this BEFORE the Caso 8 branch (which would otherwise grab the same
  // faqCodeValue for purely-numeric codes).
  const reasonLower = context.escalationReason || ''
  const isCaso18 =
    /numeric-only\s+code|caso\s*18/i.test(reasonLower) ||
    (/c[oó]digo\s+no\s+documentado|incoherenc/i.test(reasonLower) && /^\d{3,}$/.test(context.discountCode)) ||
    (/^\d{3,}$/.test(context.discountCode) && !/importe|pendiente|completar/i.test(reasonLower))
  if (isCaso18 && context.discountCode) {
    const code = context.discountCode
    return `${name} en ${location} ha facilitado un código solo numérico (${code}) que no encaja con el formato esperado y requiere revisión manual.`
  }

  // Case 8: discount code. Two branches:
  //   (a) code matches SAU2904266 format → forward parsed data + machine info
  //       so the operator can validate and remotely activate the machine.
  //   (b) code format invalid → ask the operator to review manually.
  if (context.discountCodeData && context.discountCodeData.letters) {
    const c = context.discountCodeData
    const machineLabel = context.machineNumber ? `máquina nº ${context.machineNumber}` : 'máquina sin número'
    const doorLabel = c.doorClosed === true ? 'puerta cerrada' : c.doorClosed === false ? 'puerta NO cerrada' : 'estado puerta desconocido'
    return `${name} en ${location} ha facilitado un código válido (${context.discountCode}: letras ${c.letters}, fecha ${c.fechaIso}, importe ${c.importe}€) en la ${machineLabel} (${doorLabel}). Requiere validación y activación remota.`
  }
  if (context.discountCode || /caso\s*8/i.test(context.escalationReason || '')) {
    const code = context.discountCode || 'no especificado'
    return `${name} en ${location} ha facilitado el código ${code} con un formato no reconocido. Requiere revisión manual.`
  }

  // Case 28: contradictory narrative — escalate without arguing.
  if (/caso\s*28|contradictory|relato\s+contradictorio|relato\s+confuso/i.test(context.escalationReason || '')) {
    return `${name} en ${location} ha presentado un relato contradictorio o confuso sobre un cobro/incidencia y requiere revisión manual.`
  }

  // Case 25: cliente muy enfadado — escalado tras recogida de datos mínimos.
  if (/caso\s*25|muy\s+enfadado|cliente.*alterado/i.test(context.escalationReason || '')) {
    const machineLabel = context.machineType === 'dryer' ? 'secadora' : 'lavadora'
    const numberLabel = context.machineNumber || 'desconocido'
    return `${name} en ${location} (${machineLabel} número ${numberLabel}) ha mostrado mucho malestar y exige una solución inmediata. Requiere atención prioritaria.`
  }

  // Case 5: AL001 sequence error — escalate after the retry guidance failed
  // (display still shows AL001 or another error code, customer can't follow
  // the instructions).
  if (/caso\s*5/i.test(context.escalationReason || '')) {
    const machineLabel = context.machineType === 'dryer' ? 'secadora' : 'lavadora'
    const numberLabel = context.machineNumber || 'desconocido'
    const displayLabel = context.displayState ? ` (pantalla: ${context.displayState})` : ''
    return `${name} en ${location} sigue con AL001 en la ${machineLabel} número ${numberLabel}${displayLabel}: la guía de secuencia correcta no ha resuelto el problema y requiere revisión técnica.`
  }

  // Case 4: paid but not activated, central did not return change (or did
  // but machine still won't start). Detection is layered because the LLM
  // may rewrite escalationReason on later turns:
  //   - explicit "caso 4" mention in the reason
  //   - keyword pair pagado + activado in the reason
  //   - or the deterministic flow flag set by agent-extract when the
  //     customer triggered the case ("he pagado y no se ha activado").
  const reason = context.escalationReason || ''
  const isNoChange =
    /No-change\s+incident|caso\s*4/i.test(reason) ||
    (/(pagad|pagat|pagat[oa]|pago)/i.test(reason) && /(no\s+se\s+(ha\s+)?activad|no\s+arranca|sigue\s+sin)/i.test(reason)) ||
    /^no-change-/i.test(context.pendingFlow || '')
  if (isNoChange) {
    const machineLabel = context.machineType === 'dryer' ? 'secadora' : 'lavadora'
    const numberLabel = context.machineNumber || 'desconocido'
    return `${name} en ${location} ha pagado pero la ${machineLabel} número ${numberLabel} no se ha activado tras corregir el número en la central. Requiere revisión manual.`
  }

  // Invoice request — include all collected billing data for the operator.
  if (/Invoice\s+request|invoice|factura/i.test(context.escalationReason || '') && context.invoiceData) {
    const inv = context.invoiceData
    const fechaLabel = inv.fechaIso ? `${inv.fecha} (${inv.fechaIso})` : inv.fecha
    const machineLabel = context.machineType === 'dryer' ? 'secadora' : 'lavadora'
    return `${name} en ${location} ha solicitado factura. Datos: razón social: ${inv.razonSocial}; dirección: ${inv.direccion}; CIF/NIF: ${inv.cif}; fecha de uso: ${fechaLabel}; máquina: ${machineLabel}; email: ${inv.email}.`
  }

  // Non-troubleshooting incidents (datafono / cameras / refund / …) —
  // no machine template, just the incident-specific label.
  if (context.nonTroubleshootingIncident && NON_TROUBLE_LABEL[context.nonTroubleshootingIncident]) {
    return `${name} en ${location} ha reportado ${NON_TROUBLE_LABEL[context.nonTroubleshootingIncident]}.`
  }

  // Default: machine-related incident (PUSH / DOOR / SEL / ALN / ALM / AL001 / 001 / ERR).
  const machine = context.machineType === 'dryer' ? 'secadora' : 'lavadora'
  const number = context.machineNumber || 'desconocido'
  const display = context.displayState
  const paymentClause = context.paymentCompleted === true
    ? 'ha efectuado el pago'
    : context.paymentCompleted === false
    ? 'no ha efectuado el pago'
    : 'no ha podido completar la operación'

  // Display-specific narrative. We pick the phrasing per known display family
  // so the operator gets a meaningful one-liner instead of a generic one.
  let detail = ''
  if (display) {
    const d = display.toUpperCase().replace(/\s+/g, '')
    if (d.startsWith('PUSH')) {
      detail = `La pantalla muestra ${display} y, tras pulsar el programa, la máquina no responde.`
    } else if (d === 'DOOR' || d === 'ALM/DOOR' || d === 'ALMDOOR') {
      detail = `La pantalla muestra ${display}: la puerta no cierra correctamente.`
    } else if (d === 'SEL') {
      detail = `La pantalla muestra ${display}: el cliente debe seleccionar el programa pero el problema persiste.`
    } else if (d === 'PR' || d.startsWith('PRICE')) {
      detail = `La pantalla muestra ${display}: la máquina no acepta el pago.`
    } else if (d.startsWith('AL') || d === '001' || d.startsWith('ALM') || d.startsWith('ALN')) {
      detail = `La pantalla muestra el código de alarma ${display} y requiere revisión técnica.`
    } else if (d.startsWith('ERR')) {
      detail = `La pantalla muestra el código de error ${display} y la máquina no funciona.`
    } else if (d === 'BLANK') {
      detail = `La pantalla está en blanco y la máquina no responde.`
    } else {
      detail = `La pantalla muestra ${display} y la máquina no responde correctamente.`
    }
  } else {
    detail = `Sin información clara de pantalla; se requiere revisión manual.`
  }

  return `${name} en ${location} ${paymentClause} en la ${machine} número ${number}. ${detail}`
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

