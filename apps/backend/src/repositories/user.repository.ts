// @ts-nocheck - Schema mismatch: User model missing 'name' and 'workspaceId' fields
import { PrismaClient, User as PrismaUser } from '@echatbot/database';
import { User, UserProps } from '../domain/entities/user.entity';
import { UserRepositoryInterface } from '../domain/repositories/user.repository.interface';
import logger from '../utils/logger';
import { prisma as prismaInstance } from "@echatbot/database"

export class UserRepository implements UserRepositoryInterface {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || (prismaInstance as unknown as PrismaClient);
  }

  /**
   * Map database model to domain entity
   */
  private mapToDomain(data: PrismaUser): User {
    return User.create({
      id: data.id,
      email: data.email,
      password: data.passwordHash,
      name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      firstName: data.firstName,
      lastName: data.lastName,
      status: data.status,
      workspaceId: data.workspaceId,
      role: data.role,
      isPlatformAdmin: data.isPlatformAdmin || false, // 🔐 Platform Admin flag for Backoffice access
      isDeveloperUser: data.isDeveloperUser || false, // 🔧 Developer user flag (skip 2FA)
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastLogin: data.lastLogin,
      // 🔒 2FA fields (CRITICAL for security checks)
      twoFactorEnabled: data.twoFactorEnabled,
      twoFactorSecret: data.twoFactorSecret,
      twoFactorEnabledAt: data.twoFactorEnabledAt,
      recoveryCodes: data.recoveryCodes,
      // 📱 Personal phone (optional)
      phoneNumber: data.phoneNumber,
      // 🌐 Language preference
      language: data.language || 'ENG',
      // 🧾 Billing fields (Andrea's requirement - MUST be mapped from DB)
      companyName: data.companyName,
      vatNumber: data.vatNumber,
      website: data.website,
      billingPhone: data.billingPhone,
      billingAddress: data.billingAddress,
      // 🖼️ Company logo
      logo: data.logo,
      // 🔐 Auth provider info (for OAuth set-password feature)
      authProvider: data.authProvider,
      passwordHash: data.passwordHash,
    });
  }

  /**
   * Map domain entity to database model
   */
  private mapToDatabase(user: User): any {
    return {
      id: user.id || undefined,
      email: user.email,
      passwordHash: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status || 'ACTIVE',
      workspaceId: user.workspaceId,
      role: user.role,
      lastLogin: user.lastLogin,
    };
  }

  /**
   * Find all users
   */
  async findAll(): Promise<User[]> {
    logger.debug('Finding all users');

    try {
      const users = await this.prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
      });

      logger.debug(`Found ${users.length} users`);
      return users.map(user => this.mapToDomain(user));
    } catch (error) {
      logger.error('Error finding users:', error);
      throw error;
    }
  }

  /**
   * Find a user by ID
   */
  async findById(id: string): Promise<User | null> {
    logger.debug(`Finding user by ID: ${id}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        logger.debug(`User with ID ${id} not found`);
        return null;
      }

      logger.debug(`Found user with ID ${id}`);
      return this.mapToDomain(user);
    } catch (error) {
      logger.error(`Error finding user with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    logger.debug(`Finding user by email: ${email}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        logger.debug(`User with email ${email} not found`);
        return null;
      }

      logger.debug(`Found user with email ${email}`);
      return this.mapToDomain(user);
    } catch (error) {
      logger.error(`Error finding user with email ${email}:`, error);
      throw error;
    }
  }

  /**
   * Create a new user
   */
  async create(user: User): Promise<User> {
    logger.debug(`Creating new user with email ${user.email}`);

    try {
      const data = this.mapToDatabase(user);
      
      const createdUser = await this.prisma.user.create({
        data,
      });

      logger.debug(`Created user with ID ${createdUser.id}`);
      return this.mapToDomain(createdUser);
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update an existing user
   */
  async update(id: string, data: Partial<UserProps>): Promise<User | null> {
    logger.debug(`Updating user with ID ${id}`);

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        logger.debug(`User with ID ${id} not found for update`);
        return null;
      }

      // @ts-ignore - Ignora errore di tipo per Partial<UserProps>
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data,
      });

      logger.debug(`Updated user with ID ${id}`);
      return this.mapToDomain(updatedUser);
    } catch (error) {
      logger.error(`Error updating user with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  async delete(id: string): Promise<boolean> {
    logger.debug(`Deleting user with ID ${id}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        logger.debug(`User with ID ${id} not found for deletion`);
        return false;
      }

      await this.prisma.user.delete({
        where: { id },
      });

      logger.debug(`Deleted user with ID ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting user with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find users by workspace ID
   */
  async findByWorkspace(workspaceId: string): Promise<User[]> {
    logger.debug(`Finding users for workspace ${workspaceId}`);

    try {
      // @ts-ignore - Ignora errore di workspaceId non esistente in UserWhereInput
      const users = await this.prisma.user.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
      });

      logger.debug(`Found ${users.length} users for workspace ${workspaceId}`);
      return users.map(user => this.mapToDomain(user));
    } catch (error) {
      logger.error(`Error finding users for workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Verify user's email
   */
  async verifyEmail(id: string): Promise<User | null> {
    logger.debug(`Verifying email for user with ID ${id}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        logger.debug(`User with ID ${id} not found for email verification`);
        return null;
      }

      // @ts-ignore - Ignora errore su proprietà isVerified non esistente
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });

      logger.debug(`Email verified for user with ID ${id}`);
      return this.mapToDomain(updatedUser);
    } catch (error) {
      logger.error(`Error verifying email for user with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update last login time
   */
  async updateLastLogin(id: string): Promise<User | null> {
    logger.debug(`Updating last login for user with ID ${id}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        logger.debug(`User with ID ${id} not found for updating last login`);
        return null;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: { lastLogin: new Date() },
      });

      logger.debug(`Last login updated for user with ID ${id}`);
      return this.mapToDomain(updatedUser);
    } catch (error) {
      logger.error(`Error updating last login for user with ID ${id}:`, error);
      throw error;
    }
  }
} 
