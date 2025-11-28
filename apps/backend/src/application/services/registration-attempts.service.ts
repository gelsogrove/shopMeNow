import { PrismaClient } from "@prisma/client";
import logger from "../../utils/logger";

export interface RegistrationAttempt {
  phoneNumber: string;
  workspaceId: string;
  attemptCount: number;
  lastAttemptAt: Date;
  isBlocked: boolean;
}

export class RegistrationAttemptsService {
  private prisma: PrismaClient;
  private readonly MAX_ATTEMPTS = 5;
  private readonly ATTEMPT_WINDOW_HOURS = 24; // Reset attempts after 24 hours

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Record a registration attempt for a phone number
   */
  async recordAttempt(phoneNumber: string, workspaceId: string): Promise<RegistrationAttempt> {
    try {
      // Check if there's an existing record
      const existing = await this.prisma.registrationAttempts.findFirst({
        where: {
          phoneNumber,
          workspaceId
        }
      });

      const now = new Date();
      const windowStart = new Date(now.getTime() - (this.ATTEMPT_WINDOW_HOURS * 60 * 60 * 1000));

      if (existing) {
        // Check if attempts are within the time window
        if (existing.lastAttemptAt < windowStart) {
          // Reset attempts if outside the window
          const updated = await this.prisma.registrationAttempts.update({
            where: { id: existing.id },
            data: {
              attemptCount: 1,
              lastAttemptAt: now,
              isBlocked: false
            }
          });
          
          logger.info(`[REGISTRATION_ATTEMPTS] Reset attempts for ${phoneNumber} in workspace ${workspaceId}`);
          return this.mapToInterface(updated);
        } else {
          // Increment attempts within the window
          const newCount = existing.attemptCount + 1;
          const isBlocked = newCount >= this.MAX_ATTEMPTS;
          
          const updated = await this.prisma.registrationAttempts.update({
            where: { id: existing.id },
            data: {
              attemptCount: newCount,
              lastAttemptAt: now,
              isBlocked: isBlocked
            }
          });

          if (isBlocked) {
            logger.warn(`[REGISTRATION_ATTEMPTS] User ${phoneNumber} blocked after ${newCount} attempts in workspace ${workspaceId}`);
            
            // Also block the customer if they exist
            await this.blockCustomer(phoneNumber, workspaceId);
          } else {
            logger.info(`[REGISTRATION_ATTEMPTS] User ${phoneNumber} has ${newCount}/${this.MAX_ATTEMPTS} attempts in workspace ${workspaceId}`);
          }

          return this.mapToInterface(updated);
        }
      } else {
        // Create new record
        const created = await this.prisma.registrationAttempts.create({
          data: {
            phoneNumber,
            workspaceId,
            attemptCount: 1,
            lastAttemptAt: now,
            isBlocked: false
          }
        });

        logger.info(`[REGISTRATION_ATTEMPTS] First attempt recorded for ${phoneNumber} in workspace ${workspaceId}`);
        return this.mapToInterface(created);
      }
    } catch (error) {
      logger.error(`[REGISTRATION_ATTEMPTS] Error recording attempt for ${phoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Check if a phone number is blocked due to too many registration attempts
   */
  async isBlocked(phoneNumber: string, workspaceId: string): Promise<boolean> {
    try {
      const attempt = await this.prisma.registrationAttempts.findFirst({
        where: {
          phoneNumber,
          workspaceId,
          isBlocked: true
        }
      });

      if (!attempt) {
        return false;
      }

      // Check if the block is still within the time window
      const now = new Date();
      const windowStart = new Date(now.getTime() - (this.ATTEMPT_WINDOW_HOURS * 60 * 60 * 1000));

      if (attempt.lastAttemptAt < windowStart) {
        // Unblock if outside the window
        await this.prisma.registrationAttempts.update({
          where: { id: attempt.id },
          data: {
            isBlocked: false,
            attemptCount: 0
          }
        });
        
        logger.info(`[REGISTRATION_ATTEMPTS] Auto-unblocked ${phoneNumber} in workspace ${workspaceId} after time window`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`[REGISTRATION_ATTEMPTS] Error checking block status for ${phoneNumber}:`, error);
      return false; // Fail open - don't block if there's an error
    }
  }

  /**
   * Clear attempts when user successfully registers
   */
  async clearAttempts(phoneNumber: string, workspaceId: string): Promise<void> {
    try {
      await this.prisma.registrationAttempts.deleteMany({
        where: {
          phoneNumber,
          workspaceId
        }
      });

      logger.info(`[REGISTRATION_ATTEMPTS] Cleared attempts for successfully registered user ${phoneNumber} in workspace ${workspaceId}`);
    } catch (error) {
      logger.error(`[REGISTRATION_ATTEMPTS] Error clearing attempts for ${phoneNumber}:`, error);
    }
  }

  /**
   * Get attempt information for a phone number
   */
  async getAttempts(phoneNumber: string, workspaceId: string): Promise<RegistrationAttempt | null> {
    try {
      const attempt = await this.prisma.registrationAttempts.findFirst({
        where: {
          phoneNumber,
          workspaceId
        }
      });

      return attempt ? this.mapToInterface(attempt) : null;
    } catch (error) {
      logger.error(`[REGISTRATION_ATTEMPTS] Error getting attempts for ${phoneNumber}:`, error);
      return null;
    }
  }

  /**
   * Block a customer in the database
   */
  private async blockCustomer(phoneNumber: string, workspaceId: string): Promise<void> {
    try {
      // Find customer by phone number
      const customer = await this.prisma.customers.findFirst({
        where: {
          phone: phoneNumber,
          workspaceId: workspaceId
        }
      });

      if (customer) {
        // Update existing customer
        await this.prisma.customers.update({
          where: { id: customer.id },
          data: { isBlacklisted: true }
        });
        
        logger.info(`[REGISTRATION_ATTEMPTS] Blocked existing customer ${phoneNumber} in workspace ${workspaceId}`);
      } else {
        // Create a blocked customer record
        await this.prisma.customers.create({
          data: {
            phone: phoneNumber,
            workspaceId: workspaceId,
            name: "Blocked User",
            email: `${phoneNumber.replace(/[^0-9]/g, '')}@blocked.com`,
            isBlacklisted: true,
            isActive: true
          }
        });
        
        logger.info(`[REGISTRATION_ATTEMPTS] Created blocked customer record for ${phoneNumber} in workspace ${workspaceId}`);
      }
    } catch (error) {
      logger.error(`[REGISTRATION_ATTEMPTS] Error blocking customer ${phoneNumber}:`, error);
    }
  }

  /**
   * Map database record to interface
   */
  private mapToInterface(record: any): RegistrationAttempt {
    return {
      phoneNumber: record.phoneNumber,
      workspaceId: record.workspaceId,
      attemptCount: record.attemptCount,
      lastAttemptAt: record.lastAttemptAt,
      isBlocked: record.isBlocked
    };
  }
}
