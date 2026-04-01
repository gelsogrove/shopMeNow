/**
 * WorkspaceEnvironmentVariableService
 *
 * Business logic for secure credential management
 *
 * Responsibilities:
 * - 🔒 Validate credential names and values
 * - 🔐 Coordinate encryption (plaintext → encryptedValue + nonce)
 * - 👥 Verify workspace ownership (IDOR prevention)
 * - 📋 Provide decrypted values to webhook dispatcher
 */

import { PrismaClient } from '@echatbot/database'
import { WorkspaceEnvironmentVariableRepository } from '../../repositories/workspace-environment-variable.repository'
import { encryptionService } from '../../services/encryption.service'
import logger from '../../utils/logger'

export interface CreateEnvironmentVariableInput {
  variableName: string
  plaintext: string
  description?: string
}

export interface UpdateEnvironmentVariableInput {
  plaintext: string
  description?: string
}

export class WorkspaceEnvironmentVariableService {
  private repository: WorkspaceEnvironmentVariableRepository

  constructor(private prisma: PrismaClient) {
    this.repository = new WorkspaceEnvironmentVariableRepository(prisma)
  }

  /**
   * Validate variable name format
   *
   * Convention: UPPERCASE with underscores
   * Examples: STRIPE_API_KEY, MAILCHIMP_TOKEN, OPENAPI_URL
   */
  private validateVariableName(variableName: string): void {
    const pattern = /^[A-Z_][A-Z0-9_]*$/

    if (!pattern.test(variableName)) {
      throw new Error(
        'Invalid variable name. Use UPPERCASE with underscores only (e.g., STRIPE_API_KEY)'
      )
    }

    if (variableName.length > 255) {
      throw new Error('Variable name too long (max 255 characters)')
    }
  }

  /**
   * Validate that user has access to the workspace
   */
  private async verifyWorkspaceAccess(
    workspaceId: string,
    userId: string
  ): Promise<void> {
    const userWorkspace = await this.prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    })

    if (!userWorkspace) {
      throw new Error('Access denied to workspace')
    }
  }

  /**
   * Create a new environment variable
   */
  async createVariable(
    workspaceId: string,
    userId: string,
    input: CreateEnvironmentVariableInput
  ): Promise<{
    id: string
    variableName: string
    description: string | null
    createdAt: Date
  }> {
    try {
      // 1️⃣ Verify workspace access
      await this.verifyWorkspaceAccess(workspaceId, userId)

      // 2️⃣ Validate variable name
      this.validateVariableName(input.variableName)

      // 3️⃣ Validate plaintext
      if (!input.plaintext || input.plaintext.trim().length === 0) {
        throw new Error('Credential value cannot be empty')
      }

      if (input.plaintext.length > 10_000) {
        throw new Error('Credential value too long (max 10,000 characters)')
      }

      // 4️⃣ Encrypt the credential
      const encrypted = encryptionService.encrypt(input.plaintext, workspaceId)

      // 5️⃣ Store in database
      const result = await this.repository.create({
        workspaceId,
        variableName: input.variableName,
        encryptedValue: encrypted.encryptedValue,
        nonce: encrypted.nonce,
        description: input.description || null,
        createdBy: userId,
      })

      logger.info('✅ Environment variable created', {
        workspaceId,
        variableName: input.variableName,
        userId,
      })

      return {
        id: result.id,
        variableName: result.variableName,
        description: result.description,
        createdAt: result.createdAt,
      }
    } catch (error) {
      logger.error('❌ Failed to create environment variable:', error)
      throw error
    }
  }

  /**
   * Update an environment variable (credential rotation)
   */
  async updateVariable(
    workspaceId: string,
    userId: string,
    variableName: string,
    input: UpdateEnvironmentVariableInput
  ): Promise<{ variableName: string; updatedAt: Date }> {
    try {
      // 1️⃣ Verify workspace access
      await this.verifyWorkspaceAccess(workspaceId, userId)

      // 2️⃣ Validate plaintext
      if (!input.plaintext || input.plaintext.trim().length === 0) {
        throw new Error('Credential value cannot be empty')
      }

      if (input.plaintext.length > 10_000) {
        throw new Error('Credential value too long (max 10,000 characters)')
      }

      // 3️⃣ Encrypt the new credential with fresh nonce
      const encrypted = encryptionService.encrypt(input.plaintext, workspaceId)

      // 4️⃣ Update in database
      const result = await this.repository.update({
        workspaceId,
        variableName,
        encryptedValue: encrypted.encryptedValue,
        nonce: encrypted.nonce,
        description: input.description,
      })

      logger.info('✅ Environment variable updated (rotated)', {
        workspaceId,
        variableName,
        userId,
      })

      return {
        variableName: result.variableName,
        updatedAt: result.updatedAt,
      }
    } catch (error) {
      logger.error('❌ Failed to update environment variable:', error)
      throw error
    }
  }

  /**
   * Delete an environment variable
   */
  async deleteVariable(
    workspaceId: string,
    userId: string,
    variableName: string
  ): Promise<void> {
    try {
      // 1️⃣ Verify workspace access
      await this.verifyWorkspaceAccess(workspaceId, userId)

      // 2️⃣ Delete
      await this.repository.delete(workspaceId, variableName)

      logger.info('✅ Environment variable deleted', {
        workspaceId,
        variableName,
        userId,
      })
    } catch (error) {
      logger.error('❌ Failed to delete environment variable:', error)
      throw error
    }
  }

  /**
   * List all environment variables for a workspace
   *
   * Returns metadata only (no values)
   */
  async listVariables(workspaceId: string, userId: string): Promise<
    Array<{
      id: string
      variableName: string
      description: string | null
      createdBy: string | null
      createdAt: Date
      updatedAt: Date
    }>
  > {
    try {
      // 1️⃣ Verify workspace access
      await this.verifyWorkspaceAccess(workspaceId, userId)

      // 2️⃣ Fetch from repository (no decryption needed for listing)
      const variables = await this.repository.listByWorkspace(workspaceId)

      logger.info('📋 Listed environment variables', {
        workspaceId,
        count: variables.length,
        userId,
      })

      return variables
    } catch (error) {
      logger.error('❌ Failed to list environment variables:', error)
      throw error
    }
  }

  /**
   * Get a single variable (decrypted)
   *
   * Internal use only - returns plaintext for webhook dispatch
   */
  async getVariable(workspaceId: string, variableName: string): Promise<string | null> {
    try {
      const result = await this.repository.getByName(workspaceId, variableName)
      return result ? result.plaintext : null
    } catch (error) {
      logger.error('❌ Failed to get environment variable:', error)
      throw error
    }
  }

  /**
   * Get all variables for webhook credential injection
   *
   * Used during webhook dispatch to retrieve all decrypted credentials
   */
  async getAllCredentialsForDispatch(workspaceId: string): Promise<Map<string, string>> {
    try {
      const credentials = await this.repository.getAllDecrypted(workspaceId)
      logger.info('🔓 Retrieved credentials for webhook dispatch', {
        workspaceId,
        count: credentials.size,
      })
      return credentials
    } catch (error) {
      logger.error('❌ Failed to get credentials for dispatch:', error)
      throw error
    }
  }
}
