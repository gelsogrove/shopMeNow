/**
 * Appointment API Service
 * 
 * Client-side API calls for appointment booking system
 */

import { api } from './api';

// ============================================
// TYPES
// ============================================

export interface BusinessHours {
  id: string;
  workspaceId: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlackoutPeriod {
  id: string;
  workspaceId: string;
  startDate: string; // ISO timestamp
  endDate: string; // ISO timestamp
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// BUSINESS HOURS API (AppointmentType CRUD removed — use Services with enableForBooking)
// ============================================

export interface UpdateBusinessHoursDto {
  hours: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>;
}

export interface CreateBlackoutPeriodDto {
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface UpdateBlackoutPeriodDto {
  startDate?: string;
  endDate?: string;
  reason?: string;
}

// ============================================
// BUSINESS HOURS API
// ============================================

export const businessHoursApi = {
  /**
   * Get business hours
   */
  async getBusinessHours(workspaceId: string): Promise<BusinessHours[]> {
    const { data } = await api.get(
      `/api/workspaces/${workspaceId}/business-hours`
    );
    return data;
  },

  /**
   * Update business hours (bulk upsert)
   */
  async updateBusinessHours(
    workspaceId: string,
    dto: UpdateBusinessHoursDto
  ): Promise<BusinessHours[]> {
    const { data } = await api.put(
      `/api/workspaces/${workspaceId}/business-hours`,
      dto
    );
    return data;
  },
};

// ============================================
// BLACKOUT PERIODS API
// ============================================

export const blackoutPeriodApi = {
  /**
   * Get blackout periods
   */
  async getBlackoutPeriods(workspaceId: string, includeExpired = false): Promise<BlackoutPeriod[]> {
    const { data } = await api.get(
      `/api/workspaces/${workspaceId}/blackout-periods`,
      { params: { includeExpired } }
    );
    return data;
  },

  /**
   * Create blackout period
   */
  async createBlackoutPeriod(
    workspaceId: string,
    dto: CreateBlackoutPeriodDto
  ): Promise<BlackoutPeriod> {
    const { data } = await api.post(
      `/api/workspaces/${workspaceId}/blackout-periods`,
      dto
    );
    return data;
  },

  /**
   * Update blackout period
   */
  async updateBlackoutPeriod(
    workspaceId: string,
    id: string,
    dto: UpdateBlackoutPeriodDto
  ): Promise<BlackoutPeriod> {
    const { data } = await api.patch(
      `/api/workspaces/${workspaceId}/blackout-periods/${id}`,
      dto
    );
    return data;
  },

  /**
   * Delete blackout period
   */
  async deleteBlackoutPeriod(workspaceId: string, id: string): Promise<void> {
    await api.delete(
      `/api/workspaces/${workspaceId}/blackout-periods/${id}`
    );
  },
};

// ============================================
// APPOINTMENTS API (booked appointments)
// ============================================

export interface Appointment {
  id: string;
  workspaceId: string;
  customerId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  status: string;
  customerNotes?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  bookedVia: string;
  createdAt: string;
  updatedAt: string;
  service?: {
    id: string;
    name: string;
    description?: string;
    duration: number;
    bufferTime?: number;
    price?: number;
    color?: string;
  };
}

export const appointmentsApi = {
  async getAppointments(workspaceId: string, params?: {
    status?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<Appointment[]> {
    const { data } = await api.get(
      `/api/workspaces/${workspaceId}/appointments`,
      { params }
    );
    return data;
  },

  async cancelAppointment(workspaceId: string, appointmentId: string, reason?: string): Promise<Appointment> {
    const { data } = await api.patch(
      `/api/workspaces/${workspaceId}/appointments/${appointmentId}/cancel`,
      { reason }
    );
    return data;
  },
};

// ============================================
// GOOGLE CALENDAR CONNECTION
// ============================================

export interface CalendarConnectionStatus {
  connected: boolean;
  email: string | null;
  calendarId: string | null;
  lastSyncAt: string | null;
  connectedAt: string | null;
}

export const calendarConnectionApi = {
  async getStatus(workspaceId: string): Promise<CalendarConnectionStatus> {
    const { data } = await api.get(`/workspaces/${workspaceId}/calendar-connection`);
    return data;
  },

  async getOAuthUrl(workspaceId: string): Promise<{ url: string }> {
    const { data } = await api.get(`/workspaces/${workspaceId}/calendar-connection/oauth-url`);
    return data;
  },

  async disconnect(workspaceId: string): Promise<{ success: boolean; message: string }> {
    const { data } = await api.delete(`/workspaces/${workspaceId}/calendar-connection`);
    return data;
  },
};
