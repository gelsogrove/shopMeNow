/**
 * WorkspaceEnvironmentVariableRepository
 *
 * Data access layer for secure credential storage
 *
 * Security:
 * - 🔒 All reads/writes encrypt/decrypt automatically
 * - 🔐 Workspace isolation (can't access other workspace's credentials)
 * - 📝 Audit trail (track who created/modified credentials)
 */

import { PrismaClient, WorkspaceEnvironmentVariable } from '@echatbot/database'
import { encryptionService } from '../services/encryption.service'
import logger from '../utils/logger'

export class WorkspaceEnvironmentVariableRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new environment variable (encrypted)
   */
  async create(data: {
    workspaceId: string
    variableName: string
    encryptedValue: string
    nonce: string
    description?: string
    createdBy?: string
  }): Promise<WorkspaceEnvironmentVariable> {
    try {
      // 🔐 Data is already encrypted by the service layer
      const result = await this.prisma.workspaceEnvironmentVariable.create({
        data: {
          workspaceId: data.workspaceId,
          variableName: data.variableName,
          encryptedValue: data.encryptedValue,
          nonce: data.nonce,
          description: data.description,
          createdBy: data.createdBy,
        },
      })

      logger.info('✅ Environment variable created', {
        workspaceId: data.workspaceId,
        variableName: data.variableName,
        createdBy: data.createdBy,
      })

      return result
    } catch (error: any) {
      if (error.code === 'P2002') {
        logger.warn('⚠️ Environment variable already exists', {
          workspaceId: data.workspaceId,
          variableName: data.variableName,
        })
        throw new Error(`Environment variable "${data.variableName}" already exists in this workspace`)
      }
      logger.error('❌ Failed to create environment variable:', error)
      throw error
    }
  }

  /**
   * Get environment variable by name (decrypted)
   */
  async getByName(
    workspaceId: string,
    variableName: string
  ): Promise<{ plaintext: string } | null> {
    try {
      const row = await this.prisma.workspaceEnvironmentVariable.findUnique({
        where: {
          workspaceId_variableName: {
            workspaceId,
            variableName,
          },
        },
      })

      if (!row) {
        return null
      }

      // 🔓 Decrypt the value
      const plaintext = encryptionService.decrypt(row.encryptedValue, row.nonce, workspaceId)

      logger.info('🔓 Environment variable retrieved (decrypted)', {
        workspaceId,
        variableName,
      })

      return { plaintext }
    } catch (error) {
      logger.error('❌ Failed to retrieve environment variable:', error)
      throw error
    }
  }

  /**
   * List all environment variables for a workspace (WITHOUT decrypting values)
   *
   * Returns metadata only - never decrypts in list operations
   */
  async listByWorkspace(workspaceId: string): Promise<
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
      const rows = await this.prisma.workspaceEnvironmentVariable.findMany({
        where: { workspaceId },
        select: {
          id: true,
          variableName: true,
          description: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          // 🔐 NOTE: Don't select encryptedValue or nonce (they're never needed for list operations)
        },
        orderBy: { createdAt: 'desc' },
      })

      logger.info('📋 Listed environment variables for workspace', {
        workspaceId,
        count: rows.length,
      })

      return rows
    } catch (error) {
      logger.error('❌ Failed to list environment variables:', error)
      throw error
    }
  }

  /**
   * Update an environment variable (encrypted)
   */
  async update(data: {
    workspaceId: string
    variableName: string
    encryptedValue: string
    nonce: string
    description?: string
  }): Promise<WorkspaceEnvironmentVariable> {
    try {
      const result = await this.prisma.workspaceEnvironmentVariable.update({
        where: {
          workspaceId_variableName: {
            workspaceId: data.workspaceId,
            variableName: data.variableName,
          },
        },
        data: {
          encryptedValue: data.encryptedValue,
          nonce: data.nonce,
          description: data.description,
        },
      })

      logger.info('✅ Environment variable updated', {
        workspaceId: data.workspaceId,
        variableName: data.variableName,
      })

      return result
    } catch (error) {
      logger.error('❌ Failed to update environment variable:', error)
      throw error
    }
  }

  /**
   * Delete an environment variable
   */
  async delete(workspaceId: string, variableName: string): Promise<void> {
    try {
      await this.prisma.workspaceEnvironmentVariable.delete({
        where: {
          workspaceId_variableName: {
            workspaceId,
            variableName,
          },
        },
      })

      logger.info('✅ Environment variable deleted', {
        workspaceId,
        variableName,
      })
    } catch (error: any) {
      if (error.code === 'P2025') {
        logger.warn('⚠️ Environment variable not found', {
          workspaceId,
          variableName,
        })
        throw new Error(`Environment variable "${variableName}" not found`)
      }
      logger.error('❌ Failed to delete environment variable:', error)
      throw error
    }
  }

  /**
   * Get all credentials for a workspace (for webhook dispatch)
   *
   * Used during webhook execution to retrieve all decrypted values
   * for credential substitution
   */
  async getAllDecrypted(
    workspaceId: string
  ): Promise<Map<string, string>> {
    try {
      const rows = await this.prisma.workspaceEnvironmentVariable.findMany({
        where: { workspaceId },
        select: {
          variableName: true,
          encryptedValue: true,
          nonce: true,
        },
      })

      const credentials = new Map<string, string>()

      for (const row of rows) {
        try {
          const plaintext = encryptionService.decrypt(
            row.encryptedValue,
            row.nonce,
            workspaceId
          )
          credentials.set(row.variableName, plaintext)
        } catch (decryptError) {
          logger.error(`⚠️ Failed to decrypt credential "${row.variableName}":`, decryptError)
          // Continue with other credentials, but log the error
        }
      }

      logger.info('🔓 Retrieved all credentials for workspace', {
        workspaceId,
        count: credentials.size,
      })

      return credentials
    } catch (error) {
      logger.error('❌ Failed to retrieve all credentials:', error)
      throw error
    }
  }
}
