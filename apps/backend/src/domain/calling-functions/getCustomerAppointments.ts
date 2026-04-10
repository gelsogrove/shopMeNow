/**
 * getCustomerAppointments - LLM-Callable Function
 *
 * Returns a customer's upcoming confirmed appointments.
 * Used by LLM to show current bookings before cancel or when customer asks.
 *
 * Called when: customer asks "my appointments", "i miei appuntamenti", "when is my next appointment?"
 * Guard: workspace.enableCalendarBooking must be true
 */

import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"
import { AppointmentService } from "../../application/services/appointment.service"

export interface GetCustomerAppointmentsRequest {
  workspaceId: string
  customerId: string
}

export interface GetCustomerAppointmentsResult {
  success: boolean
  message: string
  appointments?: Array<{
    id: string
    serviceName: string
    startTime: string
    endTime: string
    displayDate: string
    displayTime: string
    status: string
  }>
  totalCount?: number
  error?: string
  timestamp: string
}

export async function getCustomerAppointments(
  request: GetCustomerAppointmentsRequest
): Promise<GetCustomerAppointmentsResult> {
  try {
    logger.info("📅 getCustomerAppointments called:", {
      workspaceId: request.workspaceId,
      customerId: request.customerId,
    })

    if (!request.workspaceId || !request.customerId) {
      return {
        success: false,
        message: "Missing required parameters",
        error: "workspaceId and customerId are required",
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

    const appointmentService = new AppointmentService(prisma)
    const appointments = await appointmentService.getCustomerAppointments(
      request.workspaceId,
      request.customerId
    )

    if (appointments.length === 0) {
      return {
        success: true,
        message: "No upcoming appointments found",
        appointments: [],
        totalCount: 0,
        timestamp: new Date().toISOString(),
      }
    }

    return {
      success: true,
      message: `Found ${appointments.length} upcoming appointment(s)`,
      appointments: appointments.map(appt => {
        const start = new Date(appt.startTime)
        const end = new Date(appt.endTime)
        return {
          id: appt.id,
          serviceName: appt.service?.name || 'Unknown',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          displayDate: start.toISOString().split('T')[0], // YYYY-MM-DD — LLM formats in customer's language
          displayTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')} - ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
          status: appt.status,
        }
      }),
      totalCount: appointments.length,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    logger.error("❌ getCustomerAppointments failed:", error)
    return {
      success: false,
      message: "Failed to retrieve appointments",
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  }
}
