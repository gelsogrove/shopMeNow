// Escalation context payload passed from the agent to the operator-handover
// summary builder.

export type EscalationContext = {
  customerName: string | null
  customerPhone: string | null
  locationDisplay: string
  machineType: string
  machineNumber: string
  paymentCompleted: boolean | null
  displayState: string
  issueSummary: string
  nonTroubleshootingIncident: string
  discountCode: string
  escalationReason: string
  timestamp: string
  pendingFlow: string
  // Caso 9 — present when the customer completed the invoice data collection.
  invoiceData?: {
    razonSocial: string
    direccion: string
    cif: string
    fecha: string
    fechaIso: string
    email: string
  }
  // Caso 8 — present when the customer provided a code in the SAU2904266 format.
  caso8Data?: {
    letters: string
    fechaIso: string
    importe: string
    doorClosed: boolean | null
  }
}
