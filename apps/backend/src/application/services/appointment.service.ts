/**
 * Appointment Service
 * 
 * Business logic for appointment booking system.
 * Uses Services with enableForBooking=true as bookable appointment types.
 * Orchestrates repositories and enforces business rules.
 */

import { PrismaClient } from '@echatbot/database';
import { BusinessHoursRepository } from '../../repositories/business-hours.repository';
import { BlackoutPeriodRepository } from '../../repositories/blackout-period.repository';
import { zoomService } from '../../services/zoom.service';
import { sendAppointmentConfirmationEmail } from '../../services/appointment-confirmation-email.service';
import { generateGoogleCalendarUrl } from '../../utils/ics-generator';
import logger from '../../utils/logger';

export class AppointmentService {
  private businessHoursRepo: BusinessHoursRepository;
  private blackoutPeriodRepo: BlackoutPeriodRepository;

  constructor(private prisma: PrismaClient) {
    this.businessHoursRepo = new BusinessHoursRepository(prisma);
    this.blackoutPeriodRepo = new BlackoutPeriodRepository(prisma);
  }

  // ============================================
  // BOOKABLE SERVICES (replaces AppointmentType CRUD)
  // ============================================

  async getBookableServices(workspaceId: string, includeInactive = false) {
    return await this.prisma.services.findMany({
      where: {
        workspaceId,
        enableForBooking: true,
        ...(includeInactive ? {} : { isActive: true })
      },
      orderBy: { name: 'asc' }
    });
  }

  async getBookableService(workspaceId: string, id: string) {
    const service = await this.prisma.services.findFirst({
      where: { id, workspaceId, enableForBooking: true }
    });
    if (!service) {
      throw new Error('Bookable service not found');
    }
    return service;
  }

  // ============================================
  // BUSINESS HOURS
  // ============================================

  async getBusinessHours(workspaceId: string, includeInactive = false) {
    return await this.businessHoursRepo.findByWorkspace(workspaceId, includeInactive);
  }

  async updateBusinessHours(workspaceId: string, hours: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }>) {
    // Validate all hours first
    for (const day of hours) {
      if (day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        throw new Error(`Invalid dayOfWeek: ${day.dayOfWeek}. Must be 0-6 (Sunday-Saturday)`);
      }

      if (!this.isValidTime(day.startTime)) {
        throw new Error(`Invalid startTime format: ${day.startTime}. Use HH:mm format (e.g., "09:00")`);
      }

      if (!this.isValidTime(day.endTime)) {
        throw new Error(`Invalid endTime format: ${day.endTime}. Use HH:mm format (e.g., "17:00")`);
      }

      if (day.startTime >= day.endTime) {
        throw new Error(`startTime must be before endTime for day ${day.dayOfWeek}`);
      }
    }

    // Bulk upsert all hours
    return await this.businessHoursRepo.bulkUpsert(workspaceId, hours);
  }

  private isValidTime(time: string): boolean {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
  }

  // ============================================
  // BLACKOUT PERIODS
  // ============================================

  async getBlackoutPeriods(workspaceId: string, includeExpired = false) {
    return await this.blackoutPeriodRepo.findByWorkspace(workspaceId, includeExpired);
  }

  async createBlackoutPeriod(workspaceId: string, data: {
    startDate: Date;
    endDate: Date;
    reason?: string;
  }) {
    // Validate dates
    if (data.startDate >= data.endDate) {
      throw new Error('startDate must be before endDate');
    }

    const now = new Date();
    if (data.endDate < now) {
      throw new Error('Cannot create blackout period in the past');
    }

    return await this.blackoutPeriodRepo.create(workspaceId, data);
  }

  async updateBlackoutPeriod(workspaceId: string, id: string, data: {
    startDate?: Date;
    endDate?: Date;
    reason?: string;
  }) {
    // Verify blackout period exists
    const existing = await this.blackoutPeriodRepo.findById(workspaceId, id);
    if (!existing) {
      throw new Error('Blackout period not found');
    }

    // Validate dates if provided
    const startDate = data.startDate || existing.startDate;
    const endDate = data.endDate || existing.endDate;

    if (startDate >= endDate) {
      throw new Error('startDate must be before endDate');
    }

    const result = await this.blackoutPeriodRepo.update(workspaceId, id, data);
    
    if (result.count === 0) {
      throw new Error('Blackout period not found');
    }

    return await this.blackoutPeriodRepo.findById(workspaceId, id);
  }

  async deleteBlackoutPeriod(workspaceId: string, id: string) {
    // Verify blackout period exists
    const existing = await this.blackoutPeriodRepo.findById(workspaceId, id);
    if (!existing) {
      throw new Error('Blackout period not found');
    }

    return await this.blackoutPeriodRepo.delete(workspaceId, id);
  }

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  /**
   * Check if a specific date/time is available for booking.
   * Checks: blackout periods, business hours, existing confirmed appointments.
   */
  async isSlotAvailable(workspaceId: string, date: Date, durationMinutes: number, excludeAppointmentId?: string): Promise<{
    available: boolean;
    reason?: string;
  }> {
    const slotEndTime = new Date(date.getTime() + durationMinutes * 60 * 1000);

    // 0. Minimum booking buffer check (configurable per workspace, default 12h)
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { minBookingBufferHours: true } });
    const bufferHours = workspace?.minBookingBufferHours ?? 12;
    const minBookingTime = new Date(Date.now() + bufferHours * 60 * 60 * 1000);
    if (date < minBookingTime) {
      return { available: false, reason: `Slot must be at least ${bufferHours} hours in the future` };
    }

    // 1. Blackout period check
    const isBlocked = await this.blackoutPeriodRepo.isDateBlocked(workspaceId, date);
    if (isBlocked) {
      return { available: false, reason: 'Date falls within a closure period' };
    }

    // 2. Business hours check
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
    const businessHours = await this.businessHoursRepo.findByDay(workspaceId, dayOfWeek);
    
    if (!businessHours || !businessHours.isActive) {
      return { available: false, reason: 'Outside business hours (day closed)' };
    }

    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const endTimeStr = `${String(slotEndTime.getHours()).padStart(2, '0')}:${String(slotEndTime.getMinutes()).padStart(2, '0')}`;
    
    if (timeStr < businessHours.startTime || endTimeStr > businessHours.endTime) {
      return { available: false, reason: `Outside business hours (${businessHours.startTime}-${businessHours.endTime})` };
    }

    // 3. Existing confirmed appointments overlap check
    const conflictingAppointment = await this.prisma.appointment.findFirst({
      where: {
        workspaceId,
        status: { in: ['confirmed', 'pending'] },
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
        // Overlap: existing.startTime < slotEnd AND existing.endTime > slotStart
        startTime: { lt: slotEndTime },
        endTime: { gt: date },
      },
    });

    if (conflictingAppointment) {
      return { available: false, reason: 'Slot already booked' };
    }

    return { available: true };
  }

  /**
   * Generate all available slots for a given bookable service and date range.
   * Used by LLM calling function to show customer available options.
   * 
   * @param workspaceId 
   * @param serviceId - ID of the bookable service
   * @param startDate - beginning of search range
   * @param endDate - end of search range (max 14 days from startDate enforced)
   * @returns Array of { startTime, endTime, displayTime } available slots
   */
  async getAvailableSlots(
    workspaceId: string,
    serviceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    startTime: Date;
    endTime: Date;
    displayDate: string; // "2025-04-14" (ISO format - LLM formats in customer's language)
    displayTime: string; // "09:00 - 10:00"
  }>> {
    // Cap search window at 14 days to prevent abuse
    const maxEnd = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    const effectiveEnd = endDate > maxEnd ? maxEnd : endDate;

    // Get bookable service for duration and buffer
    const service = await this.prisma.services.findFirst({
      where: { id: serviceId, workspaceId, enableForBooking: true }
    });
    if (!service || !service.isActive) {
      throw new Error('Bookable service not found or inactive');
    }

    const totalSlotMinutes = service.duration + (service.bufferTime || 0);

    // Get workspace booking buffer (configurable, default 12h)
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { minBookingBufferHours: true } });
    const bufferHours = workspace?.minBookingBufferHours ?? 12;
    const minBookingBuffer = new Date(Date.now() + bufferHours * 60 * 60 * 1000);

    // Get business hours for all days
    const allBusinessHours = await this.businessHoursRepo.findByWorkspace(workspaceId, false);
    const hoursByDay = new Map(allBusinessHours.map(bh => [bh.dayOfWeek, bh]));

    // Get blackout periods overlapping the range
    const blackouts = await this.blackoutPeriodRepo.findByWorkspace(workspaceId, false);
    const activeBlackouts = blackouts.filter(b =>
      b.startDate <= effectiveEnd && b.endDate >= startDate
    );

    // Get all existing confirmed appointments in range
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        workspaceId,
        status: { in: ['confirmed'] },
        startTime: { lt: effectiveEnd },
        endTime: { gt: startDate },
      },
      select: { startTime: true, endTime: true },
    });

    const slots: Array<{
      startTime: Date;
      endTime: Date;
      displayDate: string;
      displayTime: string;
    }> = [];

    const slotIntervalMinutes = 30; // Slots every 30 minutes

    // Iterate day by day
    const current = new Date(startDate);
    current.setSeconds(0, 0);

    while (current < effectiveEnd) {
      const day = current.getDay();
      const businessHours = hoursByDay.get(day);

      if (businessHours && businessHours.isActive) {
        const [startHour, startMin] = businessHours.startTime.split(':').map(Number);
        const [endHour, endMin] = businessHours.endTime.split(':').map(Number);

        // Start scanning from business hours open
        const dayStart = new Date(current);
        dayStart.setHours(startHour, startMin, 0, 0);

        const dayEnd = new Date(current);
        dayEnd.setHours(endHour, endMin, 0, 0);

        let slotStart = new Date(Math.max(dayStart.getTime(), startDate.getTime()));
        // Round up to next slot boundary
        const slotMinutes = slotStart.getMinutes();
        const roundUp = Math.ceil(slotMinutes / slotIntervalMinutes) * slotIntervalMinutes;
        if (roundUp !== slotMinutes) {
          slotStart.setMinutes(roundUp, 0, 0);
        }

        while (slotStart < dayEnd) {
          const slotEnd = new Date(slotStart.getTime() + totalSlotMinutes * 60 * 1000);
          
          if (slotEnd > dayEnd) break;

          // Skip past slots — must be at least minBookingBufferHours in the future
          if (slotStart < minBookingBuffer) {
            slotStart = new Date(slotStart.getTime() + slotIntervalMinutes * 60 * 1000);
            continue;
          }

          // Check blackout
          const inBlackout = activeBlackouts.some(b =>
            b.startDate <= slotStart && b.endDate >= slotEnd
          );

          if (!inBlackout) {
            // Check existing appointments conflict
            const hasConflict = existingAppointments.some(appt =>
              appt.startTime < slotEnd && appt.endTime > slotStart
            );

            if (!hasConflict) {
              // Format: "13 aprile lunedì" — no year (redundant), with weekday
              // Translation layer converts month/weekday to customer's language
              const displayDate = slotStart.toLocaleDateString('it-IT', {
                day: 'numeric',
                month: 'long',
                weekday: 'long',
              });
              const displayTime = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')} - ${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}`;

              slots.push({
                startTime: new Date(slotStart),
                endTime: new Date(slotEnd),
                displayDate,
                displayTime,
              });
            }
          }

          slotStart = new Date(slotStart.getTime() + slotIntervalMinutes * 60 * 1000);
        }
      }

      // Move to next day
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }

    return slots;
  }

  // ============================================
  // CONFIRMED APPOINTMENT MANAGEMENT
  // ============================================

  /**
   * Create a confirmed appointment (called by LLM bookAppointment function)
   */
  async createAppointment(workspaceId: string, data: {
    customerId: string;
    serviceId: string;
    startTime: Date;
    customerNotes?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    bookedVia?: string;
    googleEventId?: string;
    googleEventLink?: string;
  }) {
    const service = await this.prisma.services.findFirst({
      where: { id: data.serviceId, workspaceId, enableForBooking: true }
    });
    if (!service || !service.isActive) {
      throw new Error('Bookable service not found or inactive');
    }

    const totalMinutes = service.duration + (service.bufferTime || 0);
    const endTime = new Date(data.startTime.getTime() + totalMinutes * 60 * 1000);

    // Validate slot is still available
    const availability = await this.isSlotAvailable(workspaceId, data.startTime, service.duration);
    if (!availability.available) {
      throw new Error(`Slot no longer available: ${availability.reason}`);
    }

    // Create appointment
    const appointment = await this.prisma.appointment.create({
      data: {
        workspaceId,
        customerId: data.customerId,
        serviceId: data.serviceId,
        startTime: data.startTime,
        endTime,
        customerNotes: data.customerNotes,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        bookedVia: data.bookedVia || 'whatsapp',
        googleEventId: data.googleEventId,
        googleEventLink: data.googleEventLink,
        status: 'confirmed',
      },
      include: { service: true },
    });

    // Update customer's lastAppointmentDate
    await this.prisma.customers.update({
      where: { id: data.customerId },
      data: { lastAppointmentDate: new Date() },
    }).catch(() => {}); // Silently ignore if customer not found

    // 🎥 Create Zoom meeting if workspace has Zoom enabled
    let zoomLink: string | undefined;
    let zoomMeetingId: string | undefined;
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { zoomConnected: true, timezone: true },
      });

      if (workspace?.zoomConnected) {
        const zoomResult = await zoomService.createMeeting({
          workspaceId,
          topic: `${service.name} - ${data.customerName || 'Guest'}`,
          startTime: data.startTime,
          duration: service.duration,
          timezone: workspace.timezone || 'Europe/Rome',
          attendeeEmail: data.customerEmail,
        });

        if (zoomResult) {
          zoomLink = zoomResult.zoomLink;
          zoomMeetingId = zoomResult.zoomMeetingId;

          // Update appointment with Zoom link
          await this.prisma.appointment.update({
            where: { id: appointment.id },
            data: {
              zoomLink,
              zoomMeetingId,
            },
          });
        }
      }
    } catch (err) {
      logger.error(`[APPOINTMENT] Failed to create Zoom meeting for ${appointment.id}:`, err);
    }

    // 📧 Send confirmation email if customer has email
    if (data.customerEmail) {
      try {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { timezone: true },
        });

        // Format date/time for email (TODO: multi-language support)
        const formatter = new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: workspace?.timezone || 'Europe/Rome',
        });
        const timeFormatter = new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: workspace?.timezone || 'Europe/Rome',
        });

        const appointmentDate = formatter.format(data.startTime);
        const appointmentTime = timeFormatter.format(data.startTime);
        const googleCalendarLink = generateGoogleCalendarUrl({
          summary: `${service.name} - ${data.customerName || 'Guest'}`,
          startTime: data.startTime,
          endTime,
          timezone: workspace?.timezone || 'Europe/Rome',
          description: zoomLink ? `Zoom: ${zoomLink}` : undefined,
        });

        await sendAppointmentConfirmationEmail({
          to: data.customerEmail,
          customerName: data.customerName || 'Guest',
          appointmentType: service.name,
          appointmentDate,
          appointmentTime,
          startTime: data.startTime,
          endTime,
          timezone: workspace?.timezone || 'Europe/Rome',
          zoomLink,
          googleCalendarLink,
          language: 'en', // TODO: use customer language
        });
      } catch (err) {
        logger.error(`[APPOINTMENT] Failed to send confirmation email for ${appointment.id}:`, err);
      }
    }

    logger.info(`[APPOINTMENT] Created appointment ${appointment.id} for customer ${data.customerId} at ${data.startTime}`);
    return {
      ...appointment,
      zoomLink,
      zoomMeetingId,
    };
  }

  /**
   * Cancel an appointment (called by LLM cancelAppointment function)
   */
  async cancelAppointment(workspaceId: string, appointmentId: string, reason?: string, cancelledBy = 'customer') {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, workspaceId },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status === 'cancelled') {
      throw new Error('Appointment is already cancelled');
    }

    return await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelledBy,
      },
      include: { service: true },
    });
  }

  /**
   * Get customer's upcoming appointments (for LLM context)
   */
  async getCustomerAppointments(workspaceId: string, customerId: string, limit = 5) {
    return await this.prisma.appointment.findMany({
      where: {
        workspaceId,
        customerId,
        status: 'confirmed',
        startTime: { gte: new Date() },
      },
      include: { service: true },
      orderBy: { startTime: 'asc' },
      take: limit,
    });
  }

  /**
   * Get all appointments for workspace (admin panel)
   */
  async getWorkspaceAppointments(workspaceId: string, options?: {
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    return await this.prisma.appointment.findMany({
      where: {
        workspaceId,
        status: options?.status || undefined,
        startTime: {
          gte: options?.from || undefined,
          lte: options?.to || undefined,
        },
      },
      include: { service: true },
      orderBy: { startTime: 'asc' },
      take: options?.limit || 100,
    });
  }
}

