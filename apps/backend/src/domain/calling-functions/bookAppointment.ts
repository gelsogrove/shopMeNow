/**
 * bookAppointment - LLM-Callable Function
 *
 * Creates a confirmed appointment booking after customer selects a slot.
 * The LLM must have first shown available slots via listAvailableSlots().
 *
 * Called when: customer confirms "yes, book the 3pm slot", "prenota alle 15:00"
 * Guard: workspace.enableCalendarBooking must be true
 */

import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"
import { AppointmentService } from "../../application/services/appointment.service"
import { googleCalendarService } from "../../services/google-calendar.service"

export interface BookAppointmentRequest {
  workspaceId: string
  customerId: string
  serviceId: string
  startTime: string // ISO 8601 from LLM
  customerNotes?: string
  channel?: string // "whatsapp" | "widget"
}

export interface BookAppointmentResult {
  success: boolean
  message: string
  appointmentId?: string
  serviceName?: string
  startTime?: string
  endTime?: string
  displayDate?: string
  displayTime?: string
  error?: string
  timestamp: string
}

export async function bookAppointment(
  request: BookAppointmentRequest
): Promise<BookAppointmentResult> {
  try {
    logger.info("📅 bookAppointment called:", {
      workspaceId: request.workspaceId,
      customerId: request.customerId,
      serviceId: request.serviceId,
      startTime: request.startTime,
    })

    if (!request.workspaceId || !request.customerId || !request.serviceId || !request.startTime) {
      return {
        success: false,
        message: "Missing required parameters",
        error: "workspaceId, customerId, serviceId, and startTime are required",
        timestamp: new Date().toISOString(),
      }
    }

    // Check workspace has calendar enabled
    const workspace = await prisma.workspace.findUnique({
      where: { id: request.workspaceId },
      select: { enableCalendarBooking: true, timezone: true },
    })

    if (!workspace?.enableCalendarBooking) {
      return {
        success: false,
        message: "Calendar booking is not enabled for this workspace",
        error: "CALENDAR_NOT_ENABLED",
        timestamp: new Date().toISOString(),
      }
    }

    // Get customer info for snapshot
    const customer = await prisma.customers.findFirst({
      where: { id: request.customerId, workspaceId: request.workspaceId },
      select: { name: true, phone: true, email: true, registrationStatus: true },
    })

    // Registration guard: customer must be registered (ACTIVE) to book appointments
    // Without registration we don't have name/email for the calendar entry
    if (!customer || customer.registrationStatus !== 'ACTIVE') {
      return {
        success: false,
        message: "Customer must be registered before booking an appointment. Please ask them to register first using the registration link.",
        error: "CUSTOMER_NOT_REGISTERED",
        timestamp: new Date().toISOString(),
      }
    }

    const appointmentService = new AppointmentService(prisma)

    const appointment = await appointmentService.createAppointment(request.workspaceId, {
      customerId: request.customerId,
      serviceId: request.serviceId,
      startTime: new Date(request.startTime),
      customerNotes: request.customerNotes,
      customerName: customer?.name || undefined,
      customerPhone: customer?.phone || undefined,
      customerEmail: customer?.email || undefined,
      bookedVia: request.channel || 'whatsapp',
    })

    // Format display strings — use ISO format, LLM will format in customer's language
    const startDt = new Date(request.startTime)
    const endDt = appointment.endTime
    const displayDate = startDt.toISOString().split('T')[0] // YYYY-MM-DD
    const displayTime = `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')} - ${String(endDt.getHours()).padStart(2, '0')}:${String(endDt.getMinutes()).padStart(2, '0')}`

    // Sync to Google Calendar (non-blocking: booking succeeds even if GCal fails)
    const gcalResult = await googleCalendarService.createEvent({
      workspaceId: request.workspaceId,
      summary: `${appointment.service?.name || 'Appointment'} - ${customer.name || 'Customer'}`,
      startTime: startDt,
      endTime: endDt,
      timezone: workspace?.timezone || 'Europe/Rome',
      attendeeEmail: customer.email || undefined,
    })

    if (gcalResult) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          googleEventId: gcalResult.googleEventId,
          googleEventLink: gcalResult.googleEventLink,
          googleCalendarId: gcalResult.googleCalendarId,
        },
      })
      logger.info(`[GCAL] Linked event ${gcalResult.googleEventId} to appointment ${appointment.id}`)
    }

    logger.info(`✅ Appointment booked: ${appointment.id} for ${request.customerId}`)

    return {
      success: true,
      message: `Appointment booked for ${displayDate} at ${displayTime}`,
      appointmentId: appointment.id,
      serviceName: appointment.service?.name,
      startTime: startDt.toISOString(),
      endTime: endDt.toISOString(),
      displayDate,
      displayTime,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    logger.error("❌ bookAppointment failed:", error)

    // Specific error handling
    if (error.message?.includes('no longer available')) {
      return {
        success: false,
        message: "This time slot is no longer available. Please choose another.",
        error: "SLOT_UNAVAILABLE",
        timestamp: new Date().toISOString(),
      }
    }

    return {
      success: false,
      message: "Failed to book appointment",
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  }
}
