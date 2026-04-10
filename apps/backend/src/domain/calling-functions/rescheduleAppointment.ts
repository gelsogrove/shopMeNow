/**
 * rescheduleAppointment - LLM-Callable Function
 *
 * Reschedules an existing confirmed appointment to a new time slot.
 * Atomically cancels the old appointment and books the new one.
 *
 * Called when: customer says "sposta appuntamento", "cambia orario", "reschedule"
 * Guard: workspace.enableCalendarBooking must be true
 * Guard: new slot must be available
 * Guard: appointment must belong to the requesting customer
 */

import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"
import { AppointmentService } from "../../application/services/appointment.service"
import { googleCalendarService } from "../../services/google-calendar.service"

export interface RescheduleAppointmentRequest {
  workspaceId: string
  customerId: string
  appointmentId: string      // existing confirmed appointment to cancel
  newStartTime: string       // ISO 8601 — new desired slot
  reason?: string
}

export interface RescheduleAppointmentResult {
  success: boolean
  message: string
  oldAppointmentId?: string
  newAppointmentId?: string
  serviceName?: string
  oldStartTime?: string
  newStartTime?: string
  newDisplayDate?: string
  newDisplayTime?: string
  error?: string
  timestamp: string
}

export async function rescheduleAppointment(
  request: RescheduleAppointmentRequest
): Promise<RescheduleAppointmentResult> {
  try {
    logger.info("📅 rescheduleAppointment called:", {
      workspaceId: request.workspaceId,
      customerId: request.customerId,
      appointmentId: request.appointmentId,
      newStartTime: request.newStartTime,
    })

    if (!request.workspaceId || !request.customerId || !request.appointmentId || !request.newStartTime) {
      return {
        success: false,
        message: "Missing required parameters",
        error: "workspaceId, customerId, appointmentId, and newStartTime are required",
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

    // Verify appointment belongs to this customer and is confirmed
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        id: request.appointmentId,
        workspaceId: request.workspaceId,
        customerId: request.customerId,
        status: "confirmed",
      },
      include: { service: true },
    })

    if (!existingAppointment) {
      return {
        success: false,
        message: "Appointment not found or already cancelled",
        error: "APPOINTMENT_NOT_FOUND",
        timestamp: new Date().toISOString(),
      }
    }

    const newStartDt = new Date(request.newStartTime)

    // Validate new slot doesn't overlap with the *old* appointment (same slot = no-op)
    if (existingAppointment.startTime.getTime() === newStartDt.getTime()) {
      return {
        success: false,
        message: "The new time is the same as the current appointment time",
        error: "SAME_SLOT",
        timestamp: new Date().toISOString(),
      }
    }

    const appointmentService = new AppointmentService(prisma)

    // Check new slot availability (excluding the current appointment's slot)
    const availability = await appointmentService.isSlotAvailable(
      request.workspaceId,
      newStartDt,
      existingAppointment.service!.duration,
      request.appointmentId // exclude current appointment from conflict check
    )

    if (!availability.available) {
      return {
        success: false,
        message: `The requested time slot is not available: ${availability.reason}`,
        error: "SLOT_UNAVAILABLE",
        timestamp: new Date().toISOString(),
      }
    }

    // Atomic operation: cancel old, create new
    const [, newAppointment] = await prisma.$transaction(async (tx) => {
      // Cancel the old appointment
      const cancelled = await tx.appointment.update({
        where: { id: request.appointmentId },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: request.reason || "Rescheduled by customer",
          cancelledBy: "customer",
        },
      })

      // Calculate new end time
      const durationMs = (existingAppointment.service!.duration +
        (existingAppointment.service!.bufferTime || 0)) * 60 * 1000
      const newEndTime = new Date(newStartDt.getTime() + durationMs)

      // Create new appointment (copy customer snapshot + same type)
      const created = await tx.appointment.create({
        data: {
          workspaceId: request.workspaceId,
          customerId: request.customerId,
          serviceId: existingAppointment.serviceId,
          startTime: newStartDt,
          endTime: newEndTime,
          status: "confirmed",
          customerName: existingAppointment.customerName,
          customerPhone: existingAppointment.customerPhone,
          customerEmail: existingAppointment.customerEmail,
          customerNotes: existingAppointment.customerNotes,
          bookedVia: existingAppointment.bookedVia,
        },
        include: { service: true },
      })

      return [cancelled, created]
    })

    const displayDate = newStartDt.toISOString().split("T")[0]
    const endDt = newAppointment.endTime
    const displayTime = `${String(newStartDt.getHours()).padStart(2, "0")}:${String(newStartDt.getMinutes()).padStart(2, "0")} - ${String(endDt.getHours()).padStart(2, "0")}:${String(endDt.getMinutes()).padStart(2, "0")}`

    // Google Calendar sync: delete old event + create new one (non-blocking)
    if (existingAppointment.googleEventId) {
      await googleCalendarService.deleteEvent(request.workspaceId, existingAppointment.googleEventId)
      logger.info(`[GCAL] Deleted old event ${existingAppointment.googleEventId} for reschedule`)
    }

    const gcalResult = await googleCalendarService.createEvent({
      workspaceId: request.workspaceId,
      summary: `${existingAppointment.service?.name || 'Appointment'} - ${existingAppointment.customerName || 'Customer'}`,
      startTime: newStartDt,
      endTime: endDt,
      timezone: workspace?.timezone || 'Europe/Rome',
      attendeeEmail: existingAppointment.customerEmail || undefined,
    })

    if (gcalResult) {
      await prisma.appointment.update({
        where: { id: newAppointment.id },
        data: {
          googleEventId: gcalResult.googleEventId,
          googleEventLink: gcalResult.googleEventLink,
          googleCalendarId: gcalResult.googleCalendarId,
        },
      })
      logger.info(`[GCAL] Linked new event ${gcalResult.googleEventId} to rescheduled appointment ${newAppointment.id}`)
    }

    logger.info(`✅ Appointment rescheduled: ${request.appointmentId} → ${newAppointment.id}`)

    return {
      success: true,
      message: `Appointment rescheduled to ${displayDate} at ${displayTime}`,
      oldAppointmentId: request.appointmentId,
      newAppointmentId: newAppointment.id,
      serviceName: existingAppointment.service?.name,
      oldStartTime: existingAppointment.startTime.toISOString(),
      newStartTime: newStartDt.toISOString(),
      newDisplayDate: displayDate,
      newDisplayTime: displayTime,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    logger.error("❌ rescheduleAppointment failed:", error)

    if (error.message?.includes("no longer available") || error.message?.includes("SLOT_UNAVAILABLE")) {
      return {
        success: false,
        message: "This time slot is no longer available. Please choose another.",
        error: "SLOT_UNAVAILABLE",
        timestamp: new Date().toISOString(),
      }
    }

    return {
      success: false,
      message: "Failed to reschedule appointment",
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  }
}
