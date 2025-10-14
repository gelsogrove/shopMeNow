/**
 * SQL Injection Security Tests
 * 
 * Verifies that the application is protected against SQL injection attacks
 * in all critical endpoints that interact with the database.
 */

import { Request, Response, NextFunction } from 'express'
import { AgentController } from '../../interfaces/http/controllers/agent.controller'
import { AgentService } from '../../application/services/agent.service'
import { WorkspaceService } from '../../application/services/workspace.service'
import { prisma } from '../../lib/prisma'

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  prisma: {
    workspace: {
      findUnique: jest.fn(),
    },
    agent: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('../../application/services/workspace.service')
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

describe('SQL Injection Protection', () => {
  let agentController: AgentController
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    // Setup controller
    const mockAgentService = {
      getAllForWorkspace: jest.fn().mockResolvedValue([]),
    } as unknown as AgentService

    agentController = new AgentController(mockAgentService)

    // Setup response mock
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }

    mockNext = jest.fn()

    jest.clearAllMocks()
  })

  describe('agent.controller.ts - getAllForWorkspace', () => {
    it('should reject SQL injection attempt via workspaceId parameter', async () => {
      const sqlInjectionPayload = "'; DROP TABLE Workspace; --"

      mockRequest = {
        params: { workspaceId: sqlInjectionPayload },
        headers: {},
      } as any

      // Mock WorkspaceService to return null (workspace not found)
      const mockGetById = jest.fn().mockResolvedValue(null)
      ;(WorkspaceService as jest.Mock).mockImplementation(() => ({
        getById: mockGetById,
      }))

      await agentController.getAllForWorkspace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Should respond with 404, not execute malicious SQL
      expect(mockResponse.status).toHaveBeenCalledWith(404)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Workspace not found',
        workspaceId: sqlInjectionPayload,
      })

      // Verify Prisma was called with the malicious string (safe because it's parameterized)
      expect(mockGetById).toHaveBeenCalledWith(sqlInjectionPayload)
    })

    it('should reject SQL injection attempt via header', async () => {
      const sqlInjectionPayload = "' OR '1'='1"

      mockRequest = {
        params: {},
        headers: { 'x-workspace-id': sqlInjectionPayload },
      } as any

      const mockGetById = jest.fn().mockResolvedValue(null)
      ;(WorkspaceService as jest.Mock).mockImplementation(() => ({
        getById: mockGetById,
      }))

      await agentController.getAllForWorkspace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(mockResponse.status).toHaveBeenCalledWith(404)
      expect(mockGetById).toHaveBeenCalledWith(sqlInjectionPayload)
    })

    it('should handle normal workspaceId without issues', async () => {
      const validWorkspaceId = 'cm9hjgq9v00014qk8fsdy4ujv'

      mockRequest = {
        params: { workspaceId: validWorkspaceId },
        headers: {},
      } as any

      const mockWorkspace = { id: validWorkspaceId, name: 'Test Workspace' }
      const mockGetById = jest.fn().mockResolvedValue(mockWorkspace)
      ;(WorkspaceService as jest.Mock).mockImplementation(() => ({
        getById: mockGetById,
      }))

      const mockGetAllForWorkspace = jest.fn().mockResolvedValue([
        { id: '1', name: 'Agent 1' },
        { id: '2', name: 'Agent 2' },
      ])

      agentController = new AgentController({
        getAllForWorkspace: mockGetAllForWorkspace,
      } as unknown as AgentService)

      await agentController.getAllForWorkspace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      expect(mockResponse.json).toHaveBeenCalledWith([
        { id: '1', name: 'Agent 1' },
        { id: '2', name: 'Agent 2' },
      ])
      expect(mockGetById).toHaveBeenCalledWith(validWorkspaceId)
    })

    it('should NOT expose raw SQL queries in response', async () => {
      mockRequest = {
        params: {},
        headers: {},
      } as any

      await agentController.getAllForWorkspace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0]?.[0]

      // Verify response does NOT contain SQL keywords
      const responseString = JSON.stringify(responseCall)
      expect(responseString).not.toMatch(/SELECT.*FROM.*WHERE/i)
      expect(responseString).not.toContain('sqlQuery')
    })
  })

  describe('SQL Injection Attack Patterns', () => {
    const attackPayloads = [
      "'; DROP TABLE Users; --",
      "' OR '1'='1",
      "admin'--",
      "' OR 1=1--",
      "' UNION SELECT NULL--",
      "1'; DELETE FROM Workspace WHERE '1'='1",
      "'; EXEC xp_cmdshell('dir'); --",
      "' AND 1=0 UNION ALL SELECT 'admin', 'password'--",
    ]

    attackPayloads.forEach((payload) => {
      it(`should safely handle attack payload: "${payload}"`, async () => {
        mockRequest = {
          params: { workspaceId: payload },
          headers: {},
        } as any

        const mockGetById = jest.fn().mockResolvedValue(null)
        ;(WorkspaceService as jest.Mock).mockImplementation(() => ({
          getById: mockGetById,
        }))

        await agentController.getAllForWorkspace(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )

        // Should fail gracefully, not execute SQL
        expect(mockResponse.status).toHaveBeenCalledWith(404)
        expect(mockGetById).toHaveBeenCalledWith(payload)
      })
    })
  })
})
