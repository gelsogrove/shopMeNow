import { PrismaClient, WorkspaceCallingFunction } from "@echatbot/database"
import logger from "../utils/logger"

export class WorkspaceCallingFunctionRepository {
    private prisma: PrismaClient

    constructor(prisma: PrismaClient) {
        this.prisma = prisma
    }

    /**
     * Find all active functions for a workspace
     * @param workspaceId - Workspace ID
     * @returns Array of active calling functions
     */
    async findActiveByWorkspace(workspaceId: string): Promise<WorkspaceCallingFunction[]> {
        try {
            return await this.prisma.workspaceCallingFunction.findMany({
                where: {
                    workspaceId,
                    isActive: true,
                },
            })
        } catch (error) {
            logger.error(`Error finding calling functions for workspace ${workspaceId}:`, error)
            throw error
        }
    }

    /**
     * Find a specific function by name in a workspace
     * @param workspaceId - Workspace ID
     * @param functionName - Name of the function
     */
    async findByName(workspaceId: string, functionName: string): Promise<WorkspaceCallingFunction | null> {
        try {
            return await this.prisma.workspaceCallingFunction.findUnique({
                where: {
                    workspaceId_functionName: {
                        workspaceId,
                        functionName,
                    },
                },
            })
        } catch (error) {
            logger.error(`Error finding calling function ${functionName} in workspace ${workspaceId}:`, error)
            throw error
        }
    }

    /**
     * Find all functions for a workspace (including inactive)
     * @param workspaceId - Workspace ID
     */
    async findAllByWorkspace(workspaceId: string): Promise<WorkspaceCallingFunction[]> {
        try {
            return await this.prisma.workspaceCallingFunction.findMany({
                where: {
                    workspaceId,
                },
                orderBy: {
                    functionName: 'asc'
                }
            })
        } catch (error) {
            logger.error(`Error finding all calling functions for workspace ${workspaceId}:`, error)
            throw error
        }
    }

    /**
     * Create a new calling function
     */
    async create(data: {
        workspaceId: string
        functionName: string
        description: string
        parameters: any
        executionType: string
        isActive?: boolean
        isSystemFunction?: boolean
        webhookUrl?: string | null
        responseInstructions?: string | null
        credentialsMapping?: any | null
    }): Promise<WorkspaceCallingFunction> {
        try {
            return await this.prisma.workspaceCallingFunction.create({
                data: {
                    ...data,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    isSystemFunction: data.isSystemFunction || false,
                    webhookUrl: data.webhookUrl || null,
                    credentialsMapping: data.credentialsMapping || null
                }
            })
        } catch (error) {
            logger.error(`Error creating calling function ${data.functionName} for workspace ${data.workspaceId}:`, error)
            throw error
        }
    }

    /**
     * Update an existing calling function
     */
    async update(workspaceId: string, functionName: string, data: Partial<WorkspaceCallingFunction>): Promise<WorkspaceCallingFunction> {
        try {
            return await this.prisma.workspaceCallingFunction.update({
                where: {
                    workspaceId_functionName: {
                        workspaceId,
                        functionName
                    }
                },
                data
            })
        } catch (error) {
            logger.error(`Error updating calling function ${functionName} for workspace ${workspaceId}:`, error)
            throw error
        }
    }

    /**
     * Delete a calling function
     */
    async delete(workspaceId: string, functionName: string): Promise<WorkspaceCallingFunction> {
        try {
            return await this.prisma.workspaceCallingFunction.delete({
                where: {
                    workspaceId_functionName: {
                        workspaceId,
                        functionName
                    }
                }
            })
        } catch (error) {
            logger.error(`Error deleting calling function ${functionName} from workspace ${workspaceId}:`, error)
            throw error
        }
    }
}
