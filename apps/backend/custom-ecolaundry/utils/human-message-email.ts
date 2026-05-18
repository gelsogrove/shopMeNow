// Sends a notification email (with HTML chat history) to the configured
// notificationEmails when the bot generates a Human Support message.
//
// Zero-Prisma: this module uses nodemailer directly via SMTP env vars —
// it does NOT import anything from src/ (custom-ecolaundry contract).
//
// Recipients: comma-separated list from settings.notificationEmails.
// Multi-recipient: "a@x.com, b@x.com, c@x.com" → all three receive the email.

import nodemailer from 'nodemailer'
import { logger } from './logger.js'
import type { AgentMessage } from '../models/index.js'

export interface HumanMessageEmailData {
  /** Operator-readable summary (the "Human Support message" block). */
  summary: string
  /** Full conversation history up to the escalation turn. */
  history: AgentMessage[]
  /** Customer display name (may be unknown if not yet captured). */
  customerName: string
  /** Tenant brand name from settings (e.g. "Ecolaundry"). */
  companyName: string
  /** ISO timestamp string for the escalation turn. */
  timestamp: string
}

// ── Recipients ────────────────────────────────────────────────────────────────

/** Parse a comma-separated list of email addresses from settings. */
export function parseRecipients(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return []
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes('@'))
}

// ── HTML template ─────────────────────────────────────────────────────────────

function escapHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderChatHistory(history: AgentMessage[]): string {
  if (!history.length) return '<p style="color:#888;font-style:italic">No hay historial disponible.</p>'

  const bubbles = history.map((msg) => {
    const isUser = msg.role === 'user'
    const bgColor = isUser ? '#f1f5f9' : '#4f46e5'
    const textColor = isUser ? '#1e293b' : '#ffffff'
    const align = isUser ? 'left' : 'right'
    const label = isUser ? '👤 Cliente' : '🤖 Bot'
    const labelColor = isUser ? '#64748b' : '#818cf8'
    const maxWidth = '75%'
    const marginLeft = isUser ? '0' : 'auto'
    const marginRight = isUser ? 'auto' : '0'
    const borderRadius = isUser ? '4px 18px 18px 18px' : '18px 4px 18px 18px'

    return `
      <div style="text-align:${align};margin-bottom:12px;">
        <div style="display:inline-block;max-width:${maxWidth};margin-left:${marginLeft};margin-right:${marginRight};">
          <div style="font-size:11px;color:${labelColor};margin-bottom:3px;font-weight:600;">${label}</div>
          <div style="background:${bgColor};color:${textColor};padding:10px 14px;border-radius:${borderRadius};font-size:14px;line-height:1.5;word-break:break-word;">
            ${escapHtml(msg.content ?? '').replace(/\n/g, '<br>')}
          </div>
        </div>
      </div>`
  })

  return bubbles.join('\n')
}

export function buildEmailHtml(data: HumanMessageEmailData): string {
  const chatHtml = renderChatHistory(data.history)
  const summaryHtml = escapHtml(data.summary).replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Human Support message — ${escapHtml(data.companyName)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#4f46e5;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">🔔 Human Support message</h1>
              <p style="margin:6px 0 0;color:#c7d2fe;font-size:14px;">${escapHtml(data.companyName)} · ${escapHtml(data.timestamp)}</p>
            </td>
          </tr>

          <!-- Alert banner -->
          <tr>
            <td style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 32px;">
              <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">
                ⚠️ Il cliente <strong>${escapHtml(data.customerName)}</strong> ha richiesto supporto operatore.
              </p>
            </td>
          </tr>

          <!-- Operator summary -->
          <tr>
            <td style="padding:24px 32px 0;">
              <h2 style="margin:0 0 12px;color:#1e293b;font-size:16px;font-weight:700;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">
                📋 Riepilogo per l'operatore
              </h2>
              <div style="background:#f8fafc;border-left:4px solid #4f46e5;padding:14px 18px;border-radius:0 8px 8px 0;font-size:14px;color:#334155;line-height:1.6;">
                ${summaryHtml}
              </div>
            </td>
          </tr>

          <!-- Chat history -->
          <tr>
            <td style="padding:24px 32px;">
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:16px;font-weight:700;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">
                💬 Conversazione completa
              </h2>
              <div style="background:#f8fafc;border-radius:8px;padding:16px;">
                ${chatHtml}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f1f5f9;padding:16px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                Generato automaticamente dal chatbot ${escapHtml(data.companyName)} · Non rispondere a questa email
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Send ──────────────────────────────────────────────────────────────────────

/**
 * Send the Human Support notification email to all configured recipients.
 * Silently skips if notificationEmails is empty or SMTP is not configured.
 * Never throws — email failure must not interrupt the main chat flow.
 */
export async function sendHumanMessageEmail(
  data: HumanMessageEmailData,
  notificationEmails: string | undefined
): Promise<void> {
  const recipients = parseRecipients(notificationEmails)
  if (!recipients.length) return

  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  if (!smtpUser || !smtpPass) {
    logger.warn('[HumanMessageEmail] SMTP not configured — skipping notification email')
    return
  }

  const subject = `🔔 Human Support — ${data.customerName} (${data.companyName})`
  const html = buildEmailHtml(data)
  const text = `Human Support message\n\nCliente: ${data.customerName}\n${data.timestamp}\n\n${data.summary}`

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: `"${data.companyName}" <${process.env.SMTP_FROM || smtpUser}>`,
      to: recipients.join(', '),
      subject,
      text,
      html,
    })

    logger.info(`[HumanMessageEmail] Sent to ${recipients.join(', ')}`)
  } catch (err) {
    logger.error('[HumanMessageEmail] Failed to send notification email:', err)
  }
}
