/**
 * ICS Generator - RFC 5545 iCalendar format
 *
 * Generates .ics calendar files for appointment invitations.
 * Compatible with Google Calendar, Outlook, Apple Calendar, etc.
 */

interface IcsEventParams {
  summary: string // Event title (e.g., "Consulenza franchising - Marco Rossi")
  description?: string // Event description (can include Zoom link)
  startTime: Date // UTC ISO datetime
  endTime: Date // UTC ISO datetime
  timezone: string // IANA timezone (e.g., "Europe/Rome")
  location?: string // Optional location
  attendeeEmail?: string // Optional attendee email
  organizerEmail?: string // Organizer email
  uid?: string // Unique identifier (default: auto-generated)
}

/**
 * Generate RFC 5545 iCalendar format string
 */
export function generateIcs(params: IcsEventParams): string {
  const {
    summary,
    description,
    startTime,
    endTime,
    timezone,
    location,
    attendeeEmail,
    organizerEmail,
    uid = `appointment-${Date.now()}@echatbot.ai`,
  } = params

  // Format dates in iCalendar format (YYYYMMDDTHHMMSSZ)
  const formatIcsDate = (date: Date) => {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const seconds = String(date.getUTCSeconds()).padStart(2, '0')
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
  }

  const dtStart = formatIcsDate(startTime)
  const dtEnd = formatIcsDate(endTime)
  const now = formatIcsDate(new Date())

  // Escape special characters in text fields
  const escapeText = (text: string) => {
    return text
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
      .replace(/\\/g, '\\\\')
  }

  const summaryEscaped = escapeText(summary)
  const descriptionEscaped = description ? escapeText(description) : ''

  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//eChat Bot//Appointment//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART;TZID=${timezone}:${dtStart}
DTEND;TZID=${timezone}:${dtEnd}
SUMMARY:${summaryEscaped}
`

  if (descriptionEscaped) {
    ics += `DESCRIPTION:${descriptionEscaped}\n`
  }

  if (location) {
    ics += `LOCATION:${escapeText(location)}\n`
  }

  if (organizerEmail) {
    ics += `ORGANIZER;CN=eChat Bot:mailto:${organizerEmail}\n`
  }

  if (attendeeEmail) {
    ics += `ATTENDEE;CN=${attendeeEmail};PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendeeEmail}\n`
  }

  ics += `STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`

  return ics
}

/**
 * Generate Google Calendar add-event URL
 * User clicks link → Google Calendar opens with pre-filled event
 */
export function generateGoogleCalendarUrl(params: IcsEventParams): string {
  const { summary, description, startTime, endTime, location } = params

  const startStr = startTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const endStr = endTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const baseUrl = 'https://calendar.google.com/calendar/u/0/r/eventedit'
  const params_obj: Record<string, string> = {
    text: summary,
    dates: `${startStr}/${endStr}`,
  }

  if (description) {
    params_obj.details = description
  }

  if (location) {
    params_obj.location = location
  }

  const queryString = Object.entries(params_obj)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')

  return `${baseUrl}?${queryString}`
}
