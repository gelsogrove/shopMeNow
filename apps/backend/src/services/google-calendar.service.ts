/**
 * GoogleCalendarService
 * 
 * Manages Google Calendar event CRUD operations with automatic token refresh.
 * Used by bookAppointment, cancelAppointment, rescheduleAppointment calling functions.
 * 
 * Flow:
 * 1. Get GoogleCalendarConnection for workspace (accessToken, refreshToken)
 * 2. Auto-refresh token if expired (< 5 min remaining)
 * 3. Create/Delete/Update events via Google Calendar API v3
 * 4. Return googleEventId + googleEventLink for DB storage
 */

import { google, calendar_v3 } from 'googleapis'
import { prisma } from '@echatbot/database'
import logger from '../utils/logger'

// Token refresh buffer: refresh 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

interface CalendarEventResult {
  googleEventId: string
  googleEventLink: string | null
  googleCalendarId: string
}

interface CreateEventParams {
  workspaceId: string
  summary: string // e.g. "Pulizia denti - Mario Rossi"
  description?: string
  startTime: Date
  endTime: Date
  timezone: string // IANA timezone e.g. "Europe/Rome"
  attendeeEmail?: string // customer email (optional)
}

interface UpdateEventParams extends CreateEventParams {
  googleEventId: string
}

export class GoogleCalendarService {

  /**
   * Create a Google Calendar event for a booked appointment
   */
  async createEvent(params: CreateEventParams): Promise<CalendarEventResult | null> {
    const { workspaceId, summary, description, startTime, endTime, timezone, attendeeEmail } = params

    try {
      const calendar = await this.getCalendarClient(workspaceId)
      if (!calendar) {
        logger.warn(`[GCAL] No calendar connection for workspace ${workspaceId}, skipping event creation`)
        return null
      }

      const connection = await prisma.googleCalendarConnection.findUnique({
        where: { workspaceId },
        select: { calendarId: true },
      })
      const calendarId = connection?.calendarId || 'primary'

      const event: calendar_v3.Schema$Event = {
        summary,
        description: description || undefined,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: timezone,
        },
        reminders: {
          useDefault: false, // We handle reminders ourselves via scheduler
        },
      }

      // Add attendee if email provided
      if (attendeeEmail) {
        event.attendees = [{ email: attendeeEmail }]
      }

      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
        sendUpdates: attendeeEmail ? 'all' : 'none',
      })

      const result: CalendarEventResult = {
        googleEventId: response.data.id!,
        googleEventLink: response.data.htmlLink || null,
        googleCalendarId: calendarId,
      }

      logger.info(`[GCAL] Event created: ${result.googleEventId} for workspace ${workspaceId}`)
      return result
    } catch (error) {
      logger.error(`[GCAL] Failed to create event for workspace ${workspaceId}:`, error)
      // Don't throw - booking should succeed even if GCal fails
      return null
    }
  }

  /**
   * Delete a Google Calendar event when appointment is cancelled
   */
  async deleteEvent(workspaceId: string, googleEventId: string): Promise<boolean> {
    try {
      const calendar = await this.getCalendarClient(workspaceId)
      if (!calendar) {
        logger.warn(`[GCAL] No calendar connection for workspace ${workspaceId}, skipping event deletion`)
        return false
      }

      const connection = await prisma.googleCalendarConnection.findUnique({
        where: { workspaceId },
        select: { calendarId: true },
      })
      const calendarId = connection?.calendarId || 'primary'

      await calendar.events.delete({
        calendarId,
        eventId: googleEventId,
        sendUpdates: 'all',
      })

      logger.info(`[GCAL] Event deleted: ${googleEventId} for workspace ${workspaceId}`)
      return true
    } catch (error: any) {
      // 410 Gone = already deleted, which is fine
      if (error?.code === 410 || error?.status === 410) {
        logger.info(`[GCAL] Event ${googleEventId} already deleted (410 Gone)`)
        return true
      }
      logger.error(`[GCAL] Failed to delete event ${googleEventId}:`, error)
      return false
    }
  }

  /**
   * Update a Google Calendar event (for reschedule)
   */
  async updateEvent(params: UpdateEventParams): Promise<CalendarEventResult | null> {
    const { workspaceId, googleEventId, summary, description, startTime, endTime, timezone, attendeeEmail } = params

    try {
      const calendar = await this.getCalendarClient(workspaceId)
      if (!calendar) {
        logger.warn(`[GCAL] No calendar connection for workspace ${workspaceId}, skipping event update`)
        return null
      }

      const connection = await prisma.googleCalendarConnection.findUnique({
        where: { workspaceId },
        select: { calendarId: true },
      })
      const calendarId = connection?.calendarId || 'primary'

      const event: calendar_v3.Schema$Event = {
        summary,
        description: description || undefined,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: timezone,
        },
      }

      if (attendeeEmail) {
        event.attendees = [{ email: attendeeEmail }]
      }

      const response = await calendar.events.update({
        calendarId,
        eventId: googleEventId,
        requestBody: event,
        sendUpdates: attendeeEmail ? 'all' : 'none',
      })

      const result: CalendarEventResult = {
        googleEventId: response.data.id!,
        googleEventLink: response.data.htmlLink || null,
        googleCalendarId: calendarId,
      }

      logger.info(`[GCAL] Event updated: ${result.googleEventId} for workspace ${workspaceId}`)
      return result
    } catch (error) {
      logger.error(`[GCAL] Failed to update event ${googleEventId}:`, error)
      return null
    }
  }

  /**
   * Get an authenticated Google Calendar client for a workspace.
   * Handles automatic token refresh if token is expired or about to expire.
   */
  private async getCalendarClient(workspaceId: string): Promise<calendar_v3.Calendar | null> {
    const connection = await prisma.googleCalendarConnection.findUnique({
      where: { workspaceId },
    })

    if (!connection || !connection.isActive) {
      return null
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      logger.error('[GCAL] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured')
      return null
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)

    // Check if token needs refresh
    const now = Date.now()
    const tokenExpiryMs = connection.tokenExpiry.getTime()
    const needsRefresh = tokenExpiryMs - now < TOKEN_REFRESH_BUFFER_MS

    if (needsRefresh && connection.refreshToken) {
      try {
        logger.info(`[GCAL] Refreshing token for workspace ${workspaceId}`)
        oauth2Client.setCredentials({ refresh_token: connection.refreshToken })
        const { credentials } = await oauth2Client.refreshAccessToken()

        // Update DB with new token
        const newExpiry = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : new Date(Date.now() + 3600 * 1000) // default 1h

        await prisma.googleCalendarConnection.update({
          where: { workspaceId },
          data: {
            accessToken: credentials.access_token!,
            tokenExpiry: newExpiry,
            errorMessage: null,
          },
        })

        oauth2Client.setCredentials({
          access_token: credentials.access_token,
          refresh_token: connection.refreshToken,
        })

        logger.info(`[GCAL] Token refreshed for workspace ${workspaceId}, expires at ${newExpiry.toISOString()}`)
      } catch (error) {
        logger.error(`[GCAL] Token refresh failed for workspace ${workspaceId}:`, error)

        // Mark connection as errored
        await prisma.googleCalendarConnection.update({
          where: { workspaceId },
          data: {
            errorMessage: `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        })

        return null
      }
    } else {
      // Token still valid, use it directly
      oauth2Client.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken,
      })
    }

    return google.calendar({ version: 'v3', auth: oauth2Client })
  }
}

// Singleton instance
export const googleCalendarService = new GoogleCalendarService()
