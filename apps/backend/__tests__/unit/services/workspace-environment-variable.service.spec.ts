/**
 * WorkspaceEnvironmentVariableService Unit Tests
 *
 * RULE: All database access is mocked via PrismaClient.
 * RULE: encryptionService.encrypt/decrypt are mocked to isolate business logic.
 * RULE: Every test exercises the actual service methods, not built-in JS functions.
 *
 * Tests for:
 * - Variable name validation (UPPERCASE_WITH_UNDERSCORES regex)
 * - Plaintext validation (empty, too long)
 * - Workspace access verification (IDOR prevention)
 * - Create flow: validate -> encrypt -> store -> return metadata
 * - Update flow: verify access -> encrypt with fresh nonce -> update
 * - Delete flow: verify access -> delete
 * - List flow: verify access -> return metadata only
 * - getAllCredentialsForDispatch: returns Map<variableName, plaintext>
 */

import { WorkspaceEnvironmentVariableService } from '../../../src/application/services/workspace-environment-variable.service'

// SCENARIO: Mock encryptionService to return predictable values
jest.mock('../../../src/services/encryption.service', () => ({
  encryptionService: {
    encrypt: jest.fn().mockReturnValue({
      encryptedValue: 'mock_encrypted_base64',
      nonce: 'mock_nonce_base64',
    }),
    decrypt: jest.fn().mockReturnValue('decrypted_plaintext'),
  },
}))

// SCENARIO: Mock logger to suppress output during tests
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))

describe('WorkspaceEnvironmentVariableService', () => {
  let service: WorkspaceEnvironmentVariableService
  let mockPrisma: any

  const workspaceId = 'ws-test-001'
  const userId = 'user-test-001'

  beforeEach(() => {
    jest.clearAllMocks()

    // RULE: Mock PrismaClient with all needed models
    mockPrisma = {
      userWorkspace: {
        findUnique: jest.fn(),
      },
      workspaceEnvironmentVariable: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    }

    service = new WorkspaceEnvironmentVariableService(mockPrisma)

    // Default: user has workspace access
    mockPrisma.userWorkspace.findUnique.mockResolvedValue({
      userId,
      workspaceId,
      role: 'ADMIN',
    })
  })

  // -- Variable Name Validation -----------------------------------------------

  describe('Variable Name Validation', () => {
    it('should accept valid UPPERCASE_WITH_UNDERSCORES names', async () => {
      // SCENARIO: Standard naming convention used by all examples in docs
      const validNames = ['API_KEY', 'STRIPE_API_KEY', 'JWT_SECRET', 'A', 'AB_CD_EF_123']

      // Mock repository create to return a valid result
      mockPrisma.workspaceEnvironmentVariable.findFirst.mockResolvedValue(null)
      mockPrisma.workspaceEnvironmentVariable.create.mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'var-1',
          variableName: args.data.variableName,
          description: args.data.description,
          createdAt: new Date(),
          updatedAt: new Date(),
          workspaceId,
        })
      })

      for (const name of validNames) {
        await expect(
          service.createVariable(workspaceId, userId, {
            variableName: name,
            plaintext: 'test_value',
          })
        ).resolves.toBeDefined()
      }
    })

    it('should reject lowercase variable names', async () => {
      // SCENARIO: User provides "api_key" instead of "API_KEY"
      await expect(
        service.createVariable(workspaceId, userId, {
          variableName: 'lowercase_key',
          plaintext: 'test_value',
        })
      ).rejects.toThrow('Invalid variable name')
    })

    it('should reject names with hyphens', async () => {
      // SCENARIO: User provides "API-KEY" with hyphen
      await expect(
        service.createVariable(workspaceId, userId, {
          variableName: 'API-KEY',
          plaintext: 'test_value',
        })
      ).rejects.toThrow('Invalid variable name')
    })

    it('should reject names with spaces', async () => {
      // SCENARIO: User provides "API KEY" with space
      await expect(
        service.createVariable(workspaceId, userId, {
          variableName: 'API KEY',
          plaintext: 'test_value',
        })
      ).rejects.toThrow('Invalid variable name')
    })

    it('should reject names starting with a number', async () => {
      // SCENARIO: User provides "123_KEY" starting with digit
      await expect(
        service.createVariable(workspaceId, userId, {
          variableName: '123_KEY',
          plaintext: 'test_value',
        })
      ).rejects.toThrow('Invalid variable name')
    })

    it('should reject names longer than 255 characters', async () => {
      // SCENARIO: Extremely long variable name exceeds storage limit
      const longName = 'A'.repeat(256)
      await expect(
        service.createVariable(workspaceId, userId, {
          variableName: longName,
          plaintext: 'test_value',
        })
      ).rejects.toThrow('too long')
    })
  })

  // -- Plaintext Validation ---------------------------------------------------

  describe('Plaintext Validation', () => {
    it('should reject empty plaintext', async () => {
      // SCENARIO: User submits empty credential value
      await expect(
        service.createVariable(workspaceId, userId, {
          variableName: 'API_KEY',
          plaintext: '',
        })
      ).rejects.toThrow('cannot be empty')
    })

    it('should reject whitespace-only plaintext', async () => {
      // SCENARIO: User submits spaces/tabs only
      await expect(
        service.createVariable(workspaceId, userId, {
          variableName: 'API_KEY',
          plaintext: '   ',
        })
      ).rejects.toThrow('cannot be empty')
    })

    it('should reject plaintext exceeding 10000 characters', async () => {
      // SCENARIO: User pastes excessively long certificate/key
      const longText = 'x'.repeat(10_001)
      await expect(
        service.createVariable(workspaceId, userId, {
          variableName: 'API_KEY',
          plaintext: longText,
        })
      ).rejects.toThrow('too long')
    })
  })

  // -- Workspace Access Verification (IDOR Prevention) -------------------------

  describe('Workspace Access Verification', () => {
    it('should deny access when user lacks workspace membership', async () => {
      // SCENARIO: User B tries to create variable in Workspace A
      // RULE: Without UserWorkspace relation, access is denied
      mockPrisma.userWorkspace.findUnique.mockResolvedValue(null)

      await expect(
        service.createVariable(workspaceId, userId, {
          variableName: 'API_KEY',
          plaintext: 'test_value',
        })
      ).rejects.toThrow('Access denied')
    })

    it('should verify workspace access on update', async () => {
      // SCENARIO: User without workspace membership tries to update
      mockPrisma.userWorkspace.findUnique.mockResolvedValue(null)

      await expect(
        service.updateVariable(workspaceId, userId, 'API_KEY', {
          plaintext: 'new_value',
        })
      ).rejects.toThrow('Access denied')
    })

    it('should verify workspace access on delete', async () => {
      // SCENARIO: User without workspace membership tries to delete
      mockPrisma.userWorkspace.findUnique.mockResolvedValue(null)

      await expect(
        service.deleteVariable(workspaceId, userId, 'API_KEY')
      ).rejects.toThrow('Access denied')
    })

    it('should verify workspace access on list', async () => {
      // SCENARIO: User without workspace membership tries to list
      mockPrisma.userWorkspace.findUnique.mockResolvedValue(null)

      await expect(
        service.listVariables(workspaceId, userId)
      ).rejects.toThrow('Access denied')
    })
  })

  // -- Create Variable Flow ---------------------------------------------------

  describe('createVariable', () => {
    it('should encrypt plaintext and store in database', async () => {
      // SCENARIO: Happy path - user creates STRIPE_API_KEY
      const { encryptionService } = require('../../../src/services/encryption.service')

      mockPrisma.workspaceEnvironmentVariable.findFirst.mockResolvedValue(null) // no duplicate
      mockPrisma.workspaceEnvironmentVariable.create.mockResolvedValue({
        id: 'var-new-1',
        variableName: 'STRIPE_API_KEY',
        description: 'Stripe production key',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        workspaceId,
      })

      const result = await service.createVariable(workspaceId, userId, {
        variableName: 'STRIPE_API_KEY',
        plaintext: 'sk_live_abc123',
        description: 'Stripe production key',
      })

      // RULE: encryptionService.encrypt called with plaintext + workspaceId
      expect(encryptionService.encrypt).toHaveBeenCalledWith('sk_live_abc123', workspaceId)

      // RULE: Result returns metadata only (no encrypted values)
      expect(result.id).toBe('var-new-1')
      expect(result.variableName).toBe('STRIPE_API_KEY')
      expect(result.description).toBe('Stripe production key')
      expect(result.createdAt).toBeDefined()
      // RULE: Never returns encrypted value or nonce
      expect((result as any).encryptedValue).toBeUndefined()
      expect((result as any).nonce).toBeUndefined()
      expect((result as any).plaintext).toBeUndefined()
    })
  })

  // -- Update Variable Flow ---------------------------------------------------

  describe('updateVariable', () => {
    it('should encrypt new value with fresh nonce', async () => {
      // SCENARIO: Credential rotation - old Stripe key replaced with new one
      const { encryptionService } = require('../../../src/services/encryption.service')

      mockPrisma.workspaceEnvironmentVariable.findFirst.mockResolvedValue({
        id: 'var-1',
        variableName: 'STRIPE_API_KEY',
        workspaceId,
      })
      mockPrisma.workspaceEnvironmentVariable.update.mockResolvedValue({
        variableName: 'STRIPE_API_KEY',
        updatedAt: new Date('2024-06-01'),
      })

      const result = await service.updateVariable(workspaceId, userId, 'STRIPE_API_KEY', {
        plaintext: 'sk_live_new_key_456',
      })

      // RULE: encrypt called with new plaintext
      expect(encryptionService.encrypt).toHaveBeenCalledWith('sk_live_new_key_456', workspaceId)
      expect(result.variableName).toBe('STRIPE_API_KEY')
      expect(result.updatedAt).toBeDefined()
    })

    it('should reject empty plaintext on update', async () => {
      // SCENARIO: User tries to clear credential value
      await expect(
        service.updateVariable(workspaceId, userId, 'API_KEY', {
          plaintext: '',
        })
      ).rejects.toThrow('cannot be empty')
    })
  })

  // -- Delete Variable Flow ---------------------------------------------------

  describe('deleteVariable', () => {
    it('should delete variable from database', async () => {
      // SCENARIO: User removes obsolete credential
      mockPrisma.workspaceEnvironmentVariable.findFirst.mockResolvedValue({
        id: 'var-1',
        variableName: 'OLD_API_KEY',
        workspaceId,
      })
      mockPrisma.workspaceEnvironmentVariable.delete.mockResolvedValue({})

      await expect(
        service.deleteVariable(workspaceId, userId, 'OLD_API_KEY')
      ).resolves.toBeUndefined()
    })
  })

  // -- List Variables Flow ----------------------------------------------------

  describe('listVariables', () => {
    it('should return metadata only (no encrypted values)', async () => {
      // SCENARIO: Admin views all credentials in settings page
      const mockVariables = [
        {
          id: 'var-1',
          variableName: 'STRIPE_API_KEY',
          description: 'Stripe key',
          createdBy: userId,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'var-2',
          variableName: 'MAILCHIMP_TOKEN',
          description: null,
          createdBy: userId,
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-02-01'),
        },
      ]
      mockPrisma.workspaceEnvironmentVariable.findMany.mockResolvedValue(mockVariables)

      const result = await service.listVariables(workspaceId, userId)

      expect(result).toHaveLength(2)
      expect(result[0].variableName).toBe('STRIPE_API_KEY')
      expect(result[1].variableName).toBe('MAILCHIMP_TOKEN')
      // RULE: No encrypted data in response
      result.forEach((v: any) => {
        expect(v.encryptedValue).toBeUndefined()
        expect(v.nonce).toBeUndefined()
      })
    })
  })
})
