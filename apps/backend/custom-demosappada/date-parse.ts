// Dates read from the guest's words by CODE: a weekday name ("fino a
// domenica"), a duration ("3 giorni"). Calendar arithmetic is code's job
// (iron rule 1): "fino a domenica" was once stored as a Friday by the model
// (2026-08-25). Closed vocabulary (§14), pure, no I/O.

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
  for (const t of msg.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/)) {
    if (t.length < 4) continue
    const d = DAY[t.slice(0, 4)]
    if (d !== undefined) {
      let add = (d - now.getDay() + 7) % 7
      if (add === 0) add = 7
      return new Date(now.getTime() + add * 86_400_000).toISOString().slice(0, 10)
    }
  }
  return undefined
}

/** `days` days from now, as YYYY-MM-DD (capped at 60). */
export function dateInDays(days: number, now: Date): string {
  const n = Math.min(60, Math.max(0, Math.round(days)))
  return new Date(now.getTime() + n * 86_400_000).toISOString().slice(0, 10)
}
