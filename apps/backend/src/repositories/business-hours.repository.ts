/**
 * Business Hours Repository
 * 
 * Data access layer for workspace business hours (e.g., "Monday 09:00-17:00")
 * ALWAYS filters by workspaceId for multi-tenant isolation.
 */

import { PrismaClient } from '@echatbot/database';
import logger from '../utils/logger';

export class BusinessHoursRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all business hours for a workspace
   */
  async findByWorkspace(workspaceId: string, includeInactive = false) {
    return await this.prisma.workspaceBusinessHours.findMany({
      where: {
        workspaceId,
        ...(includeInactive ? {} : { isActive: true })
      },
      orderBy: { dayOfWeek: 'asc' }
    });
  }

  /**
   * Find business hours by day of week
   */
  async findByDay(workspaceId: string, dayOfWeek: number) {
    return await this.prisma.workspaceBusinessHours.findUnique({
      where: {
        workspaceId_dayOfWeek: { workspaceId, dayOfWeek }
      }
    });
  }

  /**
   * Upsert business hours for a specific day
   */
  async upsert(workspaceId: string, dayOfWeek: number, data: {
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }) {
    return await this.prisma.workspaceBusinessHours.upsert({
      where: {
        workspaceId_dayOfWeek: { workspaceId, dayOfWeek }
      },
      update: data,
      create: {
        workspaceId,
        dayOfWeek,
        ...data,
        isActive: data.isActive ?? true
      }
    });
  }

  /**
   * Bulk upsert business hours (all days at once)
   */
  async bulkUpsert(workspaceId: string, hours: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }>) {
    const results = [];
    for (const day of hours) {
      const result = await this.upsert(workspaceId, day.dayOfWeek, {
        startTime: day.startTime,
        endTime: day.endTime,
        isActive: day.isActive
      });
      results.push(result);
    }
    return results;
  }

  /**
   * Deactivate business hours for a specific day
   */
  async deactivate(workspaceId: string, dayOfWeek: number) {
    return await this.prisma.workspaceBusinessHours.updateMany({
      where: { workspaceId, dayOfWeek },
      data: { isActive: false }
    });
  }

  /**
   * Delete business hours for a specific day
   */
  async delete(workspaceId: string, dayOfWeek: number) {
    return await this.prisma.workspaceBusinessHours.deleteMany({
      where: { workspaceId, dayOfWeek }
    });
  }
}
