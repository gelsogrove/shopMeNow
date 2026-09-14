/**
 * Unit tests for the trial-expiry warning job.
 *
 * WHY THIS JOB EXISTS (Andrea, 2026-09-14): a FREE_TRIAL used to lapse in
 * total silence. The owner got no email, and the first visible sign was the
 * chatbot refusing to answer their customers (the inbound pipeline blocks
 * TRIAL_EXPIRED without replying, deliberately). These tests pin the three
 * properties that make the warning trustworthy:
 *   1. the threshold comes from the DB, never from a hardcoded constant
 *   2. each owner is warned ONCE per trial, not once per day
 *   3. a failed send is retried tomorrow rather than silently lost
 */

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

const mockSendTrialExpiringAlert = jest.fn()
jest.mock("../../src/application/services/email.service", () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendTrialExpiringAlert: mockSendTrialExpiringAlert,
  })),
}))

const mockPrisma = {
  platformConfig: { findFirst: jest.fn() },
  user: { findMany: jest.fn(), update: jest.fn() },
}
jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
}))

import {
  runTrialExpiryNotifications,
  daysUntil,
  resolveWarningDays,
  TRIAL_WARNING_DAYS_KEY,
} from "../../src/services/trial-expiry-notification.service"

const NOW = new Date("2026-09-14T09:00:00.000Z")
const inDays = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)

describe("Trial expiry notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.platformConfig.findFirst.mockResolvedValue({ value: "3" })
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.user.update.mockResolvedValue({})
    mockSendTrialExpiringAlert.mockResolvedValue(true)
  })

  describe("daysUntil", () => {
    it("rounds up so a trial ending in hours still reads as 1 day", () => {
      // An owner whose trial dies tonight must be told "1 day", never "0".
      expect(daysUntil(new Date(NOW.getTime() + 6 * 60 * 60 * 1000), NOW)).toBe(1)
      expect(daysUntil(inDays(3), NOW)).toBe(3)
    })
  })

  describe("resolveWarningDays", () => {
    it("reads the threshold from PlatformConfig", async () => {
      mockPrisma.platformConfig.findFirst.mockResolvedValue({ value: "5" })
      await expect(resolveWarningDays()).resolves.toBe(5)
      expect(mockPrisma.platformConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: TRIAL_WARNING_DAYS_KEY, isActive: true },
        })
      )
    })

    it("returns null when the key is missing (no invented default)", async () => {
      // CLAUDE.md rule 1: missing config is an error state, not a cue to
      // guess a number and start emailing customers on that guess.
      mockPrisma.platformConfig.findFirst.mockResolvedValue(null)
      await expect(resolveWarningDays()).resolves.toBeNull()
    })

    it("returns null when the configured value is not a positive number", async () => {
      mockPrisma.platformConfig.findFirst.mockResolvedValue({ value: "nonsense" })
      await expect(resolveWarningDays()).resolves.toBeNull()
    })
  })

  describe("runTrialExpiryNotifications", () => {
    it("sends nothing at all when the threshold is not configured", async () => {
      mockPrisma.platformConfig.findFirst.mockResolvedValue(null)

      const summary = await runTrialExpiryNotifications(NOW)

      expect(summary.emailsSent).toBe(0)
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
      expect(mockSendTrialExpiringAlert).not.toHaveBeenCalled()
    })

    it("queries only active FREE_TRIAL owners inside the warning window", async () => {
      await runTrialExpiryNotifications(NOW)

      const where = mockPrisma.user.findMany.mock.calls[0][0].where
      expect(where).toEqual(
        expect.objectContaining({
          deletedAt: null,
          planType: "FREE_TRIAL",
          subscriptionStatus: { not: "PAUSED" },
        })
      )
      // Window is (now, now + 3 days]: already-expired trials are excluded —
      // warning someone after the fact is noise.
      expect(where.trialEndsAt.gt).toEqual(NOW)
      expect(where.trialEndsAt.lte).toEqual(inDays(3))
    })

    it("warns an owner and stamps the throttle column", async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: "u1",
          email: "owner@example.com",
          firstName: "Owner",
          trialEndsAt: inDays(2),
          trialExpiringNotifiedAt: null,
        },
      ])

      const summary = await runTrialExpiryNotifications(NOW)

      expect(summary.emailsSent).toBe(1)
      expect(mockSendTrialExpiringAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "owner@example.com",
          firstName: "Owner",
          daysRemaining: 2,
        })
      )
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { trialExpiringNotifiedAt: NOW },
      })
    })

    it("does not warn the same owner twice for the same trial", async () => {
      // The job runs daily; without this the owner would be emailed every
      // morning for the whole warning window.
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: "u1",
          email: "owner@example.com",
          firstName: "Owner",
          trialEndsAt: inDays(2),
          trialExpiringNotifiedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
        },
      ])

      const summary = await runTrialExpiryNotifications(NOW)

      expect(summary.emailsSent).toBe(0)
      expect(mockSendTrialExpiringAlert).not.toHaveBeenCalled()
    })

    it("warns again when an extended trial re-enters the window", async () => {
      // Trial extended far into the future: the old stamp predates the new
      // window, so the owner is eligible for a fresh warning.
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: "u1",
          email: "owner@example.com",
          firstName: "Owner",
          trialEndsAt: inDays(3),
          trialExpiringNotifiedAt: new Date("2026-06-01T09:00:00.000Z"),
        },
      ])

      const summary = await runTrialExpiryNotifications(NOW)

      expect(summary.emailsSent).toBe(1)
      expect(mockSendTrialExpiringAlert).toHaveBeenCalledTimes(1)
    })

    it("does not stamp when the email fails, so tomorrow retries", async () => {
      mockSendTrialExpiringAlert.mockResolvedValue(false)
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: "u1",
          email: "owner@example.com",
          firstName: "Owner",
          trialEndsAt: inDays(1),
          trialExpiringNotifiedAt: null,
        },
      ])

      const summary = await runTrialExpiryNotifications(NOW)

      expect(summary.emailsSent).toBe(0)
      expect(summary.errors).toBe(1)
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it("keeps going when one owner throws", async () => {
      // One bad row must not cost every later owner their warning.
      mockSendTrialExpiringAlert
        .mockRejectedValueOnce(new Error("SMTP down"))
        .mockResolvedValueOnce(true)
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: "u1",
          email: "first@example.com",
          firstName: "First",
          trialEndsAt: inDays(1),
          trialExpiringNotifiedAt: null,
        },
        {
          id: "u2",
          email: "second@example.com",
          firstName: "Second",
          trialEndsAt: inDays(2),
          trialExpiringNotifiedAt: null,
        },
      ])

      const summary = await runTrialExpiryNotifications(NOW)

      expect(summary.ownersChecked).toBe(2)
      expect(summary.errors).toBe(1)
      expect(summary.emailsSent).toBe(1)
    })
  })
})
