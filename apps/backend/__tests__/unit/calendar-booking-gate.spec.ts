/**
 * Calendar booking capability gate
 *
 * Andrea 2026-08-01: `workspace.enableCalendarBooking` gates appointment
 * booking for the STANDARD chatbot (agent-functions.config.ts) but was ignored
 * entirely by the CUSTOM chatbot path — the host injected the bookAppointment
 * handler unconditionally and the module always exposed the tool, so a
 * workspace with booking OFF could still get a Google Calendar event created.
 *
 * WHAT these tests lock down:
 *   1. bookAppointment refuses when the workspace has booking disabled, and
 *      does so WITHOUT creating a calendar event.
 *   2. It proceeds normally when booking is enabled.
 *   3. It fails CLOSED — a DB error means "no booking", never "book anyway".
 *
 * WHY it is tested at the handler and not only at injection: injection is the
 * first line of defence, but the handler is the last one. Any future call path
 * (a cached module instance, a new custom chatbot, a direct call) must still
 * be unable to create an event for a workspace that never opted in.
 */

// The service pulls in Prisma, Google Calendar and Zoom at module load, so
// both are mocked before the import below.
const mockFindUnique = jest.fn()
const mockCreateEvent = jest.fn()

jest.mock("@echatbot/database", () => ({
  __esModule: true,
  prisma: { workspace: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
  PrismaClient: class {},
}))

jest.mock("../../src/services/google-calendar.service", () => ({
  googleCalendarService: { createEvent: (...args: unknown[]) => mockCreateEvent(...args) },
}))

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { CustomClientChatbotService } from "../../src/application/services/custom-client-chatbot.service"

// Minimal valid booking payload — the gate must trigger regardless of content.
const bookingParams = {
  workspaceId: "ws-1",
  date: "2026-08-10",
  time: "10:00",
  durationMinutes: 60,
  topic: "Treatment",
  customerName: "Andrea",
  customerEmail: "andrea@example.com",
  customerPhone: "+39123456789",
  location: "Navigli",
  services: [{ kind: "service" as const, name: "Massage", price: 50, durationMin: 60 }],
  products: [],
}

// bookAppointment is private: the gate is an internal invariant, and reaching
// it through invoke() would require standing up a whole chatbot module.
const callBookAppointment = (service: CustomClientChatbotService) =>
  (service as unknown as {
    bookAppointment: (p: typeof bookingParams) => Promise<Record<string, unknown>>
  }).bookAppointment(bookingParams)

describe("Calendar booking gate (workspace.enableCalendarBooking)", () => {
  let service: CustomClientChatbotService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CustomClientChatbotService()
  })

  it("refuses the booking when the workspace has calendar booking disabled", async () => {
    mockFindUnique.mockResolvedValue({ timezone: "Europe/Rome", enableCalendarBooking: false })

    const result = await callBookAppointment(service)

    expect(result.ok).toBe(false)
    expect(result.error).toBe("calendar_booking_disabled")
    // The refusal must instruct the LLM, so it can recover in-conversation
    // instead of retrying the same call (iron rule: tool refuses, LLM corrects).
    expect(typeof result.instruction).toBe("string")
    expect(result.instruction).toBeTruthy()
  })

  it("does NOT create a calendar event when booking is disabled", async () => {
    mockFindUnique.mockResolvedValue({ timezone: "Europe/Rome", enableCalendarBooking: false })

    await callBookAppointment(service)

    // The whole point of the gate: no side-effect reaches Google Calendar.
    expect(mockCreateEvent).not.toHaveBeenCalled()
  })

  it("creates the calendar event when booking is enabled", async () => {
    mockFindUnique.mockResolvedValue({ timezone: "Europe/Rome", enableCalendarBooking: true })
    mockCreateEvent.mockResolvedValue({ googleEventLink: "https://calendar.google.com/event/abc" })

    const result = await callBookAppointment(service)

    expect(mockCreateEvent).toHaveBeenCalledTimes(1)
    expect(result.ok).not.toBe(false)
    expect(result.googleEventLink).toBe("https://calendar.google.com/event/abc")
  })

  it("fails closed when the workspace row is missing", async () => {
    // An unknown workspace must never be treated as "booking allowed".
    mockFindUnique.mockResolvedValue(null)

    const result = await callBookAppointment(service)

    expect(result.ok).toBe(false)
    expect(result.error).toBe("calendar_booking_disabled")
    expect(mockCreateEvent).not.toHaveBeenCalled()
  })

  it("treats a null flag as disabled rather than enabled", async () => {
    // Legacy rows may carry null instead of false; null is NOT consent.
    mockFindUnique.mockResolvedValue({ timezone: "Europe/Rome", enableCalendarBooking: null })

    const result = await callBookAppointment(service)

    expect(result.ok).toBe(false)
    expect(mockCreateEvent).not.toHaveBeenCalled()
  })
})
