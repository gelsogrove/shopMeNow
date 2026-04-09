/**
 * Appointment Controller
 * 
 * HTTP handlers for appointment booking endpoints.
 * Handles: AppointmentTypes, BusinessHours, BlackoutPeriods
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@echatbot/database';
import { AppointmentService } from '../../../application/services/appointment.service';
import logger from '../../../utils/logger';

const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

export class AppointmentController {
  private appointmentService: AppointmentService;

  constructor(private prisma: PrismaClient) {
    this.appointmentService = new AppointmentService(prisma);
  }

  // ============================================
  // APPOINTMENT TYPES
  // ============================================

  /**
   * GET /api/workspaces/:workspaceId/appointment-types
   * Get all appointment types for workspace
   */
  async getAppointmentTypes(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId; // Set by middleware
      const includeInactive = req.query.includeInactive === 'true';

      const types = await this.appointmentService.getAppointmentTypes(
        workspaceId,
        includeInactive
      );

      return res.json(types);
    } catch (error) {
      logger.error('Failed to get appointment types:', error);
      return res.status(500).json({
        error: 'Failed to get appointment types',
        message: error.message
      });
    }
  }

  /**
   * GET /api/workspaces/:workspaceId/appointment-types/:id
   * Get single appointment type
   */
  async getAppointmentType(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { id } = req.params;

      const type = await this.appointmentService.getAppointmentType(workspaceId, id);

      return res.json(type);
    } catch (error) {
      logger.error('Failed to get appointment type:', error);
      const statusCode = error.message === 'Appointment type not found' ? 404 : 500;
      return res.status(statusCode).json({
        error: 'Failed to get appointment type',
        message: error.message
      });
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/appointment-types
   * Create new appointment type
   */
  async createAppointmentType(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { name, description, duration, bufferTime, price, color } = req.body;

      if (!name || !duration) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'name and duration are required'
        });
      }

      const type = await this.appointmentService.createAppointmentType(workspaceId, {
        name,
        description,
        duration: parseInt(duration),
        bufferTime: bufferTime ? parseInt(bufferTime) : undefined,
        price: price ? parseFloat(price) : undefined,
        color
      });

      return res.status(201).json(type);
    } catch (error) {
      logger.error('Failed to create appointment type:', error);
      const statusCode = error.message.includes('must be') ? 400 : 500;
      return res.status(statusCode).json({
        error: 'Failed to create appointment type',
        message: error.message
      });
    }
  }

  /**
   * PATCH /api/workspaces/:workspaceId/appointment-types/:id
   * Update appointment type
   */
  async updateAppointmentType(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { id } = req.params;
      const { name, description, duration, bufferTime, price, color, isActive } = req.body;

      const type = await this.appointmentService.updateAppointmentType(workspaceId, id, {
        name,
        description,
        duration: duration ? parseInt(duration) : undefined,
        bufferTime: bufferTime !== undefined ? parseInt(bufferTime) : undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        color,
        isActive
      });

      return res.json(type);
    } catch (error) {
      logger.error('Failed to update appointment type:', error);
      const statusCode = error.message === 'Appointment type not found' ? 404 
        : error.message.includes('must be') ? 400 : 500;
      return res.status(statusCode).json({
        error: 'Failed to update appointment type',
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/workspaces/:workspaceId/appointment-types/:id
   * Delete (deactivate) appointment type
   */
  async deleteAppointmentType(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { id } = req.params;

      await this.appointmentService.deleteAppointmentType(workspaceId, id);

      return res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete appointment type:', error);
      const statusCode = error.message === 'Appointment type not found' ? 404 
        : error.message.includes('pending appointments') ? 400 : 500;
      return res.status(statusCode).json({
        error: 'Failed to delete appointment type',
        message: error.message
      });
    }
  }

  // ============================================
  // BUSINESS HOURS
  // ============================================

  /**
   * GET /api/workspaces/:workspaceId/business-hours
   * Get business hours for workspace
   */
  async getBusinessHours(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const includeInactive = req.query.includeInactive === 'true';

      const hours = await this.appointmentService.getBusinessHours(
        workspaceId,
        includeInactive
      );

      return res.json(hours);
    } catch (error) {
      logger.error('Failed to get business hours:', error);
      return res.status(500).json({
        error: 'Failed to get business hours',
        message: error.message
      });
    }
  }

  /**
   * PUT /api/workspaces/:workspaceId/business-hours
   * Update business hours (bulk upsert all days)
   */
  async updateBusinessHours(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { hours } = req.body;

      if (!Array.isArray(hours)) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'hours must be an array'
        });
      }

      const result = await this.appointmentService.updateBusinessHours(workspaceId, hours);

      return res.json(result);
    } catch (error) {
      logger.error('Failed to update business hours:', error);
      const statusCode = error.message.includes('Invalid') ? 400 : 500;
      return res.status(statusCode).json({
        error: 'Failed to update business hours',
        message: error.message
      });
    }
  }

  // ============================================
  // BLACKOUT PERIODS
  // ============================================

  /**
   * GET /api/workspaces/:workspaceId/blackout-periods
   * Get blackout periods for workspace
   */
  async getBlackoutPeriods(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const includeExpired = req.query.includeExpired === 'true';

      const periods = await this.appointmentService.getBlackoutPeriods(
        workspaceId,
        includeExpired
      );

      return res.json(periods);
    } catch (error) {
      logger.error('Failed to get blackout periods:', error);
      return res.status(500).json({
        error: 'Failed to get blackout periods',
        message: error.message
      });
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/blackout-periods
   * Create new blackout period
   */
  async createBlackoutPeriod(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { startDate, endDate, reason } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'startDate and endDate are required'
        });
      }

      const period = await this.appointmentService.createBlackoutPeriod(workspaceId, {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason
      });

      return res.status(201).json(period);
    } catch (error) {
      logger.error('Failed to create blackout period:', error);
      const statusCode = error.message.includes('must be') || error.message.includes('Cannot create') 
        ? 400 : 500;
      return res.status(statusCode).json({
        error: 'Failed to create blackout period',
        message: error.message
      });
    }
  }

  /**
   * PATCH /api/workspaces/:workspaceId/blackout-periods/:id
   * Update blackout period
   */
  async updateBlackoutPeriod(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { id } = req.params;
      const { startDate, endDate, reason } = req.body;

      const period = await this.appointmentService.updateBlackoutPeriod(workspaceId, id, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        reason
      });

      return res.json(period);
    } catch (error) {
      logger.error('Failed to update blackout period:', error);
      const statusCode = error.message === 'Blackout period not found' ? 404 
        : error.message.includes('must be') ? 400 : 500;
      return res.status(statusCode).json({
        error: 'Failed to update blackout period',
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/workspaces/:workspaceId/blackout-periods/:id
   * Delete blackout period
   */
  async deleteBlackoutPeriod(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { id } = req.params;

      await this.appointmentService.deleteBlackoutPeriod(workspaceId, id);

      return res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete blackout period:', error);
      const statusCode = error.message === 'Blackout period not found' ? 404 : 500;
      return res.status(statusCode).json({
        error: 'Failed to delete blackout period',
        message: error.message
      });
    }
  }

  // ============================================
  // AVAILABLE SLOTS
  // ============================================

  /**
   * GET /api/workspaces/:workspaceId/appointments/slots
   * Get available time slots for booking.
   * Query params: appointmentTypeId, startDate (ISO), endDate (ISO)
   */
  async getAvailableSlots(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { appointmentTypeId, startDate, endDate } = req.query;

      if (!appointmentTypeId || !startDate || !endDate) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'appointmentTypeId, startDate, and endDate are required query parameters',
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid date format. Use ISO 8601 (e.g., 2026-04-15T09:00:00Z)',
        });
      }

      if (end <= start) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'endDate must be after startDate',
        });
      }

      const slots = await this.appointmentService.getAvailableSlots(
        workspaceId,
        appointmentTypeId as string,
        start,
        end
      );

      return res.json({
        appointmentTypeId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalSlots: slots.length,
        slots,
      });
    } catch (error) {
      logger.error('Failed to get available slots:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        error: 'Failed to get available slots',
        message: error.message,
      });
    }
  }

  // ============================================
  // CONFIRMED APPOINTMENTS
  // ============================================

  /**
   * GET /api/workspaces/:workspaceId/appointments
   * List appointments for admin panel
   */
  async getAppointments(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { status, from, to, limit } = req.query;

      const appointments = await this.appointmentService.getWorkspaceAppointments(workspaceId, {
        status: status as string | undefined,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      return res.json(appointments);
    } catch (error) {
      logger.error('Failed to get appointments:', error);
      return res.status(500).json({
        error: 'Failed to get appointments',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/appointments
   * Create confirmed appointment (admin)
   */
  async createAppointment(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { customerId, appointmentTypeId, startTime, customerNotes, customerName, customerPhone, customerEmail, bookedVia } = req.body;

      if (!customerId || !appointmentTypeId || !startTime) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'customerId, appointmentTypeId, and startTime are required',
        });
      }

      const appointment = await this.appointmentService.createAppointment(workspaceId, {
        customerId,
        appointmentTypeId,
        startTime: new Date(startTime),
        customerNotes,
        customerName,
        customerPhone,
        customerEmail,
        bookedVia: bookedVia || 'admin',
      });

      return res.status(201).json(appointment);
    } catch (error) {
      logger.error('Failed to create appointment:', error);
      const statusCode = error.message.includes('not found') ? 404
        : error.message.includes('no longer available') ? 409
        : 400;
      return res.status(statusCode).json({
        error: 'Failed to create appointment',
        message: error.message,
      });
    }
  }

  /**
   * PATCH /api/workspaces/:workspaceId/appointments/:id/cancel
   * Cancel an appointment
   */
  async cancelAppointment(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const { id } = req.params;
      const { reason, cancelledBy } = req.body;

      const appointment = await this.appointmentService.cancelAppointment(
        workspaceId,
        id,
        reason,
        cancelledBy || 'admin'
      );

      return res.json(appointment);
    } catch (error) {
      logger.error('Failed to cancel appointment:', error);
      const statusCode = error.message.includes('not found') ? 404
        : error.message.includes('already cancelled') ? 409
        : 500;
      return res.status(statusCode).json({
        error: 'Failed to cancel appointment',
        message: error.message,
      });
    }
  }

  // ============================================
  // GOOGLE CALENDAR CONNECTION
  // ============================================

  /**
   * GET /api/workspaces/:workspaceId/calendar-connection
   * Get Google Calendar connection status for workspace
   */
  async getCalendarConnectionStatus(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;

      const connection = await this.prisma.googleCalendarConnection.findUnique({
        where: { workspaceId },
        select: {
          id: true,
          calendarId: true,
          lastSyncAt: true,
          connectedAt: true,
        },
      });

      return res.json({
        connected: !!connection,
        email: connection?.calendarId || null,
        calendarId: connection?.calendarId || null,
        lastSyncAt: connection?.lastSyncAt || null,
        connectedAt: connection?.connectedAt || null,
      });
    } catch (error) {
      logger.error('Failed to get calendar connection status:', error);
      return res.status(500).json({
        error: 'Failed to get calendar connection status',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/workspaces/:workspaceId/calendar-connection/oauth-url
   * Generate Google OAuth URL for Calendar authorization
   */
  async getGoogleCalendarOAuthUrl(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const clientId = process.env.GOOGLE_CLIENT_ID;

      if (!clientId) {
        return res.status(503).json({
          error: 'Google Calendar integration not configured',
          message: 'GOOGLE_CLIENT_ID is not set',
        });
      }

      const isProduction = process.env.NODE_ENV === 'production';
      const backendUrl = isProduction
        ? (process.env.BACKEND_URL || 'https://api.echatbot.ai')
        : `http://localhost:${process.env.PORT || 3001}`;

      const redirectUri = `${backendUrl}/api/auth/google/calendar/callback`;

      // Encode workspaceId in state for callback retrieval
      const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64');

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: GOOGLE_CALENDAR_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state,
      });

      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      return res.json({ url: oauthUrl });
    } catch (error) {
      logger.error('Failed to generate Google Calendar OAuth URL:', error);
      return res.status(500).json({
        error: 'Failed to generate OAuth URL',
        message: error.message,
      });
    }
  }

  /**
   * DELETE /api/workspaces/:workspaceId/calendar-connection
   * Disconnect Google Calendar for workspace
   */
  async disconnectGoogleCalendar(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;

      const existing = await this.prisma.googleCalendarConnection.findUnique({
        where: { workspaceId },
      });

      if (!existing) {
        return res.status(404).json({
          error: 'No Google Calendar connection found',
        });
      }

      await this.prisma.googleCalendarConnection.delete({
        where: { workspaceId },
      });

      logger.info(`[CALENDAR] Disconnected Google Calendar for workspace ${workspaceId}`);
      return res.json({ success: true, message: 'Google Calendar disconnected successfully' });
    } catch (error) {
      logger.error('Failed to disconnect Google Calendar:', error);
      return res.status(500).json({
        error: 'Failed to disconnect Google Calendar',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/auth/google/calendar/callback
   * Handles Google OAuth callback, exchanges code for tokens, stores connection
   * This route is public (no workspace auth) — workspaceId comes from state param
   */
  async handleGoogleCalendarCallback(req: Request, res: Response) {
    try {
      const { code, state, error: oauthError } = req.query;

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      if (oauthError) {
        logger.warn(`[CALENDAR] Google OAuth error: ${oauthError}`);
        return res.redirect(`${frontendUrl}/settings?tab=calendar&error=oauth_denied`);
      }

      if (!code || !state) {
        return res.redirect(`${frontendUrl}/settings?tab=calendar&error=missing_params`);
      }

      // Decode state to retrieve workspaceId
      let workspaceId: string;
      try {
        const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
        workspaceId = decoded.workspaceId;
      } catch {
        return res.redirect(`${frontendUrl}/settings?tab=calendar&error=invalid_state`);
      }

      if (!workspaceId) {
        return res.redirect(`${frontendUrl}/settings?tab=calendar&error=invalid_state`);
      }

      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      const isProduction = process.env.NODE_ENV === 'production';
      const backendUrl = isProduction
        ? (process.env.BACKEND_URL || 'https://api.echatbot.ai')
        : `http://localhost:${process.env.PORT || 3001}`;
      const redirectUri = `${backendUrl}/api/auth/google/calendar/callback`;

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const tokenError = await tokenResponse.text();
        logger.error('[CALENDAR] Token exchange failed:', tokenError);
        return res.redirect(`${frontendUrl}/settings?tab=calendar&error=token_exchange_failed`);
      }

      const tokens = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope: string;
        token_type: string;
      };

      // Fetch user's calendar info (email + primary calendar ID)
      const calendarListResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/calendarList?maxResults=1',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );

      let calendarEmail: string | null = null;
      let calendarId: string | null = null;

      if (calendarListResponse.ok) {
        const calendarList = await calendarListResponse.json() as { items?: Array<{ id: string; summary: string; primary?: boolean }> };
        const primary = calendarList.items?.find(c => c.primary) || calendarList.items?.[0];
        if (primary) {
          calendarId = primary.id;
          calendarEmail = primary.id; // Primary calendar ID is the email address
        }
      }

      // Fetch user email from Google userinfo
      const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userinfoResponse.ok) {
        const userinfo = await userinfoResponse.json() as { email?: string };
        if (userinfo.email) calendarEmail = userinfo.email;
      }

      const tokenExpiry = new Date(Date.now() + (tokens.expires_in * 1000));

      // Upsert the connection (one per workspace)
      await this.prisma.googleCalendarConnection.upsert({
        where: { workspaceId },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiry,
          calendarId: calendarId || 'primary',
          scope: tokens.scope ? [tokens.scope] : undefined,
          lastSyncAt: new Date(),
        },
        create: {
          workspaceId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || '',
          tokenExpiry,
          calendarId: calendarId || 'primary',
          scope: tokens.scope ? [tokens.scope] : [],
        },
      });

      logger.info(`[CALENDAR] Google Calendar connected for workspace ${workspaceId} (${calendarEmail})`);
      return res.redirect(`${frontendUrl}/settings?tab=calendar&connected=true`);
    } catch (error) {
      logger.error('Failed to handle Google Calendar OAuth callback:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/settings?tab=calendar&error=server_error`);
    }
  }
}
