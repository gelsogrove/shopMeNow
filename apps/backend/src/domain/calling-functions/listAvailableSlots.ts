/**
 * listAvailableSlots - LLM-Callable Function
 *
 * Returns available time slots for a given appointment type.
 * The LLM shows these slots to the customer so they can pick one.
 *
 * Called when: customer asks "when can I book?", "available times?", "prenota appuntamento"
 * Guard: workspace.enableCalendarBooking must be true
 */

import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"
import { AppointmentService } from "../../application/services/appointment.service"

export interface ListAvailableSlotsRequest {
  workspaceId: string
  customerId: string
  serviceId?: string // If not provided, use first active bookable service
  daysAhead?: number // Default 7
  targetDate?: string // ISO date "YYYY-MM-DD" — filter to this specific day only (e.g., customer says "show me Tuesday")
}

export interface ListAvailableSlotsResult {
  success: boolean
  message: string
  serviceName?: string
  duration?: number
  price?: number
  slots?: Array<{
    startTime: string
    endTime: string
    displayDate: string
    displayTime: string
  }>
  totalSlots?: number
  hasMore?: boolean // true when more than 3 slots exist — LLM always shows option 4 "next day"
  error?: string
  timestamp: string
}

export async function listAvailableSlots(
  request: ListAvailableSlotsRequest
): Promise<ListAvailableSlotsResult> {
  try {
    logger.info("📅 listAvailableSlots called:", {
      workspaceId: request.workspaceId,
      customerId: request.customerId,
      serviceId: request.serviceId,
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

    // Resolve bookable service
    let serviceId = request.serviceId
    if (!serviceId) {
      const services = await appointmentService.getBookableServices(request.workspaceId)
      if (services.length === 0) {
        return {
          success: false,
          message: "No bookable services configured",
          error: "NO_BOOKABLE_SERVICES",
          timestamp: new Date().toISOString(),
        }
      }
      serviceId = services[0].id
    }

    const service = await appointmentService.getBookableService(
      request.workspaceId,
      serviceId
    )

    // Calculate date range — if targetDate provided, search only that day
    let startDate: Date
    let endDate: Date
    const daysAhead = request.daysAhead || 7

    if (request.targetDate) {
      // targetDate is "YYYY-MM-DD" — search from start of that day to end of that day
      startDate = new Date(request.targetDate + "T00:00:00")
      endDate = new Date(request.targetDate + "T23:59:59")
    } else {
      startDate = new Date()
      endDate = new Date(startDate.getTime() + daysAhead * 24 * 60 * 60 * 1000)
    }

    const slots = await appointmentService.getAvailableSlots(
      request.workspaceId,
      serviceId,
      startDate,
      endDate
    )

    if (slots.length === 0) {
      return {
        success: true,
        message: "No available slots found in the next " + daysAhead + " days",
        serviceName: service.name,
        duration: service.duration,
        price: service.price ? Number(service.price) : undefined,
        slots: [],
        totalSlots: 0,
        timestamp: new Date().toISOString(),
      }
    }

    // Return max 3 slots — LLM will show them as options 1/2/3 plus option 4 "next day"
    const displaySlots = slots.slice(0, 3)

    return {
      success: true,
      message: `Found ${slots.length} available slots for "${service.name}" (showing first 3)`,
      serviceName: service.name,
      duration: service.duration,
      price: service.price ? Number(service.price) : undefined,
      slots: displaySlots.map(s => ({
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        displayDate: s.displayDate,
        displayTime: s.displayTime,
      })),
      totalSlots: slots.length,
      hasMore: slots.length > 3, // hint to LLM that option 4 (next day) is always shown
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    logger.error("❌ listAvailableSlots failed:", error)
    return {
      success: false,
      message: "Failed to retrieve available slots",
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  }
}
