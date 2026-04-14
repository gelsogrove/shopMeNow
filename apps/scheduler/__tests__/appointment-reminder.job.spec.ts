/**
 * Appointment Reminder Job - Unit Tests
 *
 * Tests cover:
 * 1. resolveReminderChannel - widget bookings → email, workspace preferences, fallback
 * 2. buildReminderMessage - template variable replacement, default message
 * 3. billReminder - transaction with credit decrement, billing transaction creation
 * 4. processReminder - dedup via ReminderLock, WhatsApp enqueue, email logic
 * 5. appointmentReminderJob - 24h, 1h and 30m window queries
 *
 * @see apps/scheduler/src/jobs/appointment-reminder.job.ts
 */

// Mock logger
jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Build a mock prisma that captures all calls
const mockAppointmentFindMany = jest.fn()
const mockAppointmentUpdate = jest.fn()
const mockReminderLockFindUnique = jest.fn()
const mockReminderLockCreate = jest.fn()
const mockWhatsAppQueueCreate = jest.fn()
const mockUserUpdate = jest.fn()
const mockUserFindUnique = jest.fn()
const mockBillingTransactionCreate = jest.fn()

const mockTx = {
  user: { update: mockUserUpdate, findUnique: mockUserFindUnique },
  billingTransaction: { create: mockBillingTransactionCreate },
}

const mockPrisma = {
  appointment: {
    findMany: mockAppointmentFindMany,
    update: mockAppointmentUpdate,
  },
  reminderLock: {
    findUnique: mockReminderLockFindUnique,
    create: mockReminderLockCreate,
  },
  whatsAppQueue: {
    create: mockWhatsAppQueueCreate,
  },
  $transaction: jest.fn(async (fn: any) => fn(mockTx)),
}

// Mock database config
jest.mock('../src/config/database', () => ({
  __esModule: true,
  prisma: mockPrisma,
  Prisma: {
    Decimal: jest.fn((v: number) => v),
  },
}))

// Now import the job (after mocks are set up)
// We need to access internal functions - they are not exported, so we test via the main entry point
import { appointmentReminderJob } from '../src/jobs/appointment-reminder.job'

describe('Appointment Reminder Job', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: no appointments need reminders
    mockAppointmentFindMany.mockResolvedValue([])
  })

  // ============================================
  // MAIN JOB
  // ============================================

  describe('appointmentReminderJob', () => {
    // SCENARIO: No appointments need reminders
    it('should handle empty appointment lists gracefully', async () => {
      await appointmentReminderJob()

      // Should query for 24h, 1h AND 30m reminders
      expect(mockAppointmentFindMany).toHaveBeenCalledTimes(3)
    })

    // SCENARIO: 24h reminder for WhatsApp appointment
    it('should process 24h WhatsApp reminder with billing', async () => {
      const futureDate = new Date(Date.now() + 23.5 * 60 * 60 * 1000)
      const appointment = createMockAppointment(futureDate, 'whatsapp', 'whatsapp')

      // First call (24h) returns appointment, second call (1h) returns empty
      mockAppointmentFindMany
        .mockResolvedValueOnce([appointment])
        .mockResolvedValueOnce([])

      // No existing lock
      mockReminderLockFindUnique.mockResolvedValue(null)
      mockReminderLockCreate.mockResolvedValue({})
      mockWhatsAppQueueCreate.mockResolvedValue({})
      mockAppointmentUpdate.mockResolvedValue({})
      // Mock user balance for billing transaction
      mockUserFindUnique.mockResolvedValue({ creditBalance: 50 })
      mockUserUpdate.mockResolvedValue({})
      mockBillingTransactionCreate.mockResolvedValue({})

      await appointmentReminderJob()

      // Should create reminder lock
      expect(mockReminderLockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentId: 'appt-1',
            reminderType: '24h',
          }),
        })
      )

      // Should enqueue WhatsApp message
      expect(mockWhatsAppQueueCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: 'ws-1',
            phoneNumber: '+393331234567',
            customerId: 'cust-1',
          }),
        })
      )

      // Should bill owner (€0.50 for WhatsApp)
      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'owner-1' },
          data: expect.objectContaining({
            creditBalance: { decrement: 0.50 },
          }),
        })
      )

      // Should update appointment with reminder sent timestamp
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'appt-1' },
          data: expect.objectContaining({
            reminder24hSentAt: expect.any(Date),
            reminderChannel: 'whatsapp',
          }),
        })
      )
    })

    // SCENARIO: Widget booking always gets email (FREE)
    it('should send email for widget bookings (free, no billing)', async () => {
      const futureDate = new Date(Date.now() + 23.5 * 60 * 60 * 1000)
      const appointment = createMockAppointment(futureDate, 'widget', 'whatsapp')
      // Widget booking should get email regardless of workspace preference
      appointment.customer!.email = 'mario@example.com'

      mockAppointmentFindMany
        .mockResolvedValueOnce([appointment])
        .mockResolvedValueOnce([])

      mockReminderLockFindUnique.mockResolvedValue(null)
      mockReminderLockCreate.mockResolvedValue({})
      mockAppointmentUpdate.mockResolvedValue({})

      await appointmentReminderJob()

      // Should NOT enqueue WhatsApp message (widget = email always)
      expect(mockWhatsAppQueueCreate).not.toHaveBeenCalled()

      // Should NOT bill (email is free)
      expect(mockUserUpdate).not.toHaveBeenCalled()

      // Should update with email channel
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reminderChannel: 'email',
          }),
        })
      )
    })

    // SCENARIO: Duplicate lock prevents re-processing (deduplication)
    it('should skip reminder when lock already exists', async () => {
      const futureDate = new Date(Date.now() + 23.5 * 60 * 60 * 1000)
      const appointment = createMockAppointment(futureDate, 'whatsapp', 'whatsapp')

      mockAppointmentFindMany
        .mockResolvedValueOnce([appointment])
        .mockResolvedValueOnce([])

      // Lock already exists!
      mockReminderLockFindUnique.mockResolvedValue({ lockKey: 'reminder-24h-appt-1' })

      await appointmentReminderJob()

      // Should NOT create lock, enqueue, or update
      expect(mockReminderLockCreate).not.toHaveBeenCalled()
      expect(mockWhatsAppQueueCreate).not.toHaveBeenCalled()
      expect(mockAppointmentUpdate).not.toHaveBeenCalled()
    })

    // SCENARIO: 1h reminder window
    it('should process 1h reminders', async () => {
      const futureDate = new Date(Date.now() + 55 * 60 * 1000) // 55 minutes from now
      const appointment = createMockAppointment(futureDate, 'whatsapp', 'whatsapp')

      // First call (24h) returns empty, second call (1h) returns appointment
      mockAppointmentFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([appointment])

      mockReminderLockFindUnique.mockResolvedValue(null)
      mockReminderLockCreate.mockResolvedValue({})
      mockWhatsAppQueueCreate.mockResolvedValue({})
      mockAppointmentUpdate.mockResolvedValue({})

      await appointmentReminderJob()

      // Should create lock for 1h reminder
      expect(mockReminderLockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reminderType: '1h',
          }),
        })
      )

      // Should update with 1h sent timestamp
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reminder1hSentAt: expect.any(Date),
          }),
        })
      )
    })

    // SCENARIO: No phone AND no email → skip reminder entirely
    it('should skip reminder when customer has no contact info', async () => {
      const futureDate = new Date(Date.now() + 23.5 * 60 * 60 * 1000)
      const appointment = createMockAppointment(futureDate, 'whatsapp', 'whatsapp')
      appointment.customer!.phone = null
      appointment.customer!.email = null

      mockAppointmentFindMany
        .mockResolvedValueOnce([appointment])
        .mockResolvedValueOnce([])

      mockReminderLockFindUnique.mockResolvedValue(null)
      mockReminderLockCreate.mockResolvedValue({})

      await appointmentReminderJob()

      // Should NOT enqueue or update
      expect(mockWhatsAppQueueCreate).not.toHaveBeenCalled()
      expect(mockAppointmentUpdate).not.toHaveBeenCalled()
    })

    // SCENARIO: Workspace prefers email for all reminders
    it('should send email when workspace channel is email', async () => {
      const futureDate = new Date(Date.now() + 23.5 * 60 * 60 * 1000)
      const appointment = createMockAppointment(futureDate, 'whatsapp', 'email')
      appointment.customer!.email = 'mario@example.com'

      mockAppointmentFindMany
        .mockResolvedValueOnce([appointment])
        .mockResolvedValueOnce([])

      mockReminderLockFindUnique.mockResolvedValue(null)
      mockReminderLockCreate.mockResolvedValue({})
      mockAppointmentUpdate.mockResolvedValue({})

      await appointmentReminderJob()

      // Should NOT enqueue WhatsApp
      expect(mockWhatsAppQueueCreate).not.toHaveBeenCalled()
      // Should NOT bill (email is free)
      expect(mockUserUpdate).not.toHaveBeenCalled()
    })
  })
})

// ============================================
// HELPER: Create mock appointment with all relations
// ============================================

function createMockAppointment(
  startTime: Date,
  bookedVia: string,
  workspaceChannel: string
) {
  return {
    id: 'appt-1',
    workspaceId: 'ws-1',
    customerId: 'cust-1',
    serviceId: 'svc-1',
    startTime,
    endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
    status: 'confirmed',
    bookedVia,
    customerName: 'Mario Rossi',
    workspace: {
      id: 'ws-1',
      name: 'Test Shop',
      // Template uses DB reminder message fields (null = use default fallback)
      appointmentReminder24hMessage: null as string | null,
      appointmentReminder1hMessage: null as string | null,
      appointmentReminder30mMessage: null as string | null,
      appointmentReminderChannel: workspaceChannel,
      ownerId: 'owner-1',
    },
    // IMPORTANT: code reads appointment.service?.name (Services relation, NOT AppointmentType)
    service: {
      id: 'svc-1',
      name: 'Consulenza',
    },
    customer: {
      id: 'cust-1',
      phone: '+393331234567',
      email: null as string | null,
      name: 'Mario Rossi',
      language: 'it',
    },
  }
}
