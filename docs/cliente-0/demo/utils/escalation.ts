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
  const machine = context.machineType === 'dryer' ? 'secadora' : 'lavadora'
  const number = context.machineNumber || 'número desconocido'
  const payment = context.paymentCompleted === true ? 'ha efectuado el pago' : 'estado de pago incierto'
  const displayInfo = context.displayState ? `la pantalla muestra: ${context.displayState}` : 'sin información de pantalla'
  const issue = context.issueSummary || 'problema técnico'

  return `${name} en ${location} ha ${payment} por la ${machine} número ${number}. ` +
    `El cliente seleccionó el programa pero ${issue}. ` +
    `${displayInfo}.`
}

export function extractEscalationContext(state: SessionState, customerName: string | null): EscalationContext {
  const location = state.location || 'ubicación no identificada'
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
