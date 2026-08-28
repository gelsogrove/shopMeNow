/**
 * demosappada — date-parse.ts: weekday and duration → ISO date, in Sappada's
 * own calendar (Europe/Rome).
 *
 * WHY: at 00:50 local time on Saturday 2026-08-29 (22:50Z on the 28th) the
 * weekday was read from the machine's local clock and the date written from
 * UTC: "fino a domenica" became 2026-08-29, a Saturday, and the guest's stay
 * ended a day early (sim, 2026-08-29). One calendar, the destination's.
 */
import { dateInDays, nextWeekdayDate, sappadaToday } from "../../custom-demosappada/date-parse"

describe("demosappada date-parse — Sappada's calendar, not the server's", () => {
  it("🚨 22:50Z on Friday the 28th is already Saturday the 29th in Sappada; 'domenica' → the 30th", () => {
    const now = new Date("2026-08-28T22:50:00Z")
    expect(sappadaToday(now)).toMatchObject({ y: 2026, m: 8, d: 29, weekday: 6 })
    expect(nextWeekdayDate("fino a domenica", now)).toBe("2026-08-30")
  })

  it("a weekday is never today: 'sabato' said on a Saturday is next week's", () => {
    expect(nextWeekdayDate("sabato", new Date("2026-08-29T10:00:00Z"))).toBe("2026-09-05")
  })

  it("durations count from Sappada's today", () => {
    expect(dateInDays(3, new Date("2026-08-28T22:50:00Z"))).toBe("2026-09-01")
  })

  it("other languages, same table", () => {
    const now = new Date("2026-08-29T10:00:00Z")
    expect(nextWeekdayDate("until Sunday", now)).toBe("2026-08-30")
    expect(nextWeekdayDate("bis Dienstag", now)).toBe("2026-09-01")
  })
})
