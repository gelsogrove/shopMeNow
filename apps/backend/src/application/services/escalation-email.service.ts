// Sends the "Human Support" briefing to one or more operator email addresses
// when a custom chatbot escalates a conversation. Uses nodemailer with SMTP
// credentials from the env (SMTP_HOST / SMTP_USER / SMTP_PASS / …) so we
// share the same transport already used by EmailService.
//
// `notificationEmails` is a comma-separated string (e.g. "ops@x.com,sales@x.com").

import nodemailer from "nodemailer"
import logger from "../../utils/logger"

type HistoryEntry = { role: "user" | "assistant"; content: string }

export interface HumanMessageEmailData {
  summary: string
  history: HistoryEntry[]
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

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const nonEmpty = (h: HistoryEntry[]): HistoryEntry[] =>
  h.filter((m) => m.content && m.content.trim().length > 0)

const speaker = (role: HistoryEntry["role"]): string =>
  role === "user" ? "Customer" : "Bot"

const buildHistoryHtml = (history: HistoryEntry[]): string => {
  const rows = nonEmpty(history)
  if (!rows.length) return '<p style="color:#888"><i>(no prior conversation)</i></p>'
  return rows
    .map((m) => {
      const color = m.role === "user" ? "#2563eb" : "#059669"
      return `<div style="margin:6px 0"><b style="color:${color}">${speaker(m.role)}:</b> ${escapeHtml(m.content)}</div>`
    })
    .join("\n")
}

const buildHistoryText = (history: HistoryEntry[]): string =>
  nonEmpty(history)
    .map((m) => `${speaker(m.role)}: ${m.content}`)
    .join("\n")

const buildHtml = (data: HumanMessageEmailData): string => {
  const phoneLine = data.customerPhone
    ? `<div><b>Phone:</b> ${escapeHtml(data.customerPhone)}</div>`
    : ""
  return `<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:680px;margin:0 auto;padding:16px">
  <h2 style="color:#c2410c;margin:0 0 4px 0">🔔 Human Support requested</h2>
  <div style="color:#666;font-size:12px;margin-bottom:16px">${escapeHtml(data.timestamp)}</div>

  <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin-bottom:16px">
    <div><b>Customer:</b> ${escapeHtml(data.customerName)}</div>
    ${phoneLine}
    <div><b>Workspace:</b> ${escapeHtml(data.companyName)}</div>
  </div>

  <h3 style="margin:16px 0 6px 0">📋 Briefing</h3>
  <pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.5">${escapeHtml(data.summary)}</pre>

  <h3 style="margin:16px 0 6px 0">💬 Recent conversation</h3>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:13px">
    ${buildHistoryHtml(data.history)}
  </div>

  <div style="color:#888;font-size:11px;margin-top:16px">Sent automatically by eChatbot.</div>
</body></html>`
}

const buildText = (data: HumanMessageEmailData): string =>
  [
    `🔔 Human Support requested`,
    data.timestamp,
    ``,
    `Customer: ${data.customerName}`,
    data.customerPhone ? `Phone: ${data.customerPhone}` : null,
    `Workspace: ${data.companyName}`,
    ``,
    `--- Briefing ---`,
    data.summary,
    ``,
    `--- Recent conversation ---`,
    buildHistoryText(data.history),
  ]
    .filter((line) => line !== null)
    .join("\n")

const resolveSmtp = (smtpConfig?: SmtpConfig) => ({
  host: smtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com",
  port: smtpConfig?.port ?? parseInt(process.env.SMTP_PORT || "587"),
  secure: smtpConfig?.secure ?? process.env.SMTP_SECURE === "true",
  user: smtpConfig?.user || process.env.SMTP_USER || "",
  pass: smtpConfig?.pass || process.env.SMTP_PASS || "",
  from: smtpConfig?.from || process.env.SMTP_FROM || "noreply@echatbot.ai",
})

export async function sendEscalationEmail(
  data: HumanMessageEmailData,
  notificationEmails: string,
  smtpConfig?: SmtpConfig
): Promise<void> {
  const smtp = resolveSmtp(smtpConfig)

  if (!smtp.user || !smtp.pass) {
    logger.error(
      "[escalation-email] SMTP credentials missing — set SMTP_USER and SMTP_PASS",
      { to: notificationEmails, customer: data.customerName }
    )
    throw new Error("SMTP credentials required for escalation email")
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })

  await transporter.sendMail({
    from: `"eChatbot" <${smtp.from}>`,
    to: notificationEmails,
    subject: `🔔 Human Support — ${data.customerName} (${data.companyName})`,
    html: buildHtml(data),
    text: buildText(data),
  })

  logger.info("[escalation-email] Email sent", {
    to: notificationEmails,
    customer: data.customerName,
    company: data.companyName,
  })
}
