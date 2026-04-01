/**
 * WorkspaceEnvironmentVariableController Unit Tests
 *
 * RULE: Tests exercise actual controller methods with mocked req/res objects.
 * RULE: Service layer is mocked to isolate HTTP handling logic.
 * RULE: Tests verify HTTP status codes, response shapes, and error mapping.
 *
 * Tests for:
 * - GET endpoint returns metadata (never encrypted values)
 * - POST validates input and returns 201 on success
 * - PATCH validates input and returns 200 on success
 * - DELETE returns 200 on success, 404 on not found
 * - 401 when userId is missing (no auth middleware)
 * - Error message mapping to HTTP status codes (400/404/500)
 */

import { Request, Response } from 'express'
import { WorkspaceEnvironmentVariableController } from '../../../src/interfaces/http/controllers/workspace-environment-variable.controller'

// SCENARIO: Mock the service to isolate controller HTTP logic
jest.mock('../../../src/application/services/workspace-environment-variable.service', () => ({
  WorkspaceEnvironmentVariableService: jest.fn().mockImplementation(() => ({
    listVariables: jest.fn(),
    createVariable: jest.fn(),
    updateVariable: jest.fn(),
    deleteVariable: jest.fn(),
  })),
}))

// SCENARIO: Mock logger to suppress output during tests
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))

describe('WorkspaceEnvironmentVariableController', () => {
  let controller: WorkspaceEnvironmentVariableController
  let mockService: any
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let statusFn: jest.Mock
  let jsonFn: jest.Mock

  const workspaceId = 'ws-ctrl-001'
  const userId = 'user-ctrl-001'

  beforeEach(() => {
    jest.clearAllMocks()

    // RULE: Create controller with mocked prisma
    const mockPrisma = {} as any
    controller = new WorkspaceEnvironmentVariableController(mockPrisma)

    // Access the mocked service instance
    mockService = (controller as any).service

    // RULE: Mock Express req/res objects
    jsonFn = jest.fn()
    statusFn = jest.fn().mockReturnThis()

    mockReq = {
      body: {},
      params: {},
    } as any
    ;(mockReq as any).workspaceId = workspaceId
    ;(mockReq as any).user = { id: userId }

    mockRes = {
      json: jsonFn,
      status: statusFn,
    } as any
    // When status().json() is called, capture the json arg
    statusFn.mockReturnValue({ json: jsonFn })
  })

  // -- GET /env-vars ----------------------------------------------------------

  describe('listVariables', () => {
    it('should return 200 with variable metadata', async () => {
      // SCENARIO: Admin requests list of all credentials for workspace
      const mockVariables = [
        { id: 'v1', variableName: 'STRIPE_KEY', description: 'Stripe', createdAt: new Date() },
        { id: 'v2', variableName: 'MAILCHIMP_KEY', description: null, createdAt: new Date() },
      ]
      mockService.listVariables.mockResolvedValue(mockVariables)

      await controller.listVariables(mockReq as Request, mockRes as Response)

      // RULE: Service called with correct workspace + user
      expect(mockService.listVariables).toHaveBeenCalledWith(workspaceId, userId)
      // RULE: Response contains data array and count
      expect(jsonFn).toHaveBeenCalledWith({
        data: mockVariables,
        count: 2,
      })
    })

    it('should return 401 when user is not authenticated', async () => {
      // SCENARIO: Request reaches controller without auth middleware setting user
      ;(mockReq as any).user = undefined

      await controller.listVariables(mockReq as Request, mockRes as Response)

      expect(statusFn).toHaveBeenCalledWith(401)
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Unauthorized' })
    })

    it('should return 500 when service throws unexpected error', async () => {
      // SCENARIO: Database connection error during list
      mockService.listVariables.mockRejectedValue(new Error('Database connection lost'))

      await controller.listVariables(mockReq as Request, mockRes as Response)

      expect(statusFn).toHaveBeenCalledWith(500)
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to list environment variables',
        })
      )
    })
  })

  // -- POST /env-vars ---------------------------------------------------------

  describe('createVariable', () => {
    it('should return 201 with variable metadata on success', async () => {
      // SCENARIO: Admin creates new STRIPE_API_KEY credential
      mockReq.body = {
        variableName: 'STRIPE_API_KEY',
        plaintext: 'sk_live_abc123',
        description: 'Stripe production key',
      }

      const mockResult = {
        id: 'var-new-1',
        variableName: 'STRIPE_API_KEY',
        description: 'Stripe production key',
        createdAt: new Date(),
      }
      mockService.createVariable.mockResolvedValue(mockResult)

      await controller.createVariable(mockReq as Request, mockRes as Response)

      // RULE: Service called with workspace, user, and input
      expect(mockService.createVariable).toHaveBeenCalledWith(
        workspaceId,
        userId,
        expect.objectContaining({
          variableName: 'STRIPE_API_KEY',
          plaintext: 'sk_live_abc123',
        })
      )
      // RULE: 201 Created status
      expect(statusFn).toHaveBeenCalledWith(201)
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockResult,
        })
      )
    })

    it('should return 400 when variableName is missing', async () => {
      // SCENARIO: Request body missing variableName field
      mockReq.body = { plaintext: 'some_value' }

      await controller.createVariable(mockReq as Request, mockRes as Response)

      expect(statusFn).toHaveBeenCalledWith(400)
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid input',
          details: expect.stringContaining('variableName'),
        })
      )
    })

    it('should return 400 when plaintext is missing', async () => {
      // SCENARIO: Request body missing plaintext field
      mockReq.body = { variableName: 'API_KEY' }

      await controller.createVariable(mockReq as Request, mockRes as Response)

      expect(statusFn).toHaveBeenCalledWith(400)
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid input',
          details: expect.stringContaining('plaintext'),
        })
      )
    })

    it('should return 400 when service throws validation error', async () => {
      // SCENARIO: Service rejects due to invalid variable name format
      mockReq.body = {
        variableName: 'STRIPE_API_KEY',
        plaintext: 'value',
      }
      mockService.createVariable.mockRejectedValue(
        new Error('Invalid variable name. Use UPPERCASE with underscores only')
      )

      await controller.createVariable(mockReq as Request, mockRes as Response)

      expect(statusFn).toHaveBeenCalledWith(400)
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
        })
      )
    })

    it('should return 400 when variable already exists', async () => {
      // SCENARIO: Duplicate variable name for same workspace
      mockReq.body = {
        variableName: 'API_KEY',
        plaintext: 'value',
      }
      mockService.createVariable.mockRejectedValue(
        new Error('Variable "API_KEY" already exists')
      )

      await controller.createVariable(mockReq as Request, mockRes as Response)

      expect(statusFn).toHaveBeenCalledWith(400)
    })

    it('should return 401 when user is not authenticated', async () => {
      // SCENARIO: No auth middleware set user
      ;(mockReq as any).user = undefined
      mockReq.body = { variableName: 'API_KEY', plaintext: 'val' }

      await controller.createVariable(mockReq as Request, mockRes as Response)

      expect(statusFn).toHaveBeenCalledWith(401)
    })

    it('should not trim plaintext (spaces may be significant in API keys)', async () => {
      // SCENARIO: API key with trailing space " sk_live_abc " must be preserved
      // RULE: Controller must NOT call plaintext.trim() - P2 fix from review
      mockReq.body = {
        variableName: 'API_KEY',
        plaintext: ' sk_live_abc ',
      }
      mockService.createVariable.mockResolvedValue({
        id: 'v1',
        variableName: 'API_KEY',
        description: null,
        createdAt: new Date(),
      })

      await controller.createVariable(mockReq as Request, mockRes as Response)

      // RULE: plaintext passed to service UNTRIMMED
      const callArgs = mockService.createVariable.mock.calls[0][2]
      expect(callArgs.plaintext).toBe(' sk_live_abc ')
    })
  })

  // -- PATCH /env-vars/:variableName ------------------------------------------

  describe('updateVariable', () => {
    it('should return 200 with updated metadata on success', async () => {
      // SCENARIO: Admin rotates STRIPE_API_KEY credential
      mockReq.params = { variableName: 'STRIPE_API_KEY' }
      mockReq.body = { plaintext: 'sk_live_new_key' }

      mockService.updateVariable.mockResolvedValue({
        variableName: 'STRIPE_API_KEY',
        updatedAt: new Date(),
      })

      await controller.updateVariable(mockReq as Request, mockRes as Response)

      expect(mockService.updateVariable).toHaveBeenCalledWith(
        workspaceId,
        userId,
        'STRIPE_API_KEY',
        expect.objectContaining({ plaintext: 'sk_live_new_key' })
      )
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ variableName: 'STRIPE_API_KEY' }),
        })
      )
    })

    it('should return 400 when plaintext is missing', async () => {
      // SCENARIO: Update request without new credential value
      mockReq.params = { variableName: 'API_KEY' }
      mockReq.body = {}

      await controller.updateVariable(mockReq as Request, mockRes as Response)

      expect(statusFn).toHaveBeenCalledWith(400)
    })

    it('should return 404 when variable not found', async () => {
      // SCENARIO: Trying to update non-existent variable
      mockReq.params = { variableName: 'NONEXISTENT_KEY' }
      mockReq.body = { plaintext: 'new_value' }
      mockService.updateVariable.mockRejectedValue(
        new Error('Variable "NONEXISTENT_KEY" not found')
      )

      await controller.updateVariable(mockReq as Request, mockRes as Response)

      expect(statusFn).toHaveBeenCalledWith(404)
    })

    it('should not trim plaintext on update', async () => {
      // RULE: Spaces preserved in credentials during rotation
      mockReq.params = { variableName: 'API_KEY' }
      mockReq.body = { plaintext: ' key with spaces ' }
      mockService.updateVariable.mockResolvedValue({
        variableName: 'API_KEY',
        updatedAt: new Date(),
      })

      await controller.updateVariable(mockReq as Request, mockRes as Response)

      const callArgs = mockService.updateVariable.mock.calls[0][3]
      expect(callArgs.plaintext).toBe(' key with spaces ')
    })
  })

  // -- DELETE /env-vars/:variableName -----------------------------------------

  describe('deleteVariable', () => {
    it('should return 200 with success message', async () => {
      // SCENARIO: Admin deletes obsolete credential
      mockReq.params = { variableName: 'OLD_API_KEY' }
      mockService.deleteVariable.mockResolvedValue(undefined)

      await controller.deleteVariable(mockReq as Request, mockRes as Response)

      expect(mockService.deleteVariable).toHaveBeenCalledWith(
        workspaceId,
        userId,
        'OLD_API_KEY'
      )
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('OLD_API_KEY'),
        })
      )
    })

    it('should return 404 when variable not found', async () => {
      // SCENARIO: Trying to delete non-existent variable
      mockReq.params = { variableName: 'NONEXISTENT' }
      mockService.deleteVariable.mockRejectedValue(
        new Error('Variable "NONEXISTENT" not found')
      )

      await controller.deleteVariable(mockReq as Request, mockRes as Response)

      expect(statusFn).toHaveBeenCalledWith(404)
    })

    it('should return 401 when user is not authenticated', async () => {
      // SCENARIO: No auth middleware set user
      ;(mockReq as any).user = undefined
      mockReq.params = { variableName: 'API_KEY' }

      await controller.deleteVariable(mockReq as Request, mockRes as Response)

      expect(statusFn).toHaveBeenCalledWith(401)
    })
  })
})
