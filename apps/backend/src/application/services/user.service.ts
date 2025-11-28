import { PrismaClient } from '@prisma/client';
import { User, UserProps } from '../../domain/entities/user.entity';
import { UserRepositoryInterface } from '../../domain/repositories/user.repository.interface';
import { UserRepository } from '../../repositories/user.repository';
import logger from '../../utils/logger';
import { comparePassword, hashPassword } from '../../utils/password';

export class UserService {
  private repository: UserRepositoryInterface;

  constructor(prisma?: PrismaClient) {
    this.repository = new UserRepository(prisma);
  }

  /**
   * Get a user by ID
   */
  async getById(id: string): Promise<User | null> {
    logger.info(`Getting user by ID: ${id}`);
    return this.repository.findById(id);
  }

  /**
   * Get a user by email
   */
  async getByEmail(email: string): Promise<User | null> {
    logger.info(`Getting user by email: ${email}`);
    return this.repository.findByEmail(email);
  }

  /**
   * Create a new user
   */
  async create(data: UserProps): Promise<User> {
    logger.info(`Creating new user with email: ${data.email}`);
    
    // Check if user already exists
    const existingUser = await this.repository.findByEmail(data.email);
    if (existingUser) {
      logger.error(`User with email ${data.email} already exists`);
      throw new Error('User with this email already exists');
    }

    // Hash the password if provided
    if (data.password) {
      data.password = await hashPassword(data.password);
    }

    // Create user entity
    const user = User.create(data);
    
    // Save to repository
    return this.repository.create(user);
  }

  /**
   * Update a user
   */
  async update(id: string, data: Partial<UserProps>): Promise<User | null> {
    logger.info(`Updating user with ID: ${id}`);
    
    // Hash password if it's being updated
    if (data.password) {
      data.password = await hashPassword(data.password);
    }
    
    return this.repository.update(id, data);
  }

  /**
   * Delete a user
   */
  async delete(id: string): Promise<boolean> {
    logger.info(`Deleting user with ID: ${id}`);
    return this.repository.delete(id);
  }

  /**
   * Authenticate a user
   */
  async authenticate(email: string, password: string): Promise<User | null> {
    logger.info(`Authenticating user with email: ${email}`);
    
    const user = await this.repository.findByEmail(email);
    if (!user || !user.password) {
      logger.debug(`Authentication failed for email: ${email} - User not found or no password`);
      return null;
    }

    const passwordMatches = await comparePassword(password, user.password);
    if (!passwordMatches) {
      logger.debug(`Authentication failed for email: ${email} - Password doesn't match`);
      return null;
    }

    // Update last login time
    await this.repository.updateLastLogin(user.id);
    
    logger.info(`User ${email} authenticated successfully`);
    return user;
  }

  /**
   * Verify a user's email
   */
  async verifyEmail(userId: string): Promise<User | null> {
    logger.info(`Verifying email for user ID: ${userId}`);
    return this.repository.verifyEmail(userId);
  }

  /**
   * Get all users for a workspace
   */
  async getUsersByWorkspace(workspaceId: string): Promise<User[]> {
    logger.info(`Getting users for workspace: ${workspaceId}`);
    return this.repository.findByWorkspace(workspaceId);
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    logger.info('Getting all users');
    return this.repository.findAll();
  }
}
