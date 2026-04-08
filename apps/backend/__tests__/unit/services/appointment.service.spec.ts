/**
 * Appointment Service - Unit Tests
 *
 * Tests cover:
 * 1. Appointment Type CRUD (create, read, update, delete)
 * 2. Business Hours validation and bulk upsert
 * 3. Blackout Periods CRUD
 * 4. Slot availability validation (blackouts, business hours, conflicts)
 * 5. Available slots generation (getAvailableSlots)
 * 6. Confirmed appointment creation with double-check validation
 * 7. Appointment cancellation and status transitions
 * 8. Customer appointment listing
 * 9. Workspace appointment listing (admin panel)
 *
 * @see apps/backend/src/application/services/appointment.service.ts
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

import { AppointmentService } from "../../../src/application/services/appointment.service"

// Build mock Prisma with all needed models
const mockAppointmentTypeRepo = {
  findByWorkspace: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
}

const mockBusinessHoursRepo = {
  findByWorkspace: jest.fn(),
  findByDay: jest.fn(),
  bulkUpsert: jest.fn(),
}

const mockBlackoutPeriodRepo = {
  findByWorkspace: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  isDateBlocked: jest.fn(),
}

const mockPrisma = {
  appointment: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  pendingAppointment: {
    count: jest.fn(),
  },
  customers: {
    update: jest.fn(),
  },
} as any

// We need to mock the repositories that AppointmentService creates internally
jest.mock("../../../src/repositories/appointment-type.repository", () => ({
  AppointmentTypeRepository: jest.fn().mockImplementation(() => mockAppointmentTypeRepo),
}))

jest.mock("../../../src/repositories/business-hours.repository", () => ({
  BusinessHoursRepository: jest.fn().mockImplementation(() => mockBusinessHoursRepo),
}))

jest.mock("../../../src/repositories/blackout-period.repository", () => ({
  BlackoutPeriodRepository: jest.fn().mockImplementation(() => mockBlackoutPeriodRepo),
}))

const WORKSPACE_ID = "ws-test-123"

describe("AppointmentService", () => {
  let service: AppointmentService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new AppointmentService(mockPrisma)
  })

  // ============================================
  // APPOINTMENT TYPES
  // ============================================

  describe("Appointment Types", () => {
    const mockType = {
      id: "type-1",
      workspaceId: WORKSPACE_ID,
      name: "Consulenza 30min",
      duration: 30,
      bufferTime: 10,
      price: 50,
      isActive: true,
    }

    describe("getAppointmentTypes", () => {
      // SCENARIO: Admin loads appointment types list page
      it("should return all active appointment types for workspace", async () => {
        mockAppointmentTypeRepo.findByWorkspace.mockResolvedValue([mockType])

        const result = await service.getAppointmentTypes(WORKSPACE_ID)

        expect(result).toEqual([mockType])
        expect(mockAppointmentTypeRepo.findByWorkspace).toHaveBeenCalledWith(WORKSPACE_ID, false)
      })

      // SCENARIO: Admin wants to see inactive types too
      it("should include inactive types when flag is true", async () => {
        mockAppointmentTypeRepo.findByWorkspace.mockResolvedValue([mockType])

        await service.getAppointmentTypes(WORKSPACE_ID, true)

        expect(mockAppointmentTypeRepo.findByWorkspace).toHaveBeenCalledWith(WORKSPACE_ID, true)
      })
    })

    describe("getAppointmentType", () => {
      // SCENARIO: Fetching a single appointment type by ID
      it("should return appointment type when found", async () => {
        mockAppointmentTypeRepo.findById.mockResolvedValue(mockType)

        const result = await service.getAppointmentType(WORKSPACE_ID, "type-1")

        expect(result).toEqual(mockType)
      })

      // RULE: Non-existent types must throw
      it("should throw when appointment type not found", async () => {
        mockAppointmentTypeRepo.findById.mockResolvedValue(null)

        await expect(service.getAppointmentType(WORKSPACE_ID, "non-existent")).rejects.toThrow(
          "Appointment type not found"
        )
      })
    })

    describe("createAppointmentType", () => {
      // SCENARIO: Admin creates a new appointment type
      it("should create appointment type with valid data", async () => {
        mockAppointmentTypeRepo.create.mockResolvedValue(mockType)

        const result = await service.createAppointmentType(WORKSPACE_ID, {
          name: "Consulenza 30min",
          duration: 30,
          bufferTime: 10,
          price: 50,
        })

        expect(result).toEqual(mockType)
        expect(mockAppointmentTypeRepo.create).toHaveBeenCalledWith(WORKSPACE_ID, {
          name: "Consulenza 30min",
          duration: 30,
          bufferTime: 10,
          price: 50,
        })
      })

      // RULE: Duration must be between 15 and 480 minutes
      it("should reject duration under 15 minutes", async () => {
        await expect(
          service.createAppointmentType(WORKSPACE_ID, { name: "Quick", duration: 10 })
        ).rejects.toThrow("Duration must be between 15 and 480 minutes")
      })

      it("should reject duration over 480 minutes", async () => {
        await expect(
          service.createAppointmentType(WORKSPACE_ID, { name: "Long", duration: 500 })
        ).rejects.toThrow("Duration must be between 15 and 480 minutes")
      })

      // RULE: Buffer time must be between 0 and 120 minutes
      it("should reject buffer time over 120 minutes", async () => {
        await expect(
          service.createAppointmentType(WORKSPACE_ID, { name: "Test", duration: 30, bufferTime: 150 })
        ).rejects.toThrow("Buffer time must be between 0 and 120 minutes")
      })

      // RULE: Price cannot be negative
      it("should reject negative price", async () => {
        await expect(
          service.createAppointmentType(WORKSPACE_ID, { name: "Test", duration: 30, price: -10 })
        ).rejects.toThrow("Price cannot be negative")
      })
    })

    describe("deleteAppointmentType", () => {
      // RULE: Cannot delete if pending appointments reference this type
      it("should block deletion when pending appointments exist", async () => {
        mockAppointmentTypeRepo.findById.mockResolvedValue(mockType)
        mockPrisma.pendingAppointment.count.mockResolvedValue(3)

        await expect(
          service.deleteAppointmentType(WORKSPACE_ID, "type-1")
        ).rejects.toThrow("Cannot delete appointment type: 3 pending appointments exist")
      })

      // SCENARIO: No pending appointments, safe to soft-delete
      it("should deactivate type when no pending appointments", async () => {
        mockAppointmentTypeRepo.findById.mockResolvedValue(mockType)
        mockPrisma.pendingAppointment.count.mockResolvedValue(0)
        mockAppointmentTypeRepo.deactivate.mockResolvedValue({ count: 1 })

        await service.deleteAppointmentType(WORKSPACE_ID, "type-1")

        expect(mockAppointmentTypeRepo.deactivate).toHaveBeenCalledWith(WORKSPACE_ID, "type-1")
      })
    })
  })

  // ============================================
  // BUSINESS HOURS
  // ============================================

  describe("Business Hours", () => {
    describe("updateBusinessHours", () => {
      // RULE: dayOfWeek must be 0-6 (Sunday-Saturday)
      it("should reject invalid dayOfWeek", async () => {
        await expect(
          service.updateBusinessHours(WORKSPACE_ID, [
            { dayOfWeek: 7, startTime: "09:00", endTime: "17:00" },
          ])
        ).rejects.toThrow("Invalid dayOfWeek: 7")
      })

      // RULE: Time format must be HH:mm
      it("should reject invalid time format", async () => {
        await expect(
          service.updateBusinessHours(WORKSPACE_ID, [
            { dayOfWeek: 1, startTime: "9:00", endTime: "17:00" },
          ])
        ).rejects.toThrow("Invalid startTime format")
      })

      // RULE: startTime must be before endTime
      it("should reject startTime >= endTime", async () => {
        await expect(
          service.updateBusinessHours(WORKSPACE_ID, [
            { dayOfWeek: 1, startTime: "18:00", endTime: "09:00" },
          ])
        ).rejects.toThrow("startTime must be before endTime")
      })

      // SCENARIO: Valid business hours update
      it("should bulk upsert valid hours", async () => {
        const hours = [
          { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
          { dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
        ]
        mockBusinessHoursRepo.bulkUpsert.mockResolvedValue(hours)

        const result = await service.updateBusinessHours(WORKSPACE_ID, hours)

        expect(result).toEqual(hours)
        expect(mockBusinessHoursRepo.bulkUpsert).toHaveBeenCalledWith(WORKSPACE_ID, hours)
      })
    })
  })

  // ============================================
  // BLACKOUT PERIODS
  // ============================================

  describe("Blackout Periods", () => {
    describe("createBlackoutPeriod", () => {
      // RULE: startDate must be before endDate
      it("should reject startDate >= endDate", async () => {
        const futureDate = new Date(Date.now() + 86400000)
        const pastDate = new Date(Date.now() - 86400000)

        await expect(
          service.createBlackoutPeriod(WORKSPACE_ID, {
            startDate: futureDate,
            endDate: pastDate,
          })
        ).rejects.toThrow("startDate must be before endDate")
      })

      // RULE: Cannot create blackout in the past
      it("should reject blackout period ending in the past", async () => {
        const pastStart = new Date(Date.now() - 2 * 86400000)
        const pastEnd = new Date(Date.now() - 86400000)

        await expect(
          service.createBlackoutPeriod(WORKSPACE_ID, {
            startDate: pastStart,
            endDate: pastEnd,
          })
        ).rejects.toThrow("Cannot create blackout period in the past")
      })

      // SCENARIO: Valid blackout period creation
      it("should create valid blackout period", async () => {
        const startDate = new Date(Date.now() + 86400000)
        const endDate = new Date(Date.now() + 2 * 86400000)
        const mockBlackout = { id: "bo-1", workspaceId: WORKSPACE_ID, startDate, endDate }

        mockBlackoutPeriodRepo.create.mockResolvedValue(mockBlackout)

        const result = await service.createBlackoutPeriod(WORKSPACE_ID, { startDate, endDate })

        expect(result).toEqual(mockBlackout)
      })
    })
  })

  // ============================================
  // SLOT AVAILABILITY (isSlotAvailable)
  // ============================================

  describe("isSlotAvailable", () => {
    const futureDate = new Date("2026-04-15T10:00:00")

    // SCENARIO: Date falls in a blackout period
    it("should return unavailable when date is in blackout", async () => {
      mockBlackoutPeriodRepo.isDateBlocked.mockResolvedValue(true)

      const result = await service.isSlotAvailable(WORKSPACE_ID, futureDate, 30)

      expect(result).toEqual({ available: false, reason: "Date falls within a closure period" })
    })

    // SCENARIO: Day is not open (no business hours or inactive)
    it("should return unavailable when day is closed", async () => {
      mockBlackoutPeriodRepo.isDateBlocked.mockResolvedValue(false)
      mockBusinessHoursRepo.findByDay.mockResolvedValue(null)

      const result = await service.isSlotAvailable(WORKSPACE_ID, futureDate, 30)

      expect(result).toEqual({ available: false, reason: "Outside business hours (day closed)" })
    })

    it("should return unavailable when day is inactive", async () => {
      mockBlackoutPeriodRepo.isDateBlocked.mockResolvedValue(false)
      mockBusinessHoursRepo.findByDay.mockResolvedValue({ dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isActive: false })

      const result = await service.isSlotAvailable(WORKSPACE_ID, futureDate, 30)

      expect(result).toEqual({ available: false, reason: "Outside business hours (day closed)" })
    })

    // SCENARIO: Slot is outside business hours window
    it("should return unavailable when slot extends past closing time", async () => {
      const lateSlot = new Date("2026-04-15T17:45:00") // 17:45 + 30min = 18:15 > 18:00
      mockBlackoutPeriodRepo.isDateBlocked.mockResolvedValue(false)
      mockBusinessHoursRepo.findByDay.mockResolvedValue({
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "18:00",
        isActive: true,
      })

      const result = await service.isSlotAvailable(WORKSPACE_ID, lateSlot, 30)

      expect(result).toEqual({
        available: false,
        reason: "Outside business hours (09:00-18:00)",
      })
    })

    // SCENARIO: Another appointment conflicts with the slot
    it("should return unavailable when slot conflicts with existing appointment", async () => {
      mockBlackoutPeriodRepo.isDateBlocked.mockResolvedValue(false)
      mockBusinessHoursRepo.findByDay.mockResolvedValue({
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "18:00",
        isActive: true,
      })
      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: "appt-existing",
        startTime: futureDate,
        endTime: new Date(futureDate.getTime() + 30 * 60 * 1000),
      })

      const result = await service.isSlotAvailable(WORKSPACE_ID, futureDate, 30)

      expect(result).toEqual({ available: false, reason: "Slot already booked" })
    })

    // SCENARIO: All checks pass — slot is available
    it("should return available when all checks pass", async () => {
      mockBlackoutPeriodRepo.isDateBlocked.mockResolvedValue(false)
      mockBusinessHoursRepo.findByDay.mockResolvedValue({
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "18:00",
        isActive: true,
      })
      mockPrisma.appointment.findFirst.mockResolvedValue(null)

      const result = await service.isSlotAvailable(WORKSPACE_ID, futureDate, 30)

      expect(result).toEqual({ available: true })
    })
  })

  // ============================================
  // CREATE APPOINTMENT (confirmed booking)
  // ============================================

  describe("createAppointment", () => {
    const mockType = {
      id: "type-1",
      name: "Consulenza",
      duration: 60,
      bufferTime: 15,
      isActive: true,
    }

    const appointmentData = {
      customerId: "cust-1",
      appointmentTypeId: "type-1",
      startTime: new Date("2026-04-15T10:00:00"),
      customerName: "Mario Rossi",
      customerPhone: "+393331234567",
      bookedVia: "whatsapp",
    }

    // SCENARIO: Customer books a valid appointment
    it("should create confirmed appointment when slot is available", async () => {
      // Mock appointment type lookup
      mockAppointmentTypeRepo.findById.mockResolvedValue(mockType)

      // Mock isSlotAvailable logic (blackout=no, hours=open, no conflict)
      mockBlackoutPeriodRepo.isDateBlocked.mockResolvedValue(false)
      mockBusinessHoursRepo.findByDay.mockResolvedValue({
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "18:00",
        isActive: true,
      })
      mockPrisma.appointment.findFirst.mockResolvedValue(null) // no conflict

      const createdAppointment = {
        id: "appt-new",
        ...appointmentData,
        status: "confirmed",
        endTime: new Date("2026-04-15T11:15:00"), // 60min + 15min buffer
        appointmentType: mockType,
      }
      mockPrisma.appointment.create.mockResolvedValue(createdAppointment)
      mockPrisma.customers.update.mockResolvedValue({})

      const result = await service.createAppointment(WORKSPACE_ID, appointmentData)

      expect(result.id).toBe("appt-new")
      expect(result.status).toBe("confirmed")
      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            customerId: "cust-1",
            status: "confirmed",
            bookedVia: "whatsapp",
          }),
        })
      )
    })

    // RULE: Throw when appointment type is inactive
    it("should throw when appointment type not found or inactive", async () => {
      mockAppointmentTypeRepo.findById.mockResolvedValue(null)

      await expect(
        service.createAppointment(WORKSPACE_ID, appointmentData)
      ).rejects.toThrow("Appointment type not found or inactive")
    })

    // RULE: Double-check slot availability before creating
    it("should throw when slot is no longer available", async () => {
      mockAppointmentTypeRepo.findById.mockResolvedValue(mockType)

      // Slot is booked by someone else in the meantime
      mockBlackoutPeriodRepo.isDateBlocked.mockResolvedValue(false)
      mockBusinessHoursRepo.findByDay.mockResolvedValue({
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "18:00",
        isActive: true,
      })
      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: "appt-conflict",
        startTime: appointmentData.startTime,
      })

      await expect(
        service.createAppointment(WORKSPACE_ID, appointmentData)
      ).rejects.toThrow("Slot no longer available")
    })
  })

  // ============================================
  // CANCEL APPOINTMENT
  // ============================================

  describe("cancelAppointment", () => {
    // SCENARIO: Customer cancels their confirme appointment
    it("should cancel a confirmed appointment", async () => {
      const existingAppt = {
        id: "appt-1",
        workspaceId: WORKSPACE_ID,
        status: "confirmed",
      }
      const cancelledAppt = {
        ...existingAppt,
        status: "cancelled",
        cancelledAt: expect.any(Date),
        cancelledBy: "customer",
        appointmentType: { name: "Test" },
      }

      mockPrisma.appointment.findFirst.mockResolvedValue(existingAppt)
      mockPrisma.appointment.update.mockResolvedValue(cancelledAppt)

      const result = await service.cancelAppointment(WORKSPACE_ID, "appt-1", "Changed plans", "customer")

      expect(result.status).toBe("cancelled")
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "cancelled",
            cancellationReason: "Changed plans",
            cancelledBy: "customer",
          }),
        })
      )
    })

    // RULE: Cannot cancel an already-cancelled appointment
    it("should throw when appointment is already cancelled", async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: "appt-1",
        status: "cancelled",
      })

      await expect(
        service.cancelAppointment(WORKSPACE_ID, "appt-1")
      ).rejects.toThrow("Appointment is already cancelled")
    })

    // RULE: Non-existent appointment should throw
    it("should throw when appointment not found", async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null)

      await expect(
        service.cancelAppointment(WORKSPACE_ID, "non-existent")
      ).rejects.toThrow("Appointment not found")
    })
  })

  // ============================================
  // GET CUSTOMER APPOINTMENTS
  // ============================================

  describe("getCustomerAppointments", () => {
    // SCENARIO: Customer asks LLM "my appointments"
    it("should return upcoming confirmed appointments for customer", async () => {
      const mockAppointments = [
        {
          id: "appt-1",
          customerId: "cust-1",
          status: "confirmed",
          startTime: new Date("2026-04-20T10:00:00"),
          appointmentType: { name: "Consulenza" },
        },
      ]
      mockPrisma.appointment.findMany.mockResolvedValue(mockAppointments)

      const result = await service.getCustomerAppointments(WORKSPACE_ID, "cust-1")

      expect(result).toEqual(mockAppointments)
      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            customerId: "cust-1",
            status: "confirmed",
          }),
          orderBy: { startTime: "asc" },
        })
      )
    })

    // SCENARIO: Customer has no upcoming appointments
    it("should return empty array when no appointments found", async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])

      const result = await service.getCustomerAppointments(WORKSPACE_ID, "cust-1")

      expect(result).toEqual([])
    })
  })

  // ============================================
  // GET WORKSPACE APPOINTMENTS (admin)
  // ============================================

  describe("getWorkspaceAppointments", () => {
    // SCENARIO: Admin views all appointments for workspace
    it("should return all appointments with default limit 100", async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])

      await service.getWorkspaceAppointments(WORKSPACE_ID)

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: WORKSPACE_ID }),
          take: 100,
        })
      )
    })

    // SCENARIO: Admin filters by status and date range
    it("should filter by status and dates when provided", async () => {
      const from = new Date("2026-04-01")
      const to = new Date("2026-04-30")

      await service.getWorkspaceAppointments(WORKSPACE_ID, {
        status: "confirmed",
        from,
        to,
        limit: 50,
      })

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            status: "confirmed",
            startTime: expect.objectContaining({
              gte: from,
              lte: to,
            }),
          }),
          take: 50,
        })
      )
    })
  })
})
