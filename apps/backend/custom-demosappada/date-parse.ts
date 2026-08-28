// Dates read from the guest's words by CODE: a weekday name ("fino a
// domenica"), a duration ("3 giorni"). Calendar arithmetic is code's job
// (iron rule 1): "fino a domenica" was once stored as a Friday by the model
// (2026-08-25). Closed vocabulary (§14), pure, no I/O.
//
// Everything is computed in Sappada's own calendar (Europe/Rome). Mixing the
// machine's local weekday with a UTC date string gave "domenica" = Saturday
// at 00:50 local time (2026-08-29): the weekday was read in one zone and the
// date written in another.

const TZ = 'Europe/Rome'
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Today's calendar date and weekday in Sappada, whatever the server's clock zone. */
export function sappadaToday(now: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now)
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? ''
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), weekday: WEEKDAY[get('weekday')] ?? now.getDay() }
}

const isoPlusDays = (t: { y: number; m: number; d: number }, days: number): string =>
  new Date(Date.UTC(t.y, t.m - 1, t.d) + days * 86_400_000).toISOString().slice(0, 10)

const DAY: Record<string, number> = {
  dome: 0, sund: 0, sonn: 0, dima: 0, domi: 0, zond: 0, sond: 0,
  lune: 1, mond: 1, mont: 1, lund: 1, maan: 1, mand: 1, segu: 1,
  mart: 2, tues: 2, dien: 2, mard: 2, dins: 2, tirs: 2, terc: 2,
  merc: 3, wedn: 3, mitt: 3, mier: 3, woen: 3, onsd: 3, quar: 3,
  giov: 4, thur: 4, donn: 4, jeud: 4, juev: 4, dond: 4, tors: 4, quin: 4,
  vene: 5, frid: 5, frei: 5, vend: 5, vier: 5, vrij: 5, fred: 5, sext: 5,
  saba: 6, satu: 6, sams: 6, same: 6, zate: 6, lord: 6,
}

/** The next occurrence (never today) of a weekday named in the message, as YYYY-MM-DD. */
export function nextWeekdayDate(msg: string, now: Date): string | undefined {
  const today = sappadaToday(now)
  for (const t of msg.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/)) {
    if (t.length < 4) continue
    const d = DAY[t.slice(0, 4)]
    if (d !== undefined) {
      let add = (d - today.weekday + 7) % 7
      if (add === 0) add = 7
      return isoPlusDays(today, add)
    }
  }
  return undefined
}

/** `days` days from today (Sappada calendar), as YYYY-MM-DD (capped at 60). */
export function dateInDays(days: number, now: Date): string {
  const n = Math.min(60, Math.max(0, Math.round(days)))
  return isoPlusDays(sappadaToday(now), n)
}
