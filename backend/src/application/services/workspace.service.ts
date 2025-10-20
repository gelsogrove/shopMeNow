import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Workspace, WorkspaceProps } from '../../domain/entities/workspace.entity';
import { WorkspaceRepositoryInterface } from '../../domain/repositories/workspace.repository.interface';
import { WorkspaceRepository } from '../../repositories/workspace.repository';
import logger from '../../utils/logger';

export class WorkspaceService {
  private repository: WorkspaceRepositoryInterface;
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
    this.repository = new WorkspaceRepository(this.prisma);
  }

  /**
   * Generate a slug from a name
   * @private
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Get default GDPR content from file
   * @private
   */
  private async getDefaultGdprContent(): Promise<string> {
    try {
      const gdprFilePath = path.join(__dirname, '../../prisma/prompts/gdpr.md');
      return fs.readFileSync(gdprFilePath, 'utf8');
    } catch (error) {
      logger.warn('Could not read default GDPR file, using fallback content');
      return `# Privacy Policy

## Data Collection
We collect and process personal data in accordance with applicable privacy laws.

## Data Usage
Your data is used to provide our services and improve user experience.

## Contact
For privacy inquiries, please contact our support team.`;
    }
  }

  /**
   * Get default agent prompt content from file
   * @private
   */
  private async getDefaultAgentContent(): Promise<string> {
    try {
      // Try to read from the default agent prompt file
      const agentFilePath = path.join(__dirname, '../../prisma/prompts/default-agent.md');
      return fs.readFileSync(agentFilePath, 'utf8');
    } catch (error) {
      // Fallback to GDPR file if default agent file doesn't exist
      try {
        const gdprFilePath = path.join(__dirname, '../../prisma/prompts/gdpr.md');
        return fs.readFileSync(gdprFilePath, 'utf8');
      } catch (gdprError) {
        logger.warn('Could not read default agent prompt files, using fallback content');
        return `You are a helpful AI assistant for customer support. Please assist users with their inquiries in a professional and friendly manner.`;
      }
    }
  }

  /**
   * Get all workspaces
   */
  async getAll(): Promise<Workspace[]> {
    logger.info('Getting all workspaces');
    return this.repository.findAll();
  }

  /**
   * Get a workspace by ID
   */
  async getById(id: string): Promise<Workspace | null> {
    logger.info(`Getting workspace by ID: ${id}`);
    return this.repository.findById(id);
  }

  /**
   * Find a workspace by slug
   */
  async getBySlug(slug: string): Promise<Workspace | null> {
    logger.info(`Getting workspace by slug: ${slug}`);
    return this.repository.findBySlug(slug);
  }

  /**
   * Create a new workspace
   */
  async create(data: WorkspaceProps): Promise<Workspace> {
    logger.info('Creating new workspace with default settings');
    
    // Generate a slug if not provided
    if (!data.slug) {
      data.slug = this.generateSlug(data.name);
    }
    
    // Check if workspace with same slug exists
    const existingWorkspace = await this.repository.findBySlug(data.slug);
    if (existingWorkspace) {
      throw new Error(`Workspace with name "${data.name}" already exists`);
    }
    
    // Generate UUID if not provided
    if (!data.id) {
      data.id = randomUUID();
    }
    
    // Create workspace entity
    const workspace = Workspace.create(data);
    
    // Use transaction to create workspace and related records
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create the workspace
      const createdWorkspace = await this.repository.create(workspace);
      
      logger.info(`Created workspace ${createdWorkspace.id}, now creating default settings`);
      
      // 2. Create default GDPR settings
      try {
        const defaultGdprContent = await this.getDefaultGdprContent();
        await tx.whatsappSettings.create({
          data: {
            workspaceId: createdWorkspace.id,
            phoneNumber: `+34-${createdWorkspace.id.substring(0, 8)}`,
            apiKey: 'default-api-key',
            gdpr: defaultGdprContent,
          },
        });
        logger.info(`Created default GDPR settings for workspace ${createdWorkspace.id}`);
      } catch (error) {
        logger.error(`Error creating GDPR settings for workspace ${createdWorkspace.id}:`, error);
        // Don't fail the entire transaction for GDPR settings
      }
      
      // 3. Create default agent configuration
      try {
        const defaultAgentContent = await this.getDefaultAgentContent();
        await tx.agentConfig.create({
          data: {
            prompt: defaultAgentContent,
            workspaceId: createdWorkspace.id,
            model: 'openai/gpt-4o-mini',
            temperature: 0.0, // Zero temperature for deterministic responses
            maxTokens: 5000,
          },
        });
        logger.info(`Created default agent configuration for workspace ${createdWorkspace.id}`);
      } catch (error) {
        logger.error(`Error creating agent configuration for workspace ${createdWorkspace.id}:`, error);
        // Don't fail the entire transaction for agent settings
      }
      
      return createdWorkspace;
    });
  }

  /**
   * Update a workspace
   */
  async update(id: string, data: Partial<WorkspaceProps>): Promise<Workspace | null> {
    logger.info(`Updating workspace with ID: ${id}`);
    
    // Generate slug if name is updated and slug is not provided
    if (data.name && !data.slug) {
      data.slug = this.generateSlug(data.name);
      
      // Check for slug uniqueness if it has changed
      const existingWorkspace = await this.repository.findBySlug(data.slug);
      if (existingWorkspace && existingWorkspace.id !== id) {
        throw new Error(`Workspace with name "${data.name}" already exists`);
      }
    }
    
    return this.repository.update(id, data);
  }

  /**
   * Delete a workspace
   */
  async delete(id: string): Promise<boolean> {
    logger.info(`Deleting workspace with ID: ${id}`);
    return this.repository.delete(id);
  }

  /**
   * Get workspaces for a user
   */
  async getWorkspacesForUser(userId: string): Promise<Workspace[]> {
    logger.info(`Getting workspaces for user: ${userId}`);
    return this.repository.findByUserId(userId);
  }
} 