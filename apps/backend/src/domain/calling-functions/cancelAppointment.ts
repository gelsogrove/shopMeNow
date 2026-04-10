/**
 * cancelAppointment - LLM-Callable Function
 *
 * Cancels an existing confirmed appointment for a customer.
 * The LLM should show upcoming appointments first so the customer can choose which to cancel.
 *
 * Called when: customer says "cancel my appointment", "annulla appuntamento"
 * Guard: workspace.enableCalendarBooking must be true
 */

import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"
import { AppointmentService } from "../../application/services/appointment.service"
import { googleCalendarService } from "../../services/google-calendar.service"

export interface CancelAppointmentRequest {
  workspaceId: string
  customerId: string
  appointmentId: string
  reason?: string
}

export interface CancelAppointmentResult {
  success: boolean
  message: string
  appointmentId?: string
  appointmentTypeName?: string
  wasStartTime?: string
  error?: string
  timestamp: string
}

export async function cancelAppointment(
  request: CancelAppointmentRequest
): Promise<CancelAppointmentResult> {
  try {
    logger.info("📅 cancelAppointment called:", {
      workspaceId: request.workspaceId,
      customerId: request.customerId,
      appointmentId: request.appointmentId,
    })

    if (!request.workspaceId || !request.customerId || !request.appointmentId) {
      return {
        success: false,
        message: "Missing required parameters",
        error: "workspaceId, customerId, and appointmentId are required",
        timestamp: new Date().toISOString(),
      }
    }

    // Check workspace has calendar enabled
    const workspace = await prisma.workspace.findUnique({
      where: { id: request.workspaceId },
      select: { enableCalendarBooking: true },
    })

    if (!workspace?.enableCalendarBooking) {
      return {
        success: false,
        message: "Calendar booking is not enabled for this workspace",
        error: "CALENDAR_NOT_ENABLED",
        timestamp: new Date().toISOString(),
      }
    }

    // Verify appointment belongs to customer
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: request.appointmentId,
        workspaceId: request.workspaceId,
        customerId: request.customerId,
        status: 'confirmed',
      },
      include: { appointmentType: true },
    })

    if (!appointment) {
      return {
        success: false,
        message: "Appointment not found or already cancelled",
        error: "APPOINTMENT_NOT_FOUND",
        timestamp: new Date().toISOString(),
      }
    }

    // Track late cancellation (< 24h before appointment)
    const hoursUntilAppointment = (appointment.startTime.getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntilAppointment < 24 && hoursUntilAppointment > 0) {
      await prisma.lateCancellationAttempt.create({
        data: {
          workspaceId: request.workspaceId,
          customerId: request.customerId,
          appointmentTypeId: appointment.appointmentTypeId,
          scheduledStartTime: appointment.startTime,
          tooLateThreshold: 24,
        },
      }).catch(err => logger.warn("Failed to log late cancellation:", err))
    }

    const appointmentService = new AppointmentService(prisma)
    const cancelled = await appointmentService.cancelAppointment(
      request.workspaceId,
      request.appointmentId,
      request.reason,
      'customer'
    )

    // Delete Google Calendar event if linked (non-blocking)
    if (appointment.googleEventId) {
      await googleCalendarService.deleteEvent(request.workspaceId, appointment.googleEventId)
      logger.info(`[GCAL] Deleted event ${appointment.googleEventId} for cancelled appointment ${request.appointmentId}`)
    }

    logger.info(`✅ Appointment cancelled: ${request.appointmentId}`)

    return {
      success: true,
      message: `Appointment "${cancelled.appointmentType?.name}" cancelled successfully`,
      appointmentId: cancelled.id,
      appointmentTypeName: cancelled.appointmentType?.name,
      wasStartTime: appointment.startTime.toISOString(),
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    logger.error("❌ cancelAppointment failed:", error)
    return {
      success: false,
      message: "Failed to cancel appointment",
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  }
}
