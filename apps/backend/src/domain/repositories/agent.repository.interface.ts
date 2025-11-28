import { Agent, AgentProps } from '../entities/agent.entity';

export interface AgentRepositoryInterface {
  /**
   * Find all agents for a given workspace
   */
  findAllByWorkspace(workspaceId: string): Promise<Agent[]>;

  /**
   * Find an agent by its ID and workspace ID
   */
  findById(id: string, workspaceId: string): Promise<Agent | null>;

  /**
   * Create a new agent
   */
  create(agent: Agent): Promise<Agent>;

  /**
   * Update an existing agent
   */
  update(id: string, workspaceId: string, data: Partial<AgentProps>): Promise<Agent | null>;

  /**
   * Delete an agent
   */
  delete(id: string, workspaceId: string): Promise<boolean>;

  /**
   * Find a router agent for a workspace
   */
  findRouterByWorkspace(workspaceId: string): Promise<Agent | null>;
} 