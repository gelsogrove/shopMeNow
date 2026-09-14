/**
 * The appointment tools must follow the calendar switch — in BOTH directions.
 *
 * Found live on 2026-09-14: `seedSystemFunctions` only ever ran at workspace
 * CREATION, so flipping the switch afterwards changed nothing. Two production
 * workspaces had `enableCalendarBooking = false` and all five booking tools
 * still active — the model could offer to book appointments the tenant does
 * not take. The opposite case is just as bad and fails silently: switch the
 * calendar ON later and the tools are never created, so the feature reads as
 * enabled in Settings and does nothing at all.
 *
 * These tests lock the DECISION (which tools for which state). The sync that
 * applies it lives in WorkspaceService.syncSystemFunctions.
 */

import {
  APPOINTMENT_FUNCTIONS,
  systemFunctionsFor,
} from "../../src/constants/system-functions"

const names = (fns: Array<{ functionName: string }>) =>
  fns.map((f) => f.functionName)

const BOOKING = APPOINTMENT_FUNCTIONS.map((f) => f.functionName)

const MODES = ["PRO_LOCO", "FLOW", "INFORMATIONAL", "ECOMMERCE"] as const

describe("appointment tools follow the calendar switch", () => {
  it("ships exactly the five booking tools", () => {
    // If this number changes, the sync's deactivate list changes with it —
    // worth noticing rather than discovering from a bot offering a new tool.
    expect(BOOKING).toHaveLength(5)
    expect(BOOKING).toEqual(
      expect.arrayContaining([
        "bookAppointment",
        "cancelAppointment",
        "getCustomerAppointments",
        "listAvailableSlots",
        "rescheduleAppointment",
      ])
    )
  })

  it.each(MODES)("gives %s the booking tools when the calendar is ON", (mode) => {
    // Orthogonal to the mode on purpose: a tourist office books guided tours,
    // a shop books fittings. Both need them when the switch is on.
    const result = names(systemFunctionsFor(mode, true))
    for (const tool of BOOKING) {
      expect(result).toContain(tool)
    }
  })

  it.each(MODES)("gives %s NO booking tool when the calendar is OFF", (mode) => {
    // The live bug: tools present while the switch said off.
    const result = names(systemFunctionsFor(mode, false))
    for (const tool of BOOKING) {
      expect(result).not.toContain(tool)
    }
  })

  it("turning the calendar on ADDS tools and never removes the others", () => {
    const off = names(systemFunctionsFor("PRO_LOCO", false))
    const on = names(systemFunctionsFor("PRO_LOCO", true))

    // Everything that was there before is still there: enabling booking must
    // not cost the workspace a tool it already had.
    for (const fn of off) {
      expect(on).toContain(fn)
    }
    expect(on.length).toBe(off.length + BOOKING.length)
  })

  it("turning the calendar off leaves exactly the non-booking tools", () => {
    const on = names(systemFunctionsFor("PRO_LOCO", true))
    const off = names(systemFunctionsFor("PRO_LOCO", false))

    // What the sync must deactivate is precisely the booking set — nothing
    // more, so an admin loses no other capability by closing the calendar.
    const removed = on.filter((fn) => !off.includes(fn))
    expect(removed.sort()).toEqual([...BOOKING].sort())
  })

  it("the decision is stable: same inputs, same tools", () => {
    // The sync runs on EVERY save. A non-deterministic answer would churn rows
    // (and their admin-edited descriptions) on every unrelated settings change.
    const a = names(systemFunctionsFor("PRO_LOCO", true))
    const b = names(systemFunctionsFor("PRO_LOCO", true))
    expect(a).toEqual(b)
  })
})
