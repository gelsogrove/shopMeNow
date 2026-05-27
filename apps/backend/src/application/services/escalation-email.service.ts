// Stub: the previous implementation lazy-loaded custom-ecolaundry/utils/human-message-email,
// which was removed during the 2026-05-27 custom-ecolaundry cleanup. Email delivery for
// custom-chatbot escalations is currently disabled at the backend boundary — re-wire to the
// new custom-ecolaundry/agent.ts:sendEscalationEmail (different signature) when needed.

import logger from "../../utils/logger"

export interface HumanMessageEmailData {
  summary: string
  history: { role: 'user' | 'assistant'; content: string }[]
  customerName: string
  customerPhone?: string
  companyName: string
  timestamp: string
}

export interface SmtpConfig {
  user: string
  pass: string
  host?: string
  port?: number
  secure?: boolean
  from?: string
}

export async function sendEscalationEmail(
  data: HumanMessageEmailData,
  notificationEmails: string,
  _smtpConfig?: SmtpConfig
): Promise<void> {
  logger.warn('[escalation-email] stub active — custom-chatbot escalation email not sent', {
    to: notificationEmails,
    customer: data.customerName,
    company: data.companyName,
  })
}
