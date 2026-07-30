import { Prisma } from '@echatbot/database';
import { Workspace, WorkspaceProps } from '../entities/workspace.entity';

export interface WorkspaceRepositoryInterface {
  /**
   * Find all workspaces
   */
  findAll(): Promise<Workspace[]>;

  /**
   * Find a workspace by ID
   */
  findById(id: string): Promise<Workspace | null>;

  /**
   * Find a workspace by slug
   */
  findBySlug(slug: string): Promise<Workspace | null>;

  /**
   * Find workspaces by user ID
   */
  findByUserId(userId: string): Promise<Workspace[]>;

  /**
   * Create a new workspace
   * @param tx - Optional transaction client so the insert participates in a caller's transaction
   */
  create(workspace: Workspace, tx?: Prisma.TransactionClient): Promise<Workspace>;

  /**
   * Update an existing workspace
   */
  update(id: string, data: Partial<WorkspaceProps>): Promise<Workspace | null>;

  /**
   * Delete a workspace
   */
  delete(id: string): Promise<boolean>;

  /**
   * Update agent status (enable/disable) for a workspace
   * Used for auto-toggling e-commerce agents based on channelMode
   */
  updateAgentStatus(workspaceId: string, agentType: string, isActive: boolean): Promise<boolean>;
} 