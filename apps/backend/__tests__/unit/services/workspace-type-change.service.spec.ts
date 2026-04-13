/**
 * Unit Tests: Workspace Type Change — sync calling functions & reset prompts
 *
 * RULE: When channelMode changes (info ↔ ecommerce):
 *   1. Ecommerce-only SYSTEM calling functions are enabled/created or disabled
 *   2. Custom (non-system) calling functions are NEVER touched
 *   3. All default agent prompts are reset to the correct templates for the new type
 *
 * ECOMMERCE-ONLY system functions: productSearchAgent, cartManagementAgent, orderTrackingAgent
 * ALWAYS-ON system functions: customerSupportAgent, profileManagementAgent, manageNotifications
 */

import { WorkspaceService } from '../../../src/application/services/workspace.service'

// ── Mock dynamicAgents ────────────────────────────────────────────────────────
jest.mock('../../../prisma/data/dynamicAgents', () => ({
  dynamicAgents: jest.fn((workspaceId: string, channelMode: string) => {
    const isEcom = channelMode === 'ECOMMERCE'
    return [
    {
      name: isEcom ? 'Router Agent' : 'Info Agent',
      type: isEcom ? 'ROUTER' : 'INFO_AGENT',
      systemPrompt: isEcom ? 'ecommerce-router-prompt' : 'info-agent-prompt',
      model: 'openai/gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 4096,
      order: 0,
      isActive: true,
      availableFunctions: null,
    },
  ]
  }),
}))

// ── Mock WasenderClientService ────────────────────────────────────────────────
jest.mock('../../../src/services/wasender-client.service', () => ({
  WasenderClientService: jest.fn().mockImplementation(() => ({
    deleteSession: jest.fn().mockResolvedValue({}),
  })),
}))

// ── Mock WorkspaceRepository ──────────────────────────────────────────────────
const mockRepoUpdate = jest.fn()
jest.mock('../../../src/repositories/workspace.repository', () => ({
  WorkspaceRepository: jest.fn().mockImplementation(() => ({
    update: mockRepoUpdate,
    updateAgentStatus: jest.fn().mockResolvedValue({}),
    findBySlug: jest.fn().mockResolvedValue(null),
  })),
}))

// ── Mock logger (silence output in tests) ────────────────────────────────────
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockFindUnique = jest.fn()
const mockUpdateMany = jest.fn()
const mockCallingFunctionFindUnique = jest.fn()
const mockCallingFunctionUpdate = jest.fn()
const mockCallingFunctionCreate = jest.fn()
const mockAgentConfigUpsert = jest.fn()
const mockAgentConfigDeleteMany = jest.fn()
const mockUserFindUnique = jest.fn()

jest.mock('@echatbot/database', () => ({
  prisma: {
    workspace: { findUnique: (...args: any[]) => mockFindUnique(...args) },
    workspaceCallingFunction: {
      findUnique: (...args: any[]) => mockCallingFunctionFindUnique(...args),
      update: (...args: any[]) => mockCallingFunctionUpdate(...args),
      create: (...args: any[]) => mockCallingFunctionCreate(...args),
      updateMany: (...args: any[]) => mockUpdateMany(...args),
    },
    agentConfig: { upsert: (...args: any[]) => mockAgentConfigUpsert(...args), deleteMany: (...args: any[]) => mockAgentConfigDeleteMany(...args) },
    user: { findUnique: (...args: any[]) => mockUserFindUnique(...args) },
  },
  PrismaClient: jest.fn().mockImplementation(() => ({
    workspace: { findUnique: (...args: any[]) => mockFindUnique(...args) },
    workspaceCallingFunction: {
      findUnique: (...args: any[]) => mockCallingFunctionFindUnique(...args),
      update: (...args: any[]) => mockCallingFunctionUpdate(...args),
      create: (...args: any[]) => mockCallingFunctionCreate(...args),
      updateMany: (...args: any[]) => mockUpdateMany(...args),
    },
    agentConfig: { upsert: (...args: any[]) => mockAgentConfigUpsert(...args), deleteMany: (...args: any[]) => mockAgentConfigDeleteMany(...args) },
    user: { findUnique: (...args: any[]) => mockUserFindUnique(...args) },
  })),
}))

// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-test-001'
const ECOMMERCE_ONLY_FUNCTIONS = ['productSearchAgent', 'cartManagementAgent', 'orderTrackingAgent']

// Helper: build a mock currentWorkspace
function makeCurrentWorkspace(isEcommerce: boolean) {
  return {
    enableWidget: false,
    enableWhatsapp: true,
    channelMode: isEcommerce ? 'ECOMMERCE' : 'INFORMATIONAL',
    ownerId: 'owner-1',
    deletedAt: null,
    whatsappProvider: 'ultramsg',
    wasenderSessionId: null,
  }
}

describe('WorkspaceService — type change (channelMode)', () => {
  let service: WorkspaceService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WorkspaceService()

    // Default: user is STANDARD plan (bypasses FREE_TRIAL guard)
    mockUserFindUnique.mockResolvedValue({ planType: 'STANDARD' })
    // Default: repo.update returns a minimal workspace
    mockRepoUpdate.mockResolvedValue({ id: WORKSPACE_ID, channelMode: 'ECOMMERCE' as any })
    // Default: agentConfig.upsert succeeds
    mockAgentConfigUpsert.mockResolvedValue({})
    // Default: agentConfig.deleteMany (cleanup of invalid agents after mode change) succeeds
    mockAgentConfigDeleteMany.mockResolvedValue({ count: 0 })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // SCENARIO: info → ecommerce (channelMode: 'INFORMATIONAL' as any → true)
  // ──────────────────────────────────────────────────────────────────────────

  describe('Switching from info → ecommerce', () => {
    beforeEach(() => {
      // GIVEN: workspace was in info mode
      mockFindUnique.mockResolvedValue(makeCurrentWorkspace(false))
    })

    it('re-enables existing ecommerce system functions', async () => {
      // GIVEN: all three ecommerce functions exist but are disabled
      mockCallingFunctionFindUnique.mockResolvedValue({ id: 'fn-1', isActive: false, isSystemFunction: true })
      mockCallingFunctionUpdate.mockResolvedValue({})

      await service.update(WORKSPACE_ID, { channelMode: 'ECOMMERCE' as any })

      // THEN: update is called for each ecommerce function with isActive: true
      for (const fnName of ECOMMERCE_ONLY_FUNCTIONS) {
        expect(mockCallingFunctionUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { workspaceId_functionName: { workspaceId: WORKSPACE_ID, functionName: fnName } },
            data: { isActive: true },
          })
        )
      }
    })

    it('creates ecommerce system functions if they are missing', async () => {
      // GIVEN: ecommerce functions do not exist yet (findUnique returns null)
      mockCallingFunctionFindUnique.mockResolvedValue(null)
      mockCallingFunctionCreate.mockResolvedValue({})

      await service.update(WORKSPACE_ID, { channelMode: 'ECOMMERCE' as any })

      // THEN: create is called for each ecommerce function
      for (const fnName of ECOMMERCE_ONLY_FUNCTIONS) {
        expect(mockCallingFunctionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              workspaceId: WORKSPACE_ID,
              functionName: fnName,
              isSystemFunction: true,
              executionType: 'DELEGATE_TO_AGENT',
              isActive: true,
            }),
          })
        )
      }
    })

    it('does NOT call updateMany (that is for info direction only)', async () => {
      mockCallingFunctionFindUnique.mockResolvedValue({ id: 'fn-1', isActive: false })
      mockCallingFunctionUpdate.mockResolvedValue({})

      await service.update(WORKSPACE_ID, { channelMode: 'ECOMMERCE' as any })

      // RULE: updateMany (bulk-disable) is only used when switching TO info
      expect(mockUpdateMany).not.toHaveBeenCalled()
    })

    it('resets agent prompts to ecommerce templates', async () => {
      mockCallingFunctionFindUnique.mockResolvedValue({ id: 'fn-1', isActive: false })
      mockCallingFunctionUpdate.mockResolvedValue({})

      await service.update(WORKSPACE_ID, { channelMode: 'ECOMMERCE' as any })

      // THEN: agentConfig.upsert is called with ecommerce agent type
      expect(mockAgentConfigUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId_type: { workspaceId: WORKSPACE_ID, type: 'ROUTER' } },
          update: expect.objectContaining({ systemPrompt: 'ecommerce-router-prompt' }),
        })
      )
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // SCENARIO: ecommerce → info (channelMode: 'ECOMMERCE' as any → false)
  // ──────────────────────────────────────────────────────────────────────────

  describe('Switching from ecommerce → info', () => {
    beforeEach(() => {
      // GIVEN: workspace was in ecommerce mode
      mockFindUnique.mockResolvedValue(makeCurrentWorkspace(true))
      mockUpdateMany.mockResolvedValue({ count: 3 })
    })

    it('bulk-disables ecommerce-only SYSTEM functions via updateMany', async () => {
      await service.update(WORKSPACE_ID, { channelMode: 'INFORMATIONAL' as any })

      // THEN: updateMany is called targeting only isSystemFunction: true + ecommerce function names
      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            functionName: { in: ECOMMERCE_ONLY_FUNCTIONS },
            isSystemFunction: true, // CRITICAL: custom functions are safe
          }),
          data: { isActive: false },
        })
      )
    })

    it('does NOT try to find/update individual functions (uses bulk updateMany only)', async () => {
      await service.update(WORKSPACE_ID, { channelMode: 'INFORMATIONAL' as any })

      // RULE: no individual findUnique/update when switching TO info (bulk is enough)
      expect(mockCallingFunctionFindUnique).not.toHaveBeenCalled()
      expect(mockCallingFunctionUpdate).not.toHaveBeenCalled()
    })

    it('resets agent prompts to informational templates', async () => {
      await service.update(WORKSPACE_ID, { channelMode: 'INFORMATIONAL' as any })

      // THEN: agentConfig.upsert is called with info agent type
      expect(mockAgentConfigUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId_type: { workspaceId: WORKSPACE_ID, type: 'INFO_AGENT' } },
          update: expect.objectContaining({ systemPrompt: 'info-agent-prompt' }),
        })
      )
    })

    it('creates missing info agents that did not exist before (upsert create path)', async () => {
      await service.update(WORKSPACE_ID, { channelMode: 'INFORMATIONAL' as any })

      // THEN: upsert includes a create block with workspaceId for new agents
      expect(mockAgentConfigUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            type: 'INFO_AGENT',
            systemPrompt: 'info-agent-prompt',
          }),
        })
      )
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // SCENARIO: no actual type change (value unchanged)
  // ──────────────────────────────────────────────────────────────────────────

  describe('No type change (same value passed)', () => {
    it('does NOT sync functions or reset prompts when value is unchanged', async () => {
      // GIVEN: workspace is ecommerce, request sends the same value
      mockFindUnique.mockResolvedValue(makeCurrentWorkspace(true))

      await service.update(WORKSPACE_ID, { channelMode: 'ECOMMERCE' as any })

      // THEN: no calling function or agent config operations
      expect(mockUpdateMany).not.toHaveBeenCalled()
      expect(mockCallingFunctionFindUnique).not.toHaveBeenCalled()
      expect(mockAgentConfigUpsert).not.toHaveBeenCalled()
    })

    it('does NOT sync when channelMode is not in the update payload', async () => {
      mockFindUnique.mockResolvedValue(makeCurrentWorkspace(true))

      // Payload changes only the workspace name
      await service.update(WORKSPACE_ID, { name: 'New Name' } as any)

      expect(mockUpdateMany).not.toHaveBeenCalled()
      expect(mockAgentConfigUpsert).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // SCENARIO: custom functions are never touched
  // ──────────────────────────────────────────────────────────────────────────

  describe('Custom (non-system) calling functions safety', () => {
    it('updateMany filter includes isSystemFunction: true — ensuring custom functions are safe', async () => {
      // GIVEN: workspace switches to info
      mockFindUnique.mockResolvedValue(makeCurrentWorkspace(true))
      mockUpdateMany.mockResolvedValue({ count: 3 })

      await service.update(WORKSPACE_ID, { channelMode: 'INFORMATIONAL' as any })

      // THEN: the where clause includes isSystemFunction: true
      // This means any custom function (isSystemFunction: false) is NOT affected
      const call = mockUpdateMany.mock.calls[0][0]
      expect(call.where.isSystemFunction).toBe(true)
    })
  })
})
