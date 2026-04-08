/**
 * AppointmentType Repository
 * 
 * Data access layer for appointment types (e.g., "Consulenza Legale 60min €150")
 * ALWAYS filters by workspaceId for multi-tenant isolation.
 */

import { PrismaClient } from '@echatbot/database';
import logger from '../utils/logger';

export class AppointmentTypeRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all appointment types for a workspace
   */
  async findByWorkspace(workspaceId: string, includeInactive = false) {
    return await this.prisma.appointmentType.findMany({
      where: {
        workspaceId,
        ...(includeInactive ? {} : { isActive: true })
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Find appointment type by ID (with workspace isolation)
   */
  async findById(workspaceId: string, id: string) {
    return await this.prisma.appointmentType.findFirst({
      where: { id, workspaceId }
    });
  }

  /**
   * Create new appointment type
   */
  async create(workspaceId: string, data: {
    name: string;
    description?: string;
    duration: number;
    bufferTime?: number;
    price?: number;
    color?: string;
  }) {
    return await this.prisma.appointmentType.create({
      data: {
        workspaceId,
        name: data.name,
        description: data.description,
        duration: data.duration,
        bufferTime: data.bufferTime ?? 0,
        price: data.price,
        color: data.color ?? '#3b82f6'
      }
    });
  }

  /**
   * Update appointment type
   */
  async update(workspaceId: string, id: string, data: {
    name?: string;
    description?: string;
    duration?: number;
    bufferTime?: number;
    price?: number;
    color?: string;
    isActive?: boolean;
  }) {
    return await this.prisma.appointmentType.updateMany({
      where: { id, workspaceId },
      data
    });
  }

  /**
   * Delete appointment type (soft delete via isActive=false)
   */
  async deactivate(workspaceId: string, id: string) {
    return await this.prisma.appointmentType.updateMany({
      where: { id, workspaceId },
      data: { isActive: false }
    });
  }

  /**
   * Hard delete (use only if no appointments reference this type)
   */
  async delete(workspaceId: string, id: string) {
    return await this.prisma.appointmentType.deleteMany({
      where: { id, workspaceId }
    });
  }
}
