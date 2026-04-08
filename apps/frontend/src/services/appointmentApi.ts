/**
 * Appointment API Service
 * 
 * Client-side API calls for appointment booking system
 */

import { api } from './api';

// ============================================
// TYPES
// ============================================

export interface AppointmentType {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  duration: number; // minutes
  bufferTime?: number; // minutes
  price?: number; // euros
  color?: string; // hex color
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export interface CreateAppointmentTypeDto {
  name: string;
  description?: string;
  duration: number;
  bufferTime?: number;
  price?: number;
  color?: string;
}

export interface UpdateAppointmentTypeDto {
  name?: string;
  description?: string;
  duration?: number;
  bufferTime?: number;
  price?: number;
  color?: string;
  isActive?: boolean;
}

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
// APPOINTMENT TYPES API
// ============================================

export const appointmentApi = {
  /**
   * Get all appointment types
   */
  async getAppointmentTypes(workspaceId: string, includeInactive = false): Promise<AppointmentType[]> {
    const { data } = await api.get(
      `/api/workspaces/${workspaceId}/appointment-types`,
      { params: { includeInactive } }
    );
    return data;
  },

  /**
   * Get single appointment type
   */
  async getAppointmentType(workspaceId: string, id: string): Promise<AppointmentType> {
    const { data } = await api.get(
      `/api/workspaces/${workspaceId}/appointment-types/${id}`
    );
    return data;
  },

  /**
   * Create appointment type
   */
  async createAppointmentType(
    workspaceId: string,
    dto: CreateAppointmentTypeDto
  ): Promise<AppointmentType> {
    const { data } = await api.post(
      `/api/workspaces/${workspaceId}/appointment-types`,
      dto
    );
    return data;
  },

  /**
   * Update appointment type
   */
  async updateAppointmentType(
    workspaceId: string,
    id: string,
    dto: UpdateAppointmentTypeDto
  ): Promise<AppointmentType> {
    const { data } = await api.patch(
      `/api/workspaces/${workspaceId}/appointment-types/${id}`,
      dto
    );
    return data;
  },

  /**
   * Delete (deactivate) appointment type
   */
  async deleteAppointmentType(workspaceId: string, id: string): Promise<void> {
    await api.delete(
      `/api/workspaces/${workspaceId}/appointment-types/${id}`
    );
  },
};

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
  appointmentTypeId: string;
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
  appointmentType?: AppointmentType;
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
