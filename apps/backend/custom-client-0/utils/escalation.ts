// Escalation to operator: collect customer name and generate summary for operator
import type { SessionState } from './state.js'

export type EscalationContext = {
  customerName: string | null
  locationDisplay: string
  machineType: string
  machineNumber: string
  paymentCompleted: boolean | null
  displayState: string
  issueSummary: string
  nonTroubleshootingIncident: string
  timestamp: string
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
  const name = context.customerName ? `Usuario ${context.customerName}` : 'Usuario sin nombre'
  const location = context.locationDisplay || 'ubicación desconocida'

  // Case 6: double charge — no machine info needed
  if (/double charge/i.test(context.issueSummary)) {
    const narrative = context.issueSummary.includes('narrative:')
      ? context.issueSummary.replace(/.*narrative:\s*/i, '').trim()
      : null
    const narrativePart = narrative ? ` Relato del cliente: ${narrative}` : ''
    return `${name} en ${location} ha reportado un doble cobro.${narrativePart}`
  }

  // Non-troubleshooting incidents (datafono / cameras / refund / …) —
  // no machine template, just the incident-specific label.
  if (context.nonTroubleshootingIncident && NON_TROUBLE_LABEL[context.nonTroubleshootingIncident]) {
    return `${name} en ${location} ha reportado ${NON_TROUBLE_LABEL[context.nonTroubleshootingIncident]}.`
  }

  // Default: machine-related incident (PUSH / DOOR / SEL / ALN / ALM / AL001 / 001 / ERR).
  const machine = context.machineType === 'dryer' ? 'secadora' : 'lavadora'
  const number = context.machineNumber || 'número desconocido'
  const payment = context.paymentCompleted === true
    ? 'ha efectuado el pago'
    : context.paymentCompleted === false
    ? 'no ha efectuado el pago'
    : 'ha reportado un problema técnico'
  const displayInfo = context.displayState ? `la pantalla muestra: ${context.displayState}` : 'sin información de pantalla'
  const issue = context.issueSummary || 'problema técnico'

  return `${name} en ${location} ${payment} por la ${machine} número ${number}. ` +
    `El cliente seleccionó el programa pero ${issue}. ` +
    `${displayInfo}.`
}

export function extractEscalationContext(state: SessionState, customerName: string | null): EscalationContext {
  const baseLocation = state.location || 'ubicación no identificada'
  const location = state.locationStreet ? `${baseLocation}, ${state.locationStreet}` : baseLocation
  const now = new Date().toLocaleString('es-ES')

  return {
    customerName,
    locationDisplay: location,
    machineType: state.machineType,
    machineNumber: state.machineNumber,
    paymentCompleted: state.paymentCompleted,
    displayState: state.displayState,
    issueSummary: state.issueSummary,
    nonTroubleshootingIncident: state.nonTroubleshootingIncident || '',
    timestamp: now,
  }
}

export function isReadyToEscalate(state: SessionState): boolean {
  // Minimum context needed to escalate: we have machine type, number, and display state
  return !!(state.machineType && state.machineNumber && state.displayState)
}
