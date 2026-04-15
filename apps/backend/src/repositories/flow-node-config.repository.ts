import { PrismaClient } from '@echatbot/database';
import logger from '../utils/logger';

/**
 * Repository for FlowNodeConfig data access
 * 
 * Handles CRUD operations for flow configurations (E1 - Database Layer)
 * Each FlowNodeConfig represents a machine with its flow definitions
 * 
 * @example
 * const config = await repository.findByFlowKey(workspaceId, 'hs60xx');
 */
export class FlowNodeConfigRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find flow configuration by flowKey (machine identifier)
   * 
   * @param workspaceId - Workspace UUID
   * @param flowKey - Machine identifier (e.g., "hs60xx", "ed340")
   * @returns FlowNodeConfig or null if not found
   */
  async findByFlowKey(workspaceId: string, flowKey: string) {
    try {
      return await this.prisma.flowNodeConfig.findFirst({
        where: {
          workspaceId,
          flowKey,
          isActive: true,
          workspace: {
            deletedAt: null
          }
        }
      });
    } catch (error) {
      logger.error(`[FlowNodeConfigRepository] findByFlowKey failed for flowKey=${flowKey}:`, error);
      throw error;
    }
  }

  /**
   * Find flow configuration by ID
   * 
   * @param workspaceId - Workspace UUID  
   * @param id - FlowNodeConfig UUID
   * @returns FlowNodeConfig or null if not found
   */
  async findById(workspaceId: string, id: string) {
    try {
      return await this.prisma.flowNodeConfig.findFirst({
        where: {
          id,
          workspaceId,
          workspace: {
            deletedAt: null
          }
        }
      });
    } catch (error) {
      logger.error(`[FlowNodeConfigRepository] findById failed for id=${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all flow configurations for a workspace
   * 
   * @param workspaceId - Workspace UUID
   * @returns Array of FlowNodeConfig
   */
  async findAllByWorkspace(workspaceId: string) {
    try {
      return await this.prisma.flowNodeConfig.findMany({
        where: {
          workspaceId,
          workspace: {
            deletedAt: null
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (error) {
      logger.error(`[FlowNodeConfigRepository] findAllByWorkspace failed:`, error);
      throw error;
    }
  }

  /**
   * Create new flow configuration
   * 
   * @param workspaceId - Workspace UUID
   * @param data - FlowNodeConfig creation data
   * @returns Created FlowNodeConfig
   * @throws P2002 if flowKey already exists in workspace
   */
  async create(
    workspaceId: string,
    data: {
      flowKey: string;
      flowLabel: string;
      systemPrompt?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      availableFunctions?: any;
      flows?: any;
      isActive?: boolean;
    }
  ) {
    try {
      return await this.prisma.flowNodeConfig.create({
        data: {
          ...data,
          workspaceId
        }
      });
    } catch (error) {
      logger.error(`[FlowNodeConfigRepository] create failed for flowKey=${data.flowKey}:`, error);
      throw error;
    }
  }

  /**
   * Update flow configuration
   * 
   * @param workspaceId - Workspace UUID
   * @param id - FlowNodeConfig UUID
   * @param data - Fields to update
   * @returns Updated FlowNodeConfig
   * @throws Error if config not found or belongs to different workspace
   */
  async update(
    workspaceId: string,
    id: string,
    data: {
      flowLabel?: string;
      systemPrompt?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      availableFunctions?: any;
      flows?: any;
      isActive?: boolean;
    }
  ) {
    try {
      // Verify ownership before update
      const existing = await this.findById(workspaceId, id);
      if (!existing) {
        throw new Error(`FlowNodeConfig ${id} not found in workspace ${workspaceId}`);
      }

      return await this.prisma.flowNodeConfig.update({
        where: { id },
        data
      });
    } catch (error) {
      logger.error(`[FlowNodeConfigRepository] update failed for id=${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete flow configuration (hard delete)
   * 
   * @param workspaceId - Workspace UUID
   * @param id - FlowNodeConfig UUID
   * @throws Error if config not found or belongs to different workspace
   */
  async delete(workspaceId: string, id: string) {
    try {
      // Verify ownership before delete
      const existing = await this.findById(workspaceId, id);
      if (!existing) {
        throw new Error(`FlowNodeConfig ${id} not found in workspace ${workspaceId}`);
      }

      await this.prisma.flowNodeConfig.delete({
        where: { id }
      });

      logger.info(`[FlowNodeConfigRepository] Deleted FlowNodeConfig ${id} from workspace ${workspaceId}`);
    } catch (error) {
      logger.error(`[FlowNodeConfigRepository] delete failed for id=${id}:`, error);
      throw error;
    }
  }
}
