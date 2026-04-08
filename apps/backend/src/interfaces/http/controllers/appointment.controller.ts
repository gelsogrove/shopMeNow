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
}
