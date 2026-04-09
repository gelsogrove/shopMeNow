/**
 * Appointment Calling Functions - Unit Tests
 *
 * Tests cover all 4 LLM-callable appointment functions:
 * 1. listAvailableSlots - parameter validation, calendar guard, slot listing
 * 2. bookAppointment - parameter validation, calendar guard, booking, slot conflict
 * 3. cancelAppointment - parameter validation, ownership check, late cancellation tracking
 * 4. getCustomerAppointments - parameter validation, calendar guard, empty/non-empty results
 *
 * @see apps/backend/src/domain/calling-functions/listAvailableSlots.ts
 * @see apps/backend/src/domain/calling-functions/bookAppointment.ts
 * @see apps/backend/src/domain/calling-functions/cancelAppointment.ts
 * @see apps/backend/src/domain/calling-functions/getCustomerAppointments.ts
 */

// Mock logger FIRST
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}
jest.mock("../../../src/utils/logger", () => ({
  default: mockLogger,
  __esModule: true,
}))

// Mock AppointmentService
const mockAppointmentService = {
  getAvailableSlots: jest.fn(),
  getAppointmentTypes: jest.fn(),
  getAppointmentType: jest.fn(),
  createAppointment: jest.fn(),
  cancelAppointment: jest.fn(),
  getCustomerAppointments: jest.fn(),
  isSlotAvailable: jest.fn(),
}

jest.mock("../../../src/application/services/appointment.service", () => ({
  AppointmentService: jest.fn().mockImplementation(() => mockAppointmentService),
}))

// Mock Prisma
const mockPrisma = {
  workspace: {
    findUnique: jest.fn(),
  },
  customers: {
    findFirst: jest.fn(),
  },
  appointment: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  lateCancellationAttempt: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
}))

import { listAvailableSlots } from "../../../src/domain/calling-functions/listAvailableSlots"
import { bookAppointment } from "../../../src/domain/calling-functions/bookAppointment"
import { cancelAppointment } from "../../../src/domain/calling-functions/cancelAppointment"
import { getCustomerAppointments } from "../../../src/domain/calling-functions/getCustomerAppointments"
import { rescheduleAppointment } from "../../../src/domain/calling-functions/rescheduleAppointment"

const WORKSPACE_ID = "ws-test-123"
const CUSTOMER_ID = "cust-test-456"

describe("Appointment Calling Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // listAvailableSlots
  // ============================================

  describe("listAvailableSlots", () => {
    // RULE: Missing parameters should return error
    it("should return error when workspaceId is missing", async () => {
      const result = await listAvailableSlots({
        workspaceId: "",
        customerId: CUSTOMER_ID,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("required")
    })

    it("should return error when customerId is missing", async () => {
      const result = await listAvailableSlots({
        workspaceId: WORKSPACE_ID,
        customerId: "",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("required")
    })

    // RULE: Calendar must be enabled for workspace
    it("should return error when calendar is not enabled", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: false })

      const result = await listAvailableSlots({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("CALENDAR_NOT_ENABLED")
    })

    // SCENARIO: No appointment types configured
    it("should return error when no appointment types exist", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockAppointmentService.getAppointmentTypes.mockResolvedValue([])

      const result = await listAvailableSlots({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("NO_APPOINTMENT_TYPES")
    })

    // SCENARIO: Zero available slots in date range
    it("should return success with empty slots when none available", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockAppointmentService.getAppointmentTypes.mockResolvedValue([
        { id: "type-1", name: "Test", duration: 30, price: 50 },
      ])
      mockAppointmentService.getAppointmentType.mockResolvedValue({
        id: "type-1",
        name: "Consulenza",
        duration: 30,
        price: 50,
      })
      mockAppointmentService.getAvailableSlots.mockResolvedValue([])

      const result = await listAvailableSlots({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
      })

      expect(result.success).toBe(true)
      expect(result.slots).toEqual([])
      expect(result.totalSlots).toBe(0)
    })

    // SCENARIO: Slots found - returns formatted list
    it("should return available slots with display formatting", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockAppointmentService.getAppointmentTypes.mockResolvedValue([
        { id: "type-1", name: "Consulenza", duration: 60, price: 50 },
      ])
      mockAppointmentService.getAppointmentType.mockResolvedValue({
        id: "type-1",
        name: "Consulenza",
        duration: 60,
        price: 50,
      })

      const slots = [
        {
          startTime: new Date("2026-04-15T09:00:00"),
          endTime: new Date("2026-04-15T10:00:00"),
          displayDate: "mercoledì 15 aprile",
          displayTime: "09:00 - 10:00",
        },
        {
          startTime: new Date("2026-04-15T10:00:00"),
          endTime: new Date("2026-04-15T11:00:00"),
          displayDate: "mercoledì 15 aprile",
          displayTime: "10:00 - 11:00",
        },
      ]
      mockAppointmentService.getAvailableSlots.mockResolvedValue(slots)

      const result = await listAvailableSlots({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
      })

      expect(result.success).toBe(true)
      expect(result.totalSlots).toBe(2)
      expect(result.appointmentTypeName).toBe("Consulenza")
      expect(result.price).toBe(50)
    })
  })

  // ============================================
  // bookAppointment
  // ============================================

  describe("bookAppointment", () => {
    const bookRequest = {
      workspaceId: WORKSPACE_ID,
      customerId: CUSTOMER_ID,
      appointmentTypeId: "type-1",
      startTime: "2026-04-15T10:00:00.000Z",
      channel: "whatsapp",
    }

    // RULE: All required parameters must be provided
    it("should return error when appointmentTypeId is missing", async () => {
      const result = await bookAppointment({
        ...bookRequest,
        appointmentTypeId: "",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("required")
    })

    it("should return error when startTime is missing", async () => {
      const result = await bookAppointment({
        ...bookRequest,
        startTime: "",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("required")
    })

    // RULE: Calendar must be enabled
    it("should return error when calendar is not enabled", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: false })

      const result = await bookAppointment(bookRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe("CALENDAR_NOT_ENABLED")
    })

    // RULE: Customer must be registered (ACTIVE) to book appointments
    // Without registration we don't have name/email for the calendar entry
    it("should return CUSTOMER_NOT_REGISTERED when customer is not active", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockPrisma.customers.findFirst.mockResolvedValue({
        name: "Visitor",
        registrationStatus: "NEW",
      })

      const result = await bookAppointment(bookRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe("CUSTOMER_NOT_REGISTERED")
    })

    // SCENARIO: Customer not found at all
    it("should return CUSTOMER_NOT_REGISTERED when customer not found", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockPrisma.customers.findFirst.mockResolvedValue(null)

      const result = await bookAppointment(bookRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe("CUSTOMER_NOT_REGISTERED")
    })

    // SCENARIO: Successful booking
    it("should create appointment and return formatted response", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockPrisma.customers.findFirst.mockResolvedValue({
        name: "Mario Rossi",
        phone: "+393331234567",
        email: "mario@example.com",
        registrationStatus: "ACTIVE",
      })

      const mockAppointment = {
        id: "appt-new",
        startTime: new Date("2026-04-15T10:00:00"),
        endTime: new Date("2026-04-15T11:00:00"),
        status: "confirmed",
        appointmentType: { name: "Consulenza" },
      }
      mockAppointmentService.createAppointment.mockResolvedValue(mockAppointment)

      const result = await bookAppointment(bookRequest)

      expect(result.success).toBe(true)
      expect(result.appointmentId).toBe("appt-new")
      expect(result.appointmentTypeName).toBe("Consulenza")
      expect(result.displayDate).toBeDefined()
      expect(result.displayTime).toBeDefined()
    })

    // SCENARIO: Slot was taken between listing and booking (race condition)
    it("should return SLOT_UNAVAILABLE when slot is taken", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockPrisma.customers.findFirst.mockResolvedValue({ name: "Mario", registrationStatus: "ACTIVE" })
      mockAppointmentService.createAppointment.mockRejectedValue(
        new Error("Slot no longer available: Slot already booked")
      )

      const result = await bookAppointment(bookRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe("SLOT_UNAVAILABLE")
    })
  })

  // ============================================
  // cancelAppointment
  // ============================================

  describe("cancelAppointment", () => {
    const cancelRequest = {
      workspaceId: WORKSPACE_ID,
      customerId: CUSTOMER_ID,
      appointmentId: "appt-1",
      reason: "Changed plans",
    }

    // RULE: Parameter validation
    it("should return error when appointmentId is missing", async () => {
      const result = await cancelAppointment({
        ...cancelRequest,
        appointmentId: "",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("required")
    })

    // RULE: Calendar must be enabled
    it("should return error when calendar not enabled", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: false })

      const result = await cancelAppointment(cancelRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe("CALENDAR_NOT_ENABLED")
    })

    // RULE: Appointment must belong to the requesting customer (IDOR prevention)
    it("should return APPOINTMENT_NOT_FOUND when appointment doesn't belong to customer", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      // findFirst returns null because customerId doesn't match
      mockPrisma.appointment.findFirst.mockResolvedValue(null)

      const result = await cancelAppointment(cancelRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe("APPOINTMENT_NOT_FOUND")
    })

    // SCENARIO: Successful cancellation of appointment > 24h away
    it("should cancel appointment successfully", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })

      // Appointment is 48 hours away (no late cancellation)
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: "appt-1",
        customerId: CUSTOMER_ID,
        status: "confirmed",
        startTime: futureDate,
        appointmentTypeId: "type-1",
        appointmentType: { name: "Consulenza" },
      })

      mockAppointmentService.cancelAppointment.mockResolvedValue({
        id: "appt-1",
        status: "cancelled",
        appointmentType: { name: "Consulenza" },
      })

      const result = await cancelAppointment(cancelRequest)

      expect(result.success).toBe(true)
      expect(result.appointmentTypeName).toBe("Consulenza")
      // No late cancellation logged
      expect(mockPrisma.lateCancellationAttempt.create).not.toHaveBeenCalled()
    })

    // SCENARIO: Late cancellation (< 24h before appointment) should be tracked
    it("should log late cancellation when < 24h before appointment", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })

      // Appointment is 12 hours away
      const soonDate = new Date(Date.now() + 12 * 60 * 60 * 1000)
      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: "appt-1",
        customerId: CUSTOMER_ID,
        status: "confirmed",
        startTime: soonDate,
        appointmentTypeId: "type-1",
        appointmentType: { name: "Consulenza" },
      })
      mockPrisma.lateCancellationAttempt.create.mockResolvedValue({})

      mockAppointmentService.cancelAppointment.mockResolvedValue({
        id: "appt-1",
        status: "cancelled",
        appointmentType: { name: "Consulenza" },
      })

      const result = await cancelAppointment(cancelRequest)

      expect(result.success).toBe(true)
      // Late cancellation WAS logged
      expect(mockPrisma.lateCancellationAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            customerId: CUSTOMER_ID,
            appointmentTypeId: "type-1",
          }),
        })
      )
    })
  })

  // ============================================
  // getCustomerAppointments
  // ============================================

  describe("getCustomerAppointments", () => {
    // RULE: Parameter validation
    it("should return error when workspaceId is missing", async () => {
      const result = await getCustomerAppointments({
        workspaceId: "",
        customerId: CUSTOMER_ID,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("required")
    })

    // RULE: Calendar must be enabled
    it("should return error when calendar not enabled", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: false })

      const result = await getCustomerAppointments({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("CALENDAR_NOT_ENABLED")
    })

    // SCENARIO: Customer has no upcoming appointments
    it("should return empty list when no appointments", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockAppointmentService.getCustomerAppointments.mockResolvedValue([])

      const result = await getCustomerAppointments({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
      })

      expect(result.success).toBe(true)
      expect(result.totalCount).toBe(0)
      expect(result.appointments).toEqual([])
    })

    // SCENARIO: Customer has upcoming appointments
    it("should return formatted appointment list", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })

      const appointments = [
        {
          id: "appt-1",
          startTime: new Date("2026-04-20T10:00:00"),
          endTime: new Date("2026-04-20T11:00:00"),
          status: "confirmed",
          appointmentType: { name: "Consulenza" },
        },
        {
          id: "appt-2",
          startTime: new Date("2026-04-22T14:00:00"),
          endTime: new Date("2026-04-22T15:00:00"),
          status: "confirmed",
          appointmentType: { name: "Visita" },
        },
      ]
      mockAppointmentService.getCustomerAppointments.mockResolvedValue(appointments)

      const result = await getCustomerAppointments({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
      })

      expect(result.success).toBe(true)
      expect(result.totalCount).toBe(2)
      expect(result.appointments![0].appointmentTypeName).toBe("Consulenza")
      expect(result.appointments![1].appointmentTypeName).toBe("Visita")
      expect(result.appointments![0].displayDate).toBeDefined()
      expect(result.appointments![0].displayTime).toBeDefined()
    })
  })

  // ============================================
  // rescheduleAppointment
  // ============================================

  describe("rescheduleAppointment", () => {
    const futureTime = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h from now
    const newFutureTime = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72h from now

    const rescheduleRequest = {
      workspaceId: WORKSPACE_ID,
      customerId: CUSTOMER_ID,
      appointmentId: "appt-1",
      newStartTime: newFutureTime.toISOString(),
      reason: "Better timing",
    }

    const mockExistingAppointment = {
      id: "appt-1",
      workspaceId: WORKSPACE_ID,
      customerId: CUSTOMER_ID,
      appointmentTypeId: "type-1",
      startTime: futureTime,
      endTime: new Date(futureTime.getTime() + 30 * 60 * 1000),
      status: "confirmed",
      customerName: "Mario Rossi",
      customerPhone: "+39123456",
      customerEmail: "mario@test.com",
      customerNotes: "Note",
      bookedVia: "whatsapp",
      appointmentType: { id: "type-1", name: "Consulenza", duration: 30, bufferTime: 0 },
    }

    const mockNewAppointment = {
      id: "appt-new",
      workspaceId: WORKSPACE_ID,
      customerId: CUSTOMER_ID,
      appointmentTypeId: "type-1",
      startTime: newFutureTime,
      endTime: new Date(newFutureTime.getTime() + 30 * 60 * 1000),
      status: "confirmed",
      appointmentType: { id: "type-1", name: "Consulenza", duration: 30, bufferTime: 0 },
    }

    // RULE: Missing parameters should return error
    it("should return error when appointmentId is missing", async () => {
      const result = await rescheduleAppointment({
        ...rescheduleRequest,
        appointmentId: "",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("required")
    })

    it("should return error when newStartTime is missing", async () => {
      const result = await rescheduleAppointment({
        ...rescheduleRequest,
        newStartTime: "",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("required")
    })

    // RULE: Calendar must be enabled
    it("should return error when calendar not enabled", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: false })

      const result = await rescheduleAppointment(rescheduleRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe("CALENDAR_NOT_ENABLED")
    })

    // RULE: Appointment must belong to the requesting customer (IDOR prevention)
    it("should return APPOINTMENT_NOT_FOUND when appointment belongs to different customer", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockPrisma.appointment.findFirst.mockResolvedValue(null)

      const result = await rescheduleAppointment(rescheduleRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe("APPOINTMENT_NOT_FOUND")
    })

    // RULE: Cannot reschedule to the same time slot
    it("should return SAME_SLOT when newStartTime equals current startTime", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockExistingAppointment,
        startTime: new Date(rescheduleRequest.newStartTime),
      })

      const result = await rescheduleAppointment(rescheduleRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe("SAME_SLOT")
    })

    // RULE: New slot must be available
    it("should return SLOT_UNAVAILABLE when new slot is taken", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockPrisma.appointment.findFirst.mockResolvedValue(mockExistingAppointment)
      mockAppointmentService.isSlotAvailable = jest.fn().mockResolvedValue({
        available: false,
        reason: "Slot already booked",
      })

      const result = await rescheduleAppointment(rescheduleRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe("SLOT_UNAVAILABLE")
    })

    // SCENARIO: Successful reschedule — old cancelled, new created atomically
    it("should reschedule successfully: cancel old and create new in transaction", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ enableCalendarBooking: true })
      mockPrisma.appointment.findFirst.mockResolvedValue(mockExistingAppointment)
      mockAppointmentService.isSlotAvailable = jest.fn().mockResolvedValue({ available: true })

      // Mock $transaction to execute the callback
      mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => any) => {
        return await callback({
          appointment: {
            update: jest.fn().mockResolvedValue({ ...mockExistingAppointment, status: "cancelled" }),
            create: jest.fn().mockResolvedValue(mockNewAppointment),
          },
        })
      })

      const result = await rescheduleAppointment(rescheduleRequest)

      expect(result.success).toBe(true)
      expect(result.oldAppointmentId).toBe("appt-1")
      expect(result.appointmentTypeName).toBe("Consulenza")
      expect(result.newDisplayDate).toBeDefined()
      expect(result.newDisplayTime).toBeDefined()
      expect(result.oldStartTime).toBe(futureTime.toISOString())
    })
  })
})
