import { User, UserProps } from '../entities/user.entity';

export interface UserRepositoryInterface {
  /**
   * Find all users
   */
  findAll(): Promise<User[]>;

  /**
   * Find a user by ID
   */
  findById(id: string): Promise<User | null>;

  /**
   * Find a user by email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Create a new user
   */
  create(user: User): Promise<User>;

  /**
   * Update an existing user
   */
  update(id: string, data: Partial<UserProps>): Promise<User | null>;

  /**
   * Delete a user
   */
  delete(id: string): Promise<boolean>;

  /**
   * Find users by workspace ID
   */
  findByWorkspace(workspaceId: string): Promise<User[]>;

  /**
   * Verify user's email
   */
  verifyEmail(id: string): Promise<User | null>;

  /**
   * Update last login time
   */
  updateLastLogin(id: string): Promise<User | null>;
} 