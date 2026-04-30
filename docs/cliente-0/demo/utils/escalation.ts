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
  timestamp: string
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
    timestamp: now,
  }
}

export function isReadyToEscalate(state: SessionState): boolean {
  // Minimum context needed to escalate: we have machine type, number, and display state
  return !!(state.machineType && state.machineNumber && state.displayState)
}
