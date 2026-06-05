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

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000 // Refresh 5 min before expiry
const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2'

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
    const { workspaceId, topic, startTime, duration, timezone, attendeeEmail } = params

    try {
      const axiosInstance = await this.getZoomClient(workspaceId)
      if (!axiosInstance) {
        logger.warn(`[ZOOM] No Zoom connection for workspace ${workspaceId}, skipping meeting creation`)
        return null
      }

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

      const response = await axiosInstance.post('/users/me/meetings', meetingData)

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
      const axiosInstance = await this.getZoomClient(workspaceId)
      if (!axiosInstance) {
        logger.warn(`[ZOOM] No Zoom connection for workspace ${workspaceId}, skipping meeting deletion`)
        return false
      }

      await axiosInstance.delete(`/meetings/${zoomMeetingId}`)

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

  /**
   * Get authenticated Zoom API client
   */
  private async getZoomClient(workspaceId: string): Promise<AxiosInstance | null> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        zoomAccessToken: true,
        zoomRefreshToken: true,
        zoomConnected: true,
      },
    })

    if (!workspace || !workspace.zoomConnected || !workspace.zoomAccessToken) {
      return null
    }

    // TODO: Implement token refresh logic
    // For now, use the stored access token
    return axios.create({
      baseURL: ZOOM_API_BASE_URL,
      headers: {
        Authorization: `Bearer ${workspace.zoomAccessToken}`,
      },
    })
  }
}

export const zoomService = new ZoomService()
