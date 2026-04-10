/**
 * Appointment Reminder Job
 *
 * Runs every 15 minutes.
 * Sends 24h, 1h, and 30min reminder notifications for confirmed appointments.
 * Each reminder interval can be enabled/disabled independently in workspace settings.
 * 
 * Billing:
 * - WhatsApp reminders: €0.50 per reminder (billed to workspace owner)
 * - Email reminders: FREE
 * 
 * Channel detection:
 * - bookedVia === 'widget' → always email (free, widget can't send WhatsApp)
 * - bookedVia === 'whatsapp' → use workspace.appointmentReminderChannel
 * 
 * 🤖 Customer Response Handling:
 * When customer replies to reminder (e.g., "NO", "non posso venire", "sì confermo"):
 * - LLM Router Agent automatically detects intent (NO hardcoded phrase detection)
 * - If customer declines/cancels → LLM calls cancelAppointment() calling function
 * - If customer confirms → LLM acknowledges confirmation
 * - No explicit "confirmReminderResponse" function needed - Router handles it via intent
 * 
 * Template Variables (3 separate templates for each interval):
 * - {{customerName}} - Customer's name
 * - {{appointmentType}} - Type of appointment (from service name, e.g., "Pulizia denti")
 * - {{appointmentDate}} - Formatted date (e.g., "lunedì 8 aprile")
 * - {{appointmentTime}} - Formatted time (e.g., "10:30")
 */

import { prisma, Prisma } from '../config/database'
import logger from '../utils/logger'
import nodemailer from 'nodemailer'

const REMINDER_COST_WHATSAPP = 0.50 // $0.50 per WhatsApp reminder
const REMINDER_COST_EMAIL = 0.00 // Free for email

// Email transporter for appointment reminders
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

async function sendAppointmentReminderEmail(
  to: string,
  customerName: string,
  appointmentType: string,
  appointmentDate: string,
  appointmentTime: string,
  reminderType: '24h' | '1h' | '30m',
  message: string
): Promise<boolean> {
  try {
    const transporter = createEmailTransporter()

    const reminderLabel = reminderType === '24h' ? '24 Hours' : reminderType === '1h' ? '1 Hour' : '30 Minutes'

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .container { background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
        .content { background: white; padding: 20px; border-radius: 8px; }
        .appointment-details { background: #f0f4ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>⏰ Appointment Reminder</h2>
        </div>
        <div class="content">
            <p>Hello ${customerName},</p>
            <p>This is a reminder that your appointment is coming up:</p>

            <div class="appointment-details">
                <p><strong>Type:</strong> ${appointmentType}</p>
                <p><strong>Date:</strong> ${appointmentDate}</p>
                <p><strong>Time:</strong> ${appointmentTime}</p>
            </div>

            <p>${message}</p>

            <p>If you need to reschedule or cancel, please let us know as soon as possible.</p>

            <p>See you there!</p>
        </div>
        <div class="footer">
            <p>This is an automated reminder email. Please do not reply to this message.</p>
        </div>
    </div>
</body>
</html>
    `

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@echatbot.ai',
      to,
      subject: `⏰ ${reminderLabel} Appointment Reminder - ${appointmentType}`,
      html: htmlContent,
      text: message,
    })

    logger.info(`[APPOINTMENT-REMINDER] Email ${reminderType} reminder sent to ${to} for appointment: ${appointmentType}`)
    return true
  } catch (error) {
    logger.error(`[APPOINTMENT-REMINDER] Failed to send email reminder to ${to}:`, error)
    return false
  }
}

export async function appointmentReminderJob(): Promise<void> {
  const now = new Date()

  logger.info('[APPOINTMENT-REMINDER] Starting job')

  try {
    let totalProcessed = 0

    // ============================================
    // 24-HOUR REMINDERS
    // ============================================
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const twentyThreeHoursFromNow = new Date(now.getTime() + 23 * 60 * 60 * 1000)

    const appointments24h = await prisma.appointment.findMany({
      where: {
        status: 'confirmed',
        reminder24hSentAt: null,
        startTime: {
          gte: twentyThreeHoursFromNow,
          lte: twentyFourHoursFromNow,
        },
        workspace: { 
          enableCalendarBooking: true,
          appointmentReminder24hEnabled: true // Only if 24h reminder is enabled
        },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            appointmentReminder24hMessage: true,
            appointmentReminderChannel: true,
            ownerId: true,
          },
        },
        service: true,
        customer: {
          select: {
            id: true,
            phone: true,
            email: true,
            name: true,
            language: true,
          },
        },
      },
    })

    if (appointments24h.length > 0) {
      logger.info(`[APPOINTMENT-REMINDER] Found ${appointments24h.length} appointments needing 24h reminder`)
      for (const appointment of appointments24h) {
        await processReminder(appointment, '24h')
      }
      totalProcessed += appointments24h.length
    }

    // ============================================
    // 1-HOUR REMINDERS
    // ============================================
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
    const fiftyMinutesFromNow = new Date(now.getTime() + 50 * 60 * 1000)

    const appointments1h = await prisma.appointment.findMany({
      where: {
        status: 'confirmed',
        reminder1hSentAt: null,
        startTime: {
          gte: fiftyMinutesFromNow,
          lte: oneHourFromNow,
        },
        workspace: { 
          enableCalendarBooking: true,
          appointmentReminder1hEnabled: true // Only if 1h reminder is enabled
        },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            appointmentReminder1hMessage: true,
            appointmentReminderChannel: true,
            ownerId: true,
          },
        },
        service: true,
        customer: {
          select: {
            id: true,
            phone: true,
            email: true,
            name: true,
            language: true,
          },
        },
      },
    })

    if (appointments1h.length > 0) {
      logger.info(`[APPOINTMENT-REMINDER] Found ${appointments1h.length} appointments needing 1h reminder`)
      for (const appointment of appointments1h) {
        await processReminder(appointment, '1h')
      }
      totalProcessed += appointments1h.length
    }

    // ============================================
    // 30-MINUTE REMINDERS
    // ============================================
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000)
    const twentyFiveMinutesFromNow = new Date(now.getTime() + 25 * 60 * 1000)

    const appointments30m = await prisma.appointment.findMany({
      where: {
        status: 'confirmed',
        reminder30mSentAt: null,
        startTime: {
          gte: twentyFiveMinutesFromNow,
          lte: thirtyMinutesFromNow,
        },
        workspace: { 
          enableCalendarBooking: true,
          appointmentReminder30mEnabled: true // Only if 30m reminder is enabled
        },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            appointmentReminder30mMessage: true,
            appointmentReminderChannel: true,
            ownerId: true,
          },
        },
        service: true,
        customer: {
          select: {
            id: true,
            phone: true,
            email: true,
            name: true,
            language: true,
          },
        },
      },
    })

    if (appointments30m.length > 0) {
      logger.info(`[APPOINTMENT-REMINDER] Found ${appointments30m.length} appointments needing 30m reminder`)
      for (const appointment of appointments30m) {
        await processReminder(appointment, '30m')
      }
      totalProcessed += appointments30m.length
    }

    if (totalProcessed > 0) {
      logger.info(`[APPOINTMENT-REMINDER] Completed. Processed ${totalProcessed} reminders`)
    }
  } catch (error) {
    logger.error('[APPOINTMENT-REMINDER] Job failed:', error)
  }
}

async function processReminder(
  appointment: any,
  reminderType: '24h' | '1h' | '30m'
): Promise<void> {
  try {
    // Prevent duplicate processing using ReminderLock
    const lockKey = `reminder-${reminderType}-${appointment.id}`
    const existingLock = await prisma.reminderLock.findUnique({
      where: { lockKey },
    })

    if (existingLock) {
      logger.warn(`[APPOINTMENT-REMINDER] Lock exists for ${lockKey}, skipping`)
      return
    }

    // Acquire lock
    await prisma.reminderLock.create({
      data: {
        lockKey,
        appointmentId: appointment.id,
        workspaceId: appointment.workspaceId,
        reminderType,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h expiry
      },
    }).catch(() => {
      // Lock already exists (race condition)
      return
    })

    // Determine reminder channel
    const channel = resolveReminderChannel(appointment)
    const message = buildReminderMessage(appointment, reminderType)

    let billedAmount = 0

    if (channel === 'whatsapp' && appointment.customer?.phone) {
      // Enqueue WhatsApp message
      await prisma.whatsAppQueue.create({
        data: {
          workspaceId: appointment.workspaceId,
          customerId: appointment.customer.id,
          phoneNumber: appointment.customer.phone,
          messageContent: message,
        },
      })

      billedAmount = REMINDER_COST_WHATSAPP

      // Bill the workspace owner
      await billReminder(appointment.workspace, billedAmount, appointment.id, reminderType)

      logger.info(`[APPOINTMENT-REMINDER] WhatsApp ${reminderType} sent for appointment ${appointment.id} ($${billedAmount})`)
    } else if (channel === 'email' && appointment.customer?.email) {
      // Email reminder (free)
      const emailSent = await sendAppointmentReminderEmail(
        appointment.customer.email,
        appointment.customer.name || 'Customer',
        appointment.service?.name || 'Appointment',
        appointment.startTime.toLocaleDateString(getLocaleFromLanguage(appointment.customer?.language), {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        appointment.startTime.toLocaleTimeString(getLocaleFromLanguage(appointment.customer?.language), {
          hour: '2-digit',
          minute: '2-digit',
        }),
        reminderType,
        message
      )

      billedAmount = REMINDER_COST_EMAIL

      if (emailSent) {
        logger.info(`[APPOINTMENT-REMINDER] Email ${reminderType} sent for appointment ${appointment.id} (FREE)`)
      } else {
        logger.warn(`[APPOINTMENT-REMINDER] Failed to send email ${reminderType} for appointment ${appointment.id}`)
      }
    } else {
      logger.warn(`[APPOINTMENT-REMINDER] No valid channel for appointment ${appointment.id}`)
      return
    }

    // Update appointment with reminder sent timestamp
    const updateData: any = {
      reminderChannel: channel,
    }

    if (reminderType === '24h') {
      updateData.reminder24hSentAt = new Date()
    } else if (reminderType === '1h') {
      updateData.reminder1hSentAt = new Date()
    } else if (reminderType === '30m') {
      updateData.reminder30mSentAt = new Date()
    }

    if (billedAmount > 0) {
      updateData.reminderBilledAt = new Date()
      updateData.reminderBillingTotal = {
        increment: billedAmount,
      }
    }

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: updateData,
    })
  } catch (error) {
    logger.error(`[APPOINTMENT-REMINDER] Failed to process ${reminderType} reminder for appointment ${appointment.id}:`, error)
  }
}

function resolveReminderChannel(appointment: any): 'whatsapp' | 'email' {
  // Widget bookings always get email (widget can't send WhatsApp)
  if (appointment.bookedVia === 'widget') {
    return 'email'
  }

  // Use workspace preference
  const workspaceChannel = appointment.workspace?.appointmentReminderChannel || 'whatsapp'

  if (workspaceChannel === 'email') {
    return 'email'
  }

  if (workspaceChannel === 'both') {
    // For 'both', prefer WhatsApp if phone available, else email
    return appointment.customer?.phone ? 'whatsapp' : 'email'
  }

  // Default: WhatsApp
  return appointment.customer?.phone ? 'whatsapp' : 'email'
}

function getLocaleFromLanguage(language: string | null | undefined): string {
  const localeMap: Record<string, string> = {
    'it': 'it-IT',
    'en': 'en-US',
    'es': 'es-ES',
    'pt': 'pt-BR',
    'fr': 'fr-FR',
    'de': 'de-DE',
  }
  return localeMap[language || 'en'] || 'en-US'
}

function buildReminderMessage(appointment: any, reminderType: '24h' | '1h' | '30m'): string {
  const locale = getLocaleFromLanguage(appointment.customer?.language)
  
  // Select correct template based on reminder type
  let template: string | null = null
  if (reminderType === '24h') {
    template = appointment.workspace?.appointmentReminder24hMessage
  } else if (reminderType === '1h') {
    template = appointment.workspace?.appointmentReminder1hMessage
  } else if (reminderType === '30m') {
    template = appointment.workspace?.appointmentReminder30mMessage
  }

  if (template) {
    // Variable replacement
    // Available variables: {{customerName}}, {{appointmentType}}, {{appointmentDate}}, {{appointmentTime}}
    return template
      .replace(/\{\{customerName\}\}/g, appointment.customerName || appointment.customer?.name || '')
      .replace(/\{\{appointmentType\}\}/g, appointment.service?.name || 'Appointment')
      .replace(/\{\{appointmentDate\}\}/g, appointment.startTime.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }))
      .replace(/\{\{appointmentTime\}\}/g, appointment.startTime.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }))
  }

  // Default message (English fallback - workspace owner should configure reminder templates)
  const typeLabel = appointment.service?.name || 'appointment'
  const dateStr = appointment.startTime.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const timeStr = appointment.startTime.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
  
  let timeLabel = 'soon'
  if (reminderType === '24h') timeLabel = 'tomorrow'
  else if (reminderType === '1h') timeLabel = 'in 1 hour'
  else if (reminderType === '30m') timeLabel = 'in 30 minutes'

  return `⏰ Reminder: your ${typeLabel} is ${timeLabel}, ${dateStr} at ${timeStr}. See you there!`
}

async function billReminder(
  workspace: any,
  amount: number,
  appointmentId: string,
  reminderType: string
): Promise<void> {
  try {
    if (amount <= 0 || !workspace?.ownerId) return

    await prisma.$transaction(async (tx) => {
      // Get current balance
      const owner = await tx.user.findUnique({
        where: { id: workspace.ownerId },
        select: { creditBalance: true },
      })

      const currentBalance = owner?.creditBalance ? Number(owner.creditBalance) : 0
      const newBalance = currentBalance - amount

      // Deduct from owner's credit balance
      await tx.user.update({
        where: { id: workspace.ownerId },
        data: {
          creditBalance: {
            decrement: amount,
          },
        },
      })

      // Create billing transaction
      await tx.billingTransaction.create({
        data: {
          userId: workspace.ownerId,
          type: 'APPOINTMENT_REMINDER',
          amount: new Prisma.Decimal(-amount),
          balanceAfter: new Prisma.Decimal(newBalance),
          description: `Appointment ${reminderType} reminder (WhatsApp) - ${workspace.name}`,
          workspaceId: workspace.id,
          referenceType: 'APPOINTMENT_REMINDER',
          referenceId: appointmentId,
        },
      })
    })

    logger.info(`[APPOINTMENT-REMINDER] Billed €${amount.toFixed(2)} to owner ${workspace.ownerId}`)
  } catch (error) {
    logger.error(`[APPOINTMENT-REMINDER] Billing failed for appointment ${appointmentId}:`, error)
    // Don't throw - reminder was already sent, billing failure is non-critical
  }
}
