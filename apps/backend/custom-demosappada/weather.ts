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

const FORECAST_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
  `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
  `&hourly=weather_code,temperature_2m,precipitation_probability` +
  `&current=weather_code,temperature_2m,precipitation` +
  `&timezone=${TIMEZONE}&forecast_days=3`

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

  const rainyHours = rainy.map((i) => hours[i])
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
  const parts = [
    `${label}: ${describeCode(daily.weather_code[index])}`,
    `min ${Math.round(daily.temperature_2m_min[index])}°C / max ${Math.round(daily.temperature_2m_max[index])}°C`,
  ]
  const probability = daily.precipitation_probability_max[index]
  if (typeof probability === 'number') parts.push(`probabilità di pioggia ${probability}%`)
  if (rainWindow) parts.push(rainWindow)
  return `- ${parts.join(', ')}`
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

  if (payload.current) {
    const current = payload.current
    lines.push(
      `Adesso a Sappada: ${describeCode(current.weather_code)}, ${Math.round(current.temperature_2m)}°C` +
        (current.precipitation > 0 ? `, sta piovendo (${current.precipitation} mm)` : ''),
    )
  }

  const hourly = payload.hourly
  const labels = ['Oggi', 'Domani', 'Dopodomani']

  for (let d = 0; d < Math.min(daily.time.length, 3); d++) {
    let rainWindow: string | null = null
    if (hourly) {
      // For today only the hours still ahead matter; later days start at 08:00.
      const fromHour = d === 0 ? now.getHours() : 0
      const indices = daylightHours(hourly.time, daily.time[d], fromHour)
      const hours = indices.map((i) => Number(hourly.time[i].split('T')[1].slice(0, 2)))
      rainWindow = describeRainWindow(hours, hourly.precipitation_probability, indices)
    }
    lines.push(formatDay(labels[d], daily, d, rainWindow))
  }

  return { ok: true, summary: lines.join('\n') }
}

export const WEATHER_TOOL = {
  type: 'function',
  function: {
    name: 'get_weather',
    description:
      'Get the REAL current weather and 3-day forecast for Sappada. You have no other way to know the ' +
      'weather — never state or guess it without calling this first. Call it whenever the weather affects ' +
      'the answer: the customer asks about it, or asks what to do today/tomorrow, whether to hike, what ' +
      'to do with kids, or anything outdoors.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
} as const
