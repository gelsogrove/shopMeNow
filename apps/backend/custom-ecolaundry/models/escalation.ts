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
  // Invoice request — present when the customer completed the invoice data collection.
  invoiceData?: {
    razonSocial: string
    direccion: string
    cif: string
    fecha: string
    fechaIso: string
    email: string
  }
  // Discount code — present when the customer provided a code in the SAU2904266 format.
  discountCodeData?: {
    letters: string
    fechaIso: string
    importe: string
    doorClosed: boolean | null
  }
}
