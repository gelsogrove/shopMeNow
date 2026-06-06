/**
 * ZoomService
 *
 * Manages Zoom meeting creation/deletion with OAuth token management.
 * Used by appointmentService to auto-generate Zoom links when appointments are booked.
 *
 * Flow:
 * 1. Get Zoom connection for workspace (accessToken, refreshToken)
 * 2. Auto-refresh token if expired
 * 3. Create/Delete Zoom meetings via Zoom API v2
 * 4. Return zoomLink + zoomMeetingId for DB storage
 */

import axios, { AxiosInstance } from 'axios'
import { prisma } from '@echatbot/database'
import logger from '../utils/logger'

const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2'
const ZOOM_OAUTH_TOKEN_URL = 'https://zoom.us/oauth/token'

interface ZoomMeetingResult {
  zoomLink: string
  zoomMeetingId: string
}

interface CreateMeetingParams {
  workspaceId: string
  topic: string // e.g., "Consulenza franchising - Marco Rossi"
  startTime: Date
  duration: number // minutes
  timezone: string // IANA timezone
  attendeeEmail?: string
}

export class ZoomService {
  /**
   * Create a Zoom meeting for an appointment
   */
  async createMeeting(params: CreateMeetingParams): Promise<ZoomMeetingResult | null> {
    const { workspaceId, topic, startTime, duration, timezone } = params

    const meetingData = {
      topic,
      type: 2, // Scheduled meeting
      start_time: startTime.toISOString().split('.')[0], // Remove milliseconds
      duration,
      timezone,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        auto_recording: 'none',
      },
    }

    try {
      let token = await this.getAccessToken(workspaceId)
      if (!token) {
        logger.warn(`[ZOOM] No Zoom connection for workspace ${workspaceId}, skipping meeting creation`)
        return null
      }

      let response
      try {
        response = await this.buildClient(token).post('/users/me/meetings', meetingData)
      } catch (err: any) {
        // Access token expired (~1h life) → refresh once and retry.
        if (err?.response?.status === 401) {
          token = await this.refreshAccessToken(workspaceId)
          if (!token) return null
          response = await this.buildClient(token).post('/users/me/meetings', meetingData)
        } else {
          throw err
        }
      }

      const zoomLink = response.data.join_url || `https://zoom.us/j/${response.data.id}`
      logger.info(`[ZOOM] Meeting created: ${response.data.id} for workspace ${workspaceId}`)
      return {
        zoomLink,
        zoomMeetingId: String(response.data.id),
      }
    } catch (error) {
      logger.error(`[ZOOM] Failed to create meeting for workspace ${workspaceId}:`, error)
      // Don't throw - booking should succeed even if Zoom fails
      return null
    }
  }

  /**
   * Delete a Zoom meeting when appointment is cancelled
   */
  async deleteMeeting(workspaceId: string, zoomMeetingId: string): Promise<boolean> {
    try {
      let token = await this.getAccessToken(workspaceId)
      if (!token) {
        logger.warn(`[ZOOM] No Zoom connection for workspace ${workspaceId}, skipping meeting deletion`)
        return false
      }

      try {
        await this.buildClient(token).delete(`/meetings/${zoomMeetingId}`)
      } catch (err: any) {
        if (err?.response?.status === 401) {
          token = await this.refreshAccessToken(workspaceId)
          if (!token) return false
          await this.buildClient(token).delete(`/meetings/${zoomMeetingId}`)
        } else {
          throw err
        }
      }

      logger.info(`[ZOOM] Meeting deleted: ${zoomMeetingId} for workspace ${workspaceId}`)
      return true
    } catch (error: any) {
      // 404 = already deleted, which is fine
      if (error?.response?.status === 404) {
        logger.info(`[ZOOM] Meeting ${zoomMeetingId} already deleted (404)`)
        return true
      }
      logger.error(`[ZOOM] Failed to delete meeting ${zoomMeetingId}:`, error)
      return false
    }
  }

  /** Build an axios client bound to a Zoom access token. */
  private buildClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: ZOOM_API_BASE_URL,
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  }

  /** Current stored access token for the workspace, or null if not connected. */
  private async getAccessToken(workspaceId: string): Promise<string | null> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { zoomAccessToken: true, zoomConnected: true },
    })
    if (!workspace || !workspace.zoomConnected || !workspace.zoomAccessToken) {
      return null
    }
    return workspace.zoomAccessToken
  }

  /**
   * Refresh the Zoom access token using the stored refresh token. Persists the
   * rotated access+refresh tokens (Zoom rotates the refresh token on each use).
   * On failure marks the workspace disconnected and returns null so callers
   * degrade to "no Zoom link" instead of looping.
   */
  private async refreshAccessToken(workspaceId: string): Promise<string | null> {
    const clientId = process.env.ZOOM_CLIENT_ID
    const clientSecret = process.env.ZOOM_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      logger.error('[ZOOM] ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET not set — cannot refresh token')
      return null
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { zoomRefreshToken: true },
    })
    if (!workspace?.zoomRefreshToken) return null

    try {
      const resp = await axios.post(
        ZOOM_OAUTH_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: workspace.zoomRefreshToken,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
        }
      )

      const accessToken: string = resp.data.access_token
      const refreshToken: string = resp.data.refresh_token || workspace.zoomRefreshToken

      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { zoomAccessToken: accessToken, zoomRefreshToken: refreshToken },
      })
      logger.info(`[ZOOM] Access token refreshed for workspace ${workspaceId}`)
      return accessToken
    } catch (error) {
      logger.error(`[ZOOM] Token refresh failed for workspace ${workspaceId}:`, error)
      await prisma.workspace
        .update({ where: { id: workspaceId }, data: { zoomConnected: false } })
        .catch(() => undefined)
      return null
    }
  }
}

export const zoomService = new ZoomService()
