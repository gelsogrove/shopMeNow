/**
 * Unit Tests: Workspace channelMode Immutability
 *
 * RULE: channelMode is IMMUTABLE after workspace creation.
 *   - Attempting to change it → 400 CHANNEL_MODE_IMMUTABLE error
 *   - Sending the SAME value → allowed (no-op, proceeds normally)
 *   - Omitting channelMode from payload → allowed (no change)
 *   - No sync/reset operations exist anymore (deleted methods)
 *
 * RATIONALE: Changing channelMode requires syncing calling functions, resetting
 * agent prompts, and handling many edge cases. Instead, users must delete the
 * workspace and create a new one with the desired channelMode.
 */

import { WorkspaceService } from '../../../src/application/services/workspace.service'

// ── Mock dynamicAgents ────────────────────────────────────────────────────────
jest.mock('../../../prisma/data/dynamicAgents', () => ({
  dynamicAgents: jest.fn(() => []),
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
const mockUserFindUnique = jest.fn()

jest.mock('@echatbot/database', () => ({
  prisma: {
    workspace: { findUnique: (...args: any[]) => mockFindUnique(...args) },
    workspaceCallingFunction: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    agentConfig: { upsert: jest.fn(), deleteMany: jest.fn() },
    user: { findUnique: (...args: any[]) => mockUserFindUnique(...args) },
  },
  PrismaClient: jest.fn().mockImplementation(() => ({
    workspace: { findUnique: (...args: any[]) => mockFindUnique(...args) },
    workspaceCallingFunction: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    agentConfig: { upsert: jest.fn(), deleteMany: jest.fn() },
    user: { findUnique: (...args: any[]) => mockUserFindUnique(...args) },
  })),
}))

// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-test-001'

// Helper: build a mock currentWorkspace with a given channelMode
function makeCurrentWorkspace(channelMode: 'ECOMMERCE' | 'INFORMATIONAL') {
  return {
    enableWidget: false,
    enableWhatsapp: true,
    channelMode,
    ownerId: 'owner-1',
    deletedAt: null,
    whatsappProvider: 'ultramsg',
    wasenderSessionId: null,
  }
}

describe('WorkspaceService — channelMode immutability', () => {
  let service: WorkspaceService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WorkspaceService()

    // Default: user is STANDARD plan (bypasses FREE_TRIAL guard)
    mockUserFindUnique.mockResolvedValue({ planType: 'STANDARD' })
    // Default: repo.update returns a minimal workspace
    mockRepoUpdate.mockResolvedValue({ id: WORKSPACE_ID, channelMode: 'ECOMMERCE' as any })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // SCENARIO: Attempt to change channelMode → BLOCKED with 400
  // ──────────────────────────────────────────────────────────────────────────

  describe('Changing channelMode is blocked', () => {
    it('throws CHANNEL_MODE_IMMUTABLE (400) when switching INFORMATIONAL → ECOMMERCE', async () => {
      // GIVEN: workspace is currently INFORMATIONAL
      mockFindUnique.mockResolvedValue(makeCurrentWorkspace('INFORMATIONAL'))

      // WHEN: update attempts to change channelMode to ECOMMERCE
      // THEN: throws error with statusCode 400
      await expect(
        service.update(WORKSPACE_ID, { channelMode: 'ECOMMERCE' as any })
      ).rejects.toMatchObject({
        message: expect.stringContaining('Channel mode cannot be changed after creation'),
        statusCode: 400,
      })

      // AND: repo.update is NEVER called (change blocked before DB write)
      expect(mockRepoUpdate).not.toHaveBeenCalled()
    })

    it('throws CHANNEL_MODE_IMMUTABLE (400) when switching ECOMMERCE → INFORMATIONAL', async () => {
      // GIVEN: workspace is currently ECOMMERCE
      mockFindUnique.mockResolvedValue(makeCurrentWorkspace('ECOMMERCE'))

      // WHEN: update attempts to change channelMode to INFORMATIONAL
      // THEN: throws error with statusCode 400
      await expect(
        service.update(WORKSPACE_ID, { channelMode: 'INFORMATIONAL' as any })
      ).rejects.toMatchObject({
        message: expect.stringContaining('Channel mode cannot be changed after creation'),
        statusCode: 400,
      })

      // AND: repo.update is NEVER called (change blocked before DB write)
      expect(mockRepoUpdate).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // SCENARIO: Same channelMode value → allowed (no-op, proceeds normally)
  // ──────────────────────────────────────────────────────────────────────────

  describe('Same channelMode value passes through', () => {
    it('allows update when channelMode is the same (ECOMMERCE → ECOMMERCE)', async () => {
      // GIVEN: workspace is ECOMMERCE
      mockFindUnique.mockResolvedValue(makeCurrentWorkspace('ECOMMERCE'))

      // WHEN: update sends the same channelMode value
      await service.update(WORKSPACE_ID, { channelMode: 'ECOMMERCE' as any })

      // THEN: repo.update IS called (update proceeds normally)
      expect(mockRepoUpdate).toHaveBeenCalled()
    })

    it('allows update when channelMode is the same (INFORMATIONAL → INFORMATIONAL)', async () => {
      // GIVEN: workspace is INFORMATIONAL
      mockFindUnique.mockResolvedValue(makeCurrentWorkspace('INFORMATIONAL'))
      mockRepoUpdate.mockResolvedValue({ id: WORKSPACE_ID, channelMode: 'INFORMATIONAL' as any })

      // WHEN: update sends the same channelMode value
      await service.update(WORKSPACE_ID, { channelMode: 'INFORMATIONAL' as any })

      // THEN: repo.update IS called (update proceeds normally)
      expect(mockRepoUpdate).toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // SCENARIO: channelMode omitted from payload → allowed (no change)
  // ──────────────────────────────────────────────────────────────────────────

  describe('channelMode omitted from payload', () => {
    it('allows update when channelMode is not in the payload (e.g. name change)', async () => {
      // GIVEN: workspace is ECOMMERCE
      mockFindUnique.mockResolvedValue(makeCurrentWorkspace('ECOMMERCE'))

      // WHEN: payload does NOT include channelMode (only name)
      await service.update(WORKSPACE_ID, { name: 'New Name' } as any)

      // THEN: repo.update IS called (no channelMode check triggered)
      expect(mockRepoUpdate).toHaveBeenCalled()
    })
  })
})
