/**
 * Live weather for Sappada — Open-Meteo (no API key, no account).
 *
 * The whole product promise is recombination: "it's raining and I have two
 * kids and three hours" must produce ONE answer. Half of that constraint is
 * the weather, and the model cannot know it — its training data has no
 * forecast for tomorrow, so asked without data it produces a plausible
 * invention. A tourist who leaves in a t-shirt because the bot guessed
 * "sunny, 22°" does not open the chat again.
 *
 * So the forecast is fetched, never recalled. When the fetch fails the tool
 * says so and the model falls back to the official bulletin — an honest
 * "I don't know" beats a confident guess (main prompt, NEVER INVENT).
 */

/** Sappada (UD), 1250 m. Fixed: this module serves one destination. */
const LATITUDE = 46.5667
const LONGITUDE = 12.6833
const TIMEZONE = 'Europe/Rome'

/**
 * How far ahead to forecast.
 *
 * Seven, not three: the assistant plans a whole holiday, and a guest staying
 * a week needs to know which day to keep for the mountain. Open-Meteo serves
 * up to 16 days at no cost, but accuracy past a week is not worth presenting
 * as fact — beyond it the honest answer is "too far out to say".
 */
const FORECAST_DAYS = 7

const FORECAST_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
  `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
  `&hourly=weather_code,temperature_2m,precipitation_probability` +
  `&current=weather_code,temperature_2m,precipitation` +
  `&timezone=${TIMEZONE}&forecast_days=${FORECAST_DAYS}`

const REQUEST_TIMEOUT_MS = 6000

/**
 * WMO weather codes → a short Italian label. Italian is the source language of
 * every fact in this module (same convention as the FAQ block): the model
 * translates it into the customer's language along with the rest of the reply.
 */
const WEATHER_CODES: Record<number, string> = {
  0: 'sereno',
  1: 'poco nuvoloso',
  2: 'parzialmente nuvoloso',
  3: 'coperto',
  45: 'nebbia',
  48: 'nebbia con brina',
  51: 'pioviggine leggera',
  53: 'pioviggine',
  55: 'pioviggine intensa',
  56: 'pioviggine gelata',
  57: 'pioviggine gelata intensa',
  61: 'pioggia debole',
  63: 'pioggia',
  65: 'pioggia forte',
  66: 'pioggia gelata',
  67: 'pioggia gelata forte',
  71: 'neve debole',
  73: 'neve',
  75: 'neve abbondante',
  77: 'nevischio',
  80: 'rovesci deboli',
  81: 'rovesci',
  82: 'rovesci forti',
  85: 'rovesci di neve',
  86: 'rovesci di neve abbondanti',
  95: 'temporale',
  96: 'temporale con grandine',
  99: 'temporale con grandine forte',
}

function describeCode(code: number): string {
  return WEATHER_CODES[code] ?? 'condizioni variabili'
}

/** WMO codes that describe some form of precipitation. */
function isPrecipitationCode(code: number): boolean {
  return code >= 51
}

/**
 * Below this probability the day is not a rainy day, whatever the WMO code
 * says.
 *
 * The daily code reports the most significant phenomenon the model saw at ANY
 * point in the day, so a single 3%-likely shower stamps the whole day
 * "rovesci". Printed next to its own probability that reads as a
 * contradiction — "rovesci deboli e zero probabilità di pioggia" was the
 * actual sentence a customer got (live run, 2026-08-22). The probability is
 * the number a tourist plans around, so it wins: below the threshold the
 * summary describes the sky, and the possible shower is mentioned as the
 * afterthought it is.
 */
const RAIN_MENTION_THRESHOLD = 25

interface OpenMeteoResponse {
  current?: { time: string; weather_code: number; temperature_2m: number; precipitation: number }
  hourly?: { time: string[]; weather_code: number[]; temperature_2m: number[]; precipitation_probability: number[] }
  daily?: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    precipitation_probability_max: number[]
  }
}

export interface WeatherReport {
  ok: boolean
  /** Italian-source summary, ready to be translated by the model. */
  summary?: string
  error?: string
}

/**
 * Hours a tourist actually plans around — no point reporting 03:00. Returns
 * the remaining daytime hours of `day`, so "today" shrinks as the day goes on
 * and the advice stays about time the customer still has.
 */
function daylightHours(times: string[], day: string, fromHour: number): number[] {
  const indices: number[] = []
  for (let i = 0; i < times.length; i++) {
    const [date, clock] = times[i].split('T')
    if (date !== day) continue
    const hour = Number(clock.slice(0, 2))
    if (hour < Math.max(fromHour, 8) || hour > 20) continue
    indices.push(i)
  }
  return indices
}

/**
 * Describe when it rains during a day, in plain language ("fino alle 16",
 * "dal pomeriggio"), rather than dumping 13 hourly probabilities on the model
 * and hoping it summarises them correctly. The shape of the day is the part
 * the advice hangs on, so the code derives it.
 */
function describeRainWindow(hours: number[], probabilities: number[], indices: number[]): string | null {
  const rainy = indices.filter((i) => (probabilities[i] ?? 0) >= 50)
  if (rainy.length === 0) return null
  if (rainy.length === indices.length) return 'pioggia probabile per tutta la giornata'

  // `hours` is positional (one entry per daylight index), while `rainy` holds
  // GLOBAL indices into the hourly arrays — on day 2 those are already past
  // 48, so reading hours[globalIndex] gave undefined and printed
  // "tra le undefined e le NaN" (live check, 2026-08-23).
  const rainyHours = rainy.map((i) => hours[indices.indexOf(i)]).filter((h) => h !== undefined)
  if (rainyHours.length === 0) return null
  const first = rainyHours[0]
  const last = rainyHours[rainyHours.length - 1]

  // Contiguous block starting at the beginning of the day → "until X".
  const startsAtDayStart = first === hours[0]
  const endsAtDayEnd = last === hours[hours.length - 1]

  if (startsAtDayStart && !endsAtDayEnd) return `pioggia probabile fino alle ${last + 1}`
  if (!startsAtDayStart && endsAtDayEnd) return `pioggia probabile dalle ${first} in poi`
  if (startsAtDayStart && endsAtDayEnd) return 'pioggia probabile per tutta la giornata'
  return `pioggia probabile tra le ${first} e le ${last + 1}`
}

function formatDay(
  label: string,
  daily: NonNullable<OpenMeteoResponse['daily']>,
  index: number,
  rainWindow: string | null,
): string {
  const code = daily.weather_code[index]
  const probability = daily.precipitation_probability_max[index]
  const unlikelyRain =
    isPrecipitationCode(code) &&
    typeof probability === 'number' &&
    probability < RAIN_MENTION_THRESHOLD

  const sky = unlikelyRain ? 'in prevalenza asciutto' : describeCode(code)

  const parts = [
    `${label}: ${sky}`,
    `min ${Math.round(daily.temperature_2m_min[index])}°C / max ${Math.round(daily.temperature_2m_max[index])}°C`,
  ]

  if (unlikelyRain) {
    // The code label is phrased for the "Oggi: rovesci" slot, so it does not
    // decline into a subordinate clause ("qualche rovesci deboli isolato").
    // The clause is built without it: what matters here is that the chance is
    // small, not which flavour of precipitation it would have been.
    parts.push(
      `possibile qualche precipitazione isolata ma poco probabile (${probability}%) — trattala come una giornata buona`,
    )
  } else if (typeof probability === 'number') {
    parts.push(`probabilità di pioggia ${probability}%`)
    // The hourly window only means something on a day that may actually rain.
    if (rainWindow) parts.push(rainWindow)
  }

  return `- ${parts.join(', ')}`
}

/**
 * The wall clock in Sappada, taken from the forecast payload rather than the
 * server.
 *
 * Two things depend on the hour: which of today's hours are still ahead, and
 * whether it is a reasonable time to send someone up a mountain. Reading it
 * from `now.getHours()` gets both wrong off Rome time — on a UTC host at
 * 02:00 Sappada it reports 00:00 — while `current.time` is already returned
 * in the timezone the forecast was requested for.
 */
function sappadaClock(current: NonNullable<OpenMeteoResponse['current']>): { hour: number; label: string } | null {
  const clock = current.time.split('T')[1]
  if (!clock) return null
  const hour = Number(clock.slice(0, 2))
  if (!Number.isFinite(hour)) return null

  // Coarse bands, not a greeting: the model needs to know whether the day is
  // ahead, ending, or over, and picks its own words for it.
  const label =
    hour < 6 ? 'notte fonda' : hour < 12 ? 'mattina' : hour < 18 ? 'pomeriggio' : hour < 22 ? 'sera' : 'notte'
  return { hour, label }
}

/**
 * Fetch the current conditions and the next two days for Sappada.
 *
 * Never throws: a weather outage must not take the conversation down with it.
 * `ok:false` carries an instruction the model can act on honestly.
 */
export async function getSappadaWeather(now: Date = new Date()): Promise<WeatherReport> {
  let payload: OpenMeteoResponse
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const response = await fetch(FORECAST_URL, { signal: controller.signal })
    clearTimeout(timer)
    if (!response.ok) {
      return { ok: false, error: `weather service returned HTTP ${response.status}` }
    }
    payload = (await response.json()) as OpenMeteoResponse
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  const daily = payload.daily
  if (!daily || daily.time.length === 0) {
    return { ok: false, error: 'weather service returned no forecast' }
  }

  const lines: string[] = []

  // Drives both the "Adesso" line and how much of today is left; null only if
  // the payload carried no current block, in which case the host clock is the
  // best available fallback.
  const clock = payload.current ? sappadaClock(payload.current) : null

  if (payload.current) {
    const current = payload.current
    const when = clock ? ` (ore ${String(clock.hour).padStart(2, '0')}:00, ${clock.label})` : ''
    lines.push(
      `Adesso a Sappada${when}: ${describeCode(current.weather_code)}, ${Math.round(current.temperature_2m)}°C` +
        (current.precipitation > 0 ? `, sta piovendo (${current.precipitation} mm)` : ''),
    )
  }

  const hourly = payload.hourly
  const labels = ['Oggi', 'Domani', 'Dopodomani']

  /** Day name for anything past "dopodomani" — a week needs real dates. */
  const dayLabel = (index: number, isoDate: string): string => {
    if (index < labels.length) return labels[index]
    const date = new Date(`${isoDate}T12:00:00`)
    return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  for (let d = 0; d < Math.min(daily.time.length, FORECAST_DAYS); d++) {
    let rainWindow: string | null = null
    if (hourly) {
      // For today only the hours still ahead matter; later days start at 08:00.
      const fromHour = d === 0 ? (clock ? clock.hour : now.getHours()) : 0
      const indices = daylightHours(hourly.time, daily.time[d], fromHour)
      const hours = indices.map((i) => Number(hourly.time[i].split('T')[1].slice(0, 2)))
      rainWindow = describeRainWindow(hours, hourly.precipitation_probability, indices)
    }
    lines.push(formatDay(dayLabel(d, daily.time[d]), daily, d, rainWindow))
  }

  return { ok: true, summary: lines.join('\n') }
}

export const WEATHER_TOOL = {
  type: 'function',
  function: {
    name: 'get_weather',
    description:
      'Get the REAL current weather and 7-day forecast for Sappada, plus the local time in Sappada. ' +
      'You have no other way to know either — never state or guess them without calling this first. ' +
      'Call it whenever the weather affects the answer: the customer asks about it, or asks what to do ' +
      'today/tomorrow, whether to hike, what to do with kids, or anything outdoors. The result opens ' +
      'with the current hour: respect it when suggesting activities — do not propose something for a ' +
      'part of the day that has already passed.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
} as const
