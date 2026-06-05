/**
 * Appointment Confirmation Email Service
 *
 * Sends appointment confirmation emails with:
 * - ICS calendar file attachment
 * - Zoom link in description
 * - Google Calendar add-event link
 * - Cancellation link
 */

import nodemailer from 'nodemailer'
import { generateIcs, generateGoogleCalendarUrl } from '../utils/ics-generator'
import logger from '../utils/logger'

interface SendConfirmationEmailParams {
  to: string // Customer email
  customerName: string
  appointmentType: string // e.g., "Consulenza franchising"
  appointmentDate: string // Formatted date (e.g., "lunedì 10 giugno")
  appointmentTime: string // Formatted time (e.g., "15:00")
  startTime: Date
  endTime: Date
  timezone: string
  zoomLink?: string
  googleCalendarLink?: string
  cancellationLink?: string
  language?: string // ISO 639-1 code (default: "en")
  smtpConfig?: { user: string; pass: string; host?: string; port?: number; secure?: boolean; from?: string }
}

const EMAIL_TEMPLATES: Record<string, {
  subject: string
  greeting: string
  confirmationText: string
  zoomText: string
  addToCalendarText: string
  cancelText: string
}> = {
  it: {
    subject: '✅ Appuntamento confermato',
    greeting: 'Ciao {{customerName}},',
    confirmationText: 'Il tuo appuntamento è stato confermato con successo!',
    zoomText: 'Entra su Zoom',
    addToCalendarText: 'Aggiungi al calendario',
    cancelText: 'Cancella appuntamento',
  },
  es: {
    subject: '✅ Cita confirmada',
    greeting: 'Hola {{customerName}},',
    confirmationText: '¡Tu cita ha sido confirmada con éxito!',
    zoomText: 'Entrar en Zoom',
    addToCalendarText: 'Añadir al calendario',
    cancelText: 'Cancelar cita',
  },
  en: {
    subject: '✅ Appointment Confirmed',
    greeting: 'Hi {{customerName}},',
    confirmationText: 'Your appointment has been successfully confirmed!',
    zoomText: 'Join Zoom',
    addToCalendarText: 'Add to Calendar',
    cancelText: 'Cancel Appointment',
  },
  fr: {
    subject: '✅ Rendez-vous confirmé',
    greeting: 'Bonjour {{customerName}},',
    confirmationText: 'Votre rendez-vous a été confirmé avec succès!',
    zoomText: 'Rejoindre Zoom',
    addToCalendarText: 'Ajouter au calendrier',
    cancelText: 'Annuler rendez-vous',
  },
  ca: {
    subject: '✅ Cita confirmada',
    greeting: 'Hola {{customerName}},',
    confirmationText: 'La teva cita ha estat confirmada amb èxit!',
    zoomText: 'Entrar a Zoom',
    addToCalendarText: 'Afegir al calendari',
    cancelText: 'Cancelar cita',
  },
  pt: {
    subject: '✅ Consulta confirmada',
    greeting: 'Olá {{customerName}},',
    confirmationText: 'Sua consulta foi confirmada com sucesso!',
    zoomText: 'Entrar no Zoom',
    addToCalendarText: 'Adicionar ao calendário',
    cancelText: 'Cancelar consulta',
  },
}

export async function sendAppointmentConfirmationEmail(params: SendConfirmationEmailParams): Promise<boolean> {
  try {
    const {
      to,
      customerName,
      appointmentType,
      appointmentDate,
      appointmentTime,
      startTime,
      endTime,
      timezone,
      zoomLink,
      googleCalendarLink,
      cancellationLink,
      language = 'en',
      smtpConfig,
    } = params

    // Get template for language (fallback to English)
    const template = EMAIL_TEMPLATES[language] || EMAIL_TEMPLATES.en

    // Generate ICS file
    const icsContent = generateIcs({
      summary: `${appointmentType} - ${customerName}`,
      description: zoomLink
        ? `${appointmentType}\n\nZoom: ${zoomLink}`
        : appointmentType,
      startTime,
      endTime,
      timezone,
      attendeeEmail: to,
      organizerEmail: smtpConfig?.from || 'noreply@echatbot.ai',
    })

    // Build email HTML
    const subject = template.subject
    const greeting = template.greeting.replace('{{customerName}}', customerName)

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .container { background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
        .details { background: #f0f4ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .details-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .details-label { font-weight: bold; color: #667eea; }
        .links { margin: 25px 0; }
        .link-button { display: inline-block; margin: 10px 10px 10px 0; padding: 12px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
        .link-button:hover { background: #764ba2; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>✅</h2>
            <p style="margin: 0; font-size: 18px;">${subject}</p>
        </div>
        <div class="content">
            <p>${greeting}</p>
            <p>${template.confirmationText}</p>

            <div class="details">
                <div class="details-row">
                    <span class="details-label">📋 ${appointmentType}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">📅 ${appointmentDate}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">🕐 ${appointmentTime}</span>
                </div>
            </div>

            <div class="links">
                ${zoomLink ? `<a href="${zoomLink}" class="link-button">🔗 ${template.zoomText}</a>` : ''}
                ${googleCalendarLink ? `<a href="${googleCalendarLink}" class="link-button">📅 ${template.addToCalendarText}</a>` : ''}
                ${cancellationLink ? `<a href="${cancellationLink}" class="link-button" style="background: #dc3545;">❌ ${template.cancelText}</a>` : ''}
            </div>
        </div>
        <div class="footer">
            <p>© eChat Bot — Your Virtual Assistant</p>
        </div>
    </div>
</body>
</html>
    `

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig?.host || process.env.SMTP_HOST,
      port: smtpConfig?.port || parseInt(process.env.SMTP_PORT || '465'),
      secure: smtpConfig?.secure !== false, // Default true
      auth: {
        user: smtpConfig?.user || process.env.SMTP_USER,
        pass: smtpConfig?.pass || process.env.SMTP_PASS,
      },
    })

    // Send email with ICS attachment
    await transporter.sendMail({
      from: smtpConfig?.from || process.env.SMTP_FROM || 'noreply@echatbot.ai',
      to,
      subject,
      html: htmlContent,
      text: `${greeting} ${template.confirmationText} ${appointmentType} on ${appointmentDate} at ${appointmentTime}.`,
      attachments: [
        {
          filename: `appointment.ics`,
          content: icsContent,
          contentType: 'text/calendar; method=REQUEST',
        },
      ],
    })

    logger.info(`[APPOINTMENT-EMAIL] Confirmation email sent to ${to} for ${appointmentType}`)
    return true
  } catch (error) {
    logger.error(`[APPOINTMENT-EMAIL] Failed to send confirmation email:`, error)
    return false
  }
}
