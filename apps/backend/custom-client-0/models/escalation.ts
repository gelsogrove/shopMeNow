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
}
