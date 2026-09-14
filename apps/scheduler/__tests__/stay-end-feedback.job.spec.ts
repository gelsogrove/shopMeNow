/**
 * End-of-stay feedback — the rules that decide WHO gets messaged.
 *
 * These are unsolicited WhatsApp messages to real guests, so the two failures
 * Andrea named on 2026-09-14 are what this file exists to prevent:
 *
 *   "non possiamo permetterci di mandare messaggi a chi li ha già ricevuti"
 *   "ma attenzione, perché se fa una seconda vacanza il feedback lo dobbiamo
 *    inviare"
 *
 * The second is the dangerous one: it fails SILENTLY. Nobody notices a
 * message that was never sent — which is why it is tested here explicitly.
 */

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('../src/config/database', () => ({
  __esModule: true,
  prisma: {},
  Prisma: {},
  CampaignFrequency: { ONCE: 'ONCE', ON_STAY_END: 'ON_STAY_END' },
  CampaignTargetType: { ALL: 'ALL' },
  PushCampaignStatus: { SCHEDULED: 'SCHEDULED' },
  PushCampaignRecipientStatus: { PENDING: 'PENDING' },
}))

import {
  isDueForFeedback,
  localDateKey,
  targetDepartureDate,
} from '../src/jobs/stay-end-feedback.job'

describe('localDateKey', () => {
  // The dyno clock is UTC; the guest's day is not. At 23:30 UTC it is already
  // tomorrow in Rome, and asking "who left yesterday" with the wrong day
  // silently targets nobody.
  it('uses the workspace timezone, not UTC', () => {
    const lateEvening = new Date('2026-09-14T23:30:00Z')
    expect(localDateKey(lateEvening, 'Europe/Rome')).toBe('2026-09-15')
    expect(localDateKey(lateEvening, 'UTC')).toBe('2026-09-14')
  })

  it('falls back to the UTC date when the timezone is invalid', () => {
    // An unusable timezone must not throw and stop every send.
    expect(localDateKey(new Date('2026-09-14T10:00:00Z'), 'Not/AZone')).toBe('2026-09-14')
  })
})

describe('targetDepartureDate', () => {
  it('with the default 1-day delay, targets yesterday', () => {
    const now = new Date('2026-09-15T10:00:00Z')
    expect(targetDepartureDate(now, 'Europe/Rome', 1)).toBe('2026-09-14')
  })

  it('honours a longer delay', () => {
    const now = new Date('2026-09-15T10:00:00Z')
    expect(targetDepartureDate(now, 'Europe/Rome', 3)).toBe('2026-09-12')
  })

  it('crosses a month boundary correctly', () => {
    // Naive arithmetic on the day number gives "2026-09-00" here.
    const now = new Date('2026-09-01T10:00:00Z')
    expect(targetDepartureDate(now, 'Europe/Rome', 1)).toBe('2026-08-31')
  })

  it('treats a negative delay as same-day rather than a future date', () => {
    const now = new Date('2026-09-15T10:00:00Z')
    expect(targetDepartureDate(now, 'Europe/Rome', -5)).toBe('2026-09-15')
  })
})

describe('isDueForFeedback', () => {
  const TARGET = '2026-09-14'

  it('asks a guest who left on the target date', () => {
    expect(isDueForFeedback({ departureDate: TARGET }, TARGET)).toBe(true)
  })

  it('does NOT ask a guest who already answered for this stay', () => {
    // feedbackGiven is cleared by rolloverStay, so it means "this holiday",
    // not "ever" — which is what makes the second-holiday case below work.
    expect(isDueForFeedback({ departureDate: TARGET, feedbackGiven: true }, TARGET)).toBe(false)
  })

  it('does NOT ask a guest who left on another date', () => {
    expect(isDueForFeedback({ departureDate: '2026-09-10' }, TARGET)).toBe(false)
  })

  it('does NOT ask a guest still on holiday', () => {
    expect(isDueForFeedback({ departureDate: '2026-09-20' }, TARGET)).toBe(false)
  })

  it('does NOT ask a guest whose dates were never saved', () => {
    // No departure date means no way to know the holiday is over. The module's
    // startNewStay tool covers these guests instead.
    expect(isDueForFeedback({}, TARGET)).toBe(false)
    expect(isDueForFeedback(null, TARGET)).toBe(false)
    expect(isDueForFeedback(undefined, TARGET)).toBe(false)
  })

  // 🚨 THE ONE THAT FAILS SILENTLY.
  // A returning guest has feedbackGiven cleared by the rollover and a new
  // departure date. If dedup were keyed on the CUSTOMER — or if this flag
  // were read from customers.feedbackAt, which keeps the first holiday's
  // timestamp for ever — they would never be asked again. Nobody would notice.
  it('DOES ask the same guest again for a second holiday', () => {
    const secondStay = { departureDate: '2027-01-15', feedbackGiven: undefined }
    expect(isDueForFeedback(secondStay, '2027-01-15')).toBe(true)
  })

  it('the stay key differs between two holidays of the same guest', () => {
    // The unique index is (campaignId, customerId, stayKey): same guest, two
    // different keys, so Postgres lets the second message through while still
    // refusing a duplicate of the first.
    const august = targetDepartureDate(new Date('2026-08-21T10:00:00Z'), 'Europe/Rome', 1)
    const january = targetDepartureDate(new Date('2027-01-16T10:00:00Z'), 'Europe/Rome', 1)
    expect(august).not.toBe(january)
  })
})
