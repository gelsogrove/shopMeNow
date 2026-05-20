// Thin wrapper that lazy-loads the custom-ecolaundry email module at runtime.
// WHY: human-message-email.ts lives in custom-ecolaundry/ which uses internal
// .js ESM imports (logger.js, models/index.js). Jest's CJS resolver cannot
// follow those paths, so a static import would break every test that touches
// any controller importing this service. The dynamic import is deferred to
// call time so Jest never loads the module during test collection.
// ts-node-dev resolves the .ts source directly at runtime — no compiled .js needed.

export type { HumanMessageEmailData } from '../../../custom-ecolaundry/utils/human-message-email'

export interface SmtpConfig {
  user: string
  pass: string
  host?: string
  port?: number
  secure?: boolean
  from?: string
}

export async function sendEscalationEmail(
  data: {
    summary: string
    history: { role: 'user' | 'assistant'; content: string }[]
    customerName: string
    customerPhone?: string
    companyName: string
    timestamp: string
  },
  notificationEmails: string,
  smtpConfig?: SmtpConfig
): Promise<void> {
  const mod = await import('../../../custom-ecolaundry/utils/human-message-email')
  await mod.sendHumanMessageEmail(data, notificationEmails, smtpConfig)
}
