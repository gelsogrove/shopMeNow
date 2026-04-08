/**
 * Blackout Period Repository
 * 
 * Data access layer for workspace closures (holidays, maintenance, etc.)
 * ALWAYS filters by workspaceId for multi-tenant isolation.
 */

import { PrismaClient } from '@echatbot/database';
import logger from '../utils/logger';

export class BlackoutPeriodRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all blackout periods for a workspace
   */
  async findByWorkspace(workspaceId: string, includeExpired = false) {
    const now = new Date();
    
    return await this.prisma.blackoutPeriod.findMany({
      where: {
        workspaceId,
        ...(includeExpired ? {} : { endDate: { gte: now } }) // Only future/active blackouts
      },
      orderBy: { startDate: 'asc' }
    });
  }

  /**
   * Find blackout period by ID
   */
  async findById(workspaceId: string, id: string) {
    return await this.prisma.blackoutPeriod.findFirst({
      where: { id, workspaceId }
    });
  }

  /**
   * Find blackout periods overlapping with a date range
   */
  async findOverlapping(workspaceId: string, startDate: Date, endDate: Date) {
    return await this.prisma.blackoutPeriod.findMany({
      where: {
        workspaceId,
        OR: [
          // Blackout starts during the range
          { startDate: { gte: startDate, lte: endDate } },
          // Blackout ends during the range
          { endDate: { gte: startDate, lte: endDate } },
          // Blackout completely contains the range
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: endDate } }
            ]
          }
        ]
      },
      orderBy: { startDate: 'asc' }
    });
  }

  /**
   * Create new blackout period
   */
  async create(workspaceId: string, data: {
    startDate: Date;
    endDate: Date;
    reason?: string;
  }) {
    return await this.prisma.blackoutPeriod.create({
      data: {
        workspaceId,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason
      }
    });
  }

  /**
   * Update blackout period
   */
  async update(workspaceId: string, id: string, data: {
    startDate?: Date;
    endDate?: Date;
    reason?: string;
  }) {
    return await this.prisma.blackoutPeriod.updateMany({
      where: { id, workspaceId },
      data
    });
  }

  /**
   * Delete blackout period
   */
  async delete(workspaceId: string, id: string) {
    return await this.prisma.blackoutPeriod.deleteMany({
      where: { id, workspaceId }
    });
  }

  /**
   * Check if a specific date falls within any blackout period
   */
  async isDateBlocked(workspaceId: string, date: Date): Promise<boolean> {
    const count = await this.prisma.blackoutPeriod.count({
      where: {
        workspaceId,
        startDate: { lte: date },
        endDate: { gte: date }
      }
    });
    return count > 0;
  }
}
