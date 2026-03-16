/**
 * WorkspaceService - WasenderAPI Unit Tests
 *
 * SCENARIOS TESTED:
 * 1. initializeWasenderSession  - subscription checks, session creation, QR flow
 * 2. deleteWasenderSession      - ownership check, API call, DB cleanup
 * 3. restartWasenderSession     - ownership check, API call, status reset
 * 4. delete() workspace         - Bug #1: must cleanup Wasender session on WasenderAPI
 * 5. update() provider switch   - Bug #3: must cleanup Wasender session when switching provider
 */

// ─── Mock logger FIRST (before imports) ──────────────────────────────────────
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}
jest.mock('../../../src/utils/logger', () => ({ __esModule: true, default: mockLogger }))

// ─── Mock WasenderClientService ───────────────────────────────────────────────
const mockWasenderClient = {
  createSession: jest.fn(),
  connectSession: jest.fn(),
  getQrCode: jest.fn(),
  getSessionStatus: jest.fn(),
  disconnectSession: jest.fn(),
  deleteSession: jest.fn(),
  restartSession: jest.fn(),
  sendPresenceUpdate: jest.fn(),
  markMessageAsRead: jest.fn(),
}
jest.mock('../../../src/services/wasender-client.service', () => ({
  WasenderClientService: jest.fn().mockImplementation(() => mockWasenderClient),
}))

// ─── Mock WaapiClientService ─────────────────────────────────────────────────
const mockWaapiClient = {
  createInstance: jest.fn(),
  deleteInstance: jest.fn(),
  setWebhook: jest.fn(),
  getQrCode: jest.fn(),
}
jest.mock('../../../src/services/waapi-client.service', () => ({
  WaapiClientService: jest.fn().mockImplementation(() => mockWaapiClient),
}))

// ─── Mock Workspace repository ────────────────────────────────────────────────
const mockRepository = {
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findByUserId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}
jest.mock('../../../src/repositories/workspace.repository', () => ({
  WorkspaceRepository: jest.fn().mockImplementation(() => mockRepository),
}))

// ─── Mock @echatbot/database (module-level prisma used in workspace.service.ts) ──
const mockPrismaGlobal = {
  user: { findUnique: jest.fn() },
  workspace: { findUnique: jest.fn(), update: jest.fn() },
  agentConfig: { findMany: jest.fn(), createMany: jest.fn() },
  userWorkspace: { create: jest.fn() },
  whatsappSettings: { create: jest.fn() },
  $transaction: jest.fn(),
}
jest.mock('@echatbot/database', () => ({
  prisma: mockPrismaGlobal,
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaGlobal),
}))

jest.mock('../../../prisma/data/dynamicAgents', () => ({ dynamicAgents: [] }))
jest.mock('../../../prisma/data/initialFAQs', () => ({ initialFAQs: [] }))

import { WorkspaceService } from '../../../src/application/services/workspace.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-test-123'
const USER_ID = 'user-owner-456'
const SESSION_ID = 'sess-789'
const API_KEY = 'api-key-abc'
const PHONE = '+39123456789'

function activeUser() {
  return {
    planType: 'PREMIUM',
    creditBalance: 20.0,
    subscriptionStatus: 'ACTIVE',
    trialEndsAt: null,
  }
}

function wasenderWorkspace(overrides: Record<string, any> = {}) {
  return {
    id: WORKSPACE_ID,
    ownerId: USER_ID,
    whatsappProvider: 'wasender',
    wasenderSessionId: SESSION_ID,
    wasenderApiKey: API_KEY,
    wasenderSessionStatus: 'connected',
    waapiInstanceId: null,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('WorkspaceService — WasenderAPI', () => {
  let service: WorkspaceService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WorkspaceService()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. initializeWasenderSession
  // ═══════════════════════════════════════════════════════════════════════════
  describe('initializeWasenderSession', () => {
    it('should reject when user not found', async () => {
      // SCENARIO: user ID is correct but DB returns null (deleted account)
      mockPrismaGlobal.user.findUnique.mockResolvedValue(null)

      await expect(
        service.initializeWasenderSession(WORKSPACE_ID, USER_ID, PHONE)
      ).rejects.toThrow('User not found')
    })

    it('should reject when trial has expired', async () => {
      // SCENARIO: FREE_TRIAL user whose trial ended yesterday
      // RULE: expired trial cannot create new channels
      mockPrismaGlobal.user.findUnique.mockResolvedValue({
        planType: 'FREE_TRIAL',
        creditBalance: 10,
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: new Date('2020-01-01'), // in the past
      })

      await expect(
        service.initializeWasenderSession(WORKSPACE_ID, USER_ID, PHONE)
      ).rejects.toThrow('Trial expired')
    })

    it('should reject when subscription is not ACTIVE', async () => {
      // SCENARIO: user let their subscription lapse
      // RULE: subscription must be ACTIVE to create a channel
      mockPrismaGlobal.user.findUnique.mockResolvedValue({
        planType: 'PREMIUM',
        creditBalance: 50,
        subscriptionStatus: 'EXPIRED',
        trialEndsAt: null,
      })

      await expect(
        service.initializeWasenderSession(WORKSPACE_ID, USER_ID, PHONE)
      ).rejects.toThrow('Active subscription required')
    })

    it('should reject when credit balance is below €5', async () => {
      // SCENARIO: user has only €2 left — not enough to cover session cost
      // RULE: minimum €5 required to create a channel
      mockPrismaGlobal.user.findUnique.mockResolvedValue({
        planType: 'PREMIUM',
        creditBalance: 2.5,
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
      })

      await expect(
        service.initializeWasenderSession(WORKSPACE_ID, USER_ID, PHONE)
      ).rejects.toThrow('Insufficient credits')
    })

    it('should create session and save QR string to DB on success', async () => {
      // SCENARIO: valid user, wasender returns sessionId + apiKey, then QR string
      // RULE: DB must be updated with all wasender fields, channelStatus = false
      mockPrismaGlobal.user.findUnique.mockResolvedValue(activeUser())
      mockWasenderClient.createSession.mockResolvedValue({ sessionId: SESSION_ID, apiKey: API_KEY })
      mockWasenderClient.connectSession.mockResolvedValue('QR_STRING_DATA')
      mockPrismaGlobal.workspace.update.mockResolvedValue({ id: WORKSPACE_ID, wasenderQrString: 'QR_STRING_DATA' })

      const result = await service.initializeWasenderSession(WORKSPACE_ID, USER_ID, PHONE)

      // Should have saved full wasender session to DB
      expect(mockPrismaGlobal.workspace.update).toHaveBeenCalledWith({
        where: { id: WORKSPACE_ID },
        data: expect.objectContaining({
          whatsappProvider: 'wasender',
          wasenderSessionId: SESSION_ID,
          wasenderApiKey: API_KEY,
          wasenderPhoneNumber: PHONE,
          wasenderSessionStatus: 'need_scan',
          wasenderIsActive: false,
          wasenderQrString: 'QR_STRING_DATA',
          channelStatus: false,
        }),
      })
      expect(result).toBeDefined()
    })

    it('should save null QR if connectSession returns null', async () => {
      // SCENARIO: WasenderAPI creates session but QR is not ready yet (async)
      // RULE: wasenderQrString = null, frontend polling will pick it up via webhook
      mockPrismaGlobal.user.findUnique.mockResolvedValue(activeUser())
      mockWasenderClient.createSession.mockResolvedValue({ sessionId: SESSION_ID, apiKey: API_KEY })
      mockWasenderClient.connectSession.mockResolvedValue(null)
      mockPrismaGlobal.workspace.update.mockResolvedValue({ id: WORKSPACE_ID })

      await service.initializeWasenderSession(WORKSPACE_ID, USER_ID, PHONE)

      expect(mockPrismaGlobal.workspace.update).toHaveBeenCalledWith({
        where: { id: WORKSPACE_ID },
        data: expect.objectContaining({
          wasenderQrString: null,
          wasenderQrGeneratedAt: null,
        }),
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. deleteWasenderSession
  // ═══════════════════════════════════════════════════════════════════════════
  describe('deleteWasenderSession', () => {
    it('should throw if workspace not found', async () => {
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue(null)

      await expect(
        service.deleteWasenderSession(WORKSPACE_ID, USER_ID)
      ).rejects.toThrow('Workspace not found')
    })

    it('should throw if user is not owner', async () => {
      // SCENARIO: team member (non-owner) tries to delete session
      // RULE: only the workspace owner can delete sessions (IDOR prevention)
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue({
        wasenderSessionId: SESSION_ID,
        ownerId: 'different-user-id',  // ← not the requester
      })

      await expect(
        service.deleteWasenderSession(WORKSPACE_ID, USER_ID)
      ).rejects.toThrow('Access denied')
    })

    it('should skip WasenderAPI call and still clear DB if no session exists', async () => {
      // SCENARIO: user clicks delete but session was already deleted (or never created)
      // RULE: deleteWasenderSession is IDEMPOTENT — it clears DB even without a live session
      //       (unlike disconnect/restart which require an active session)
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue({
        wasenderSessionId: null,
        ownerId: USER_ID,
      })
      mockPrismaGlobal.workspace.update.mockResolvedValue({ id: WORKSPACE_ID })

      await service.deleteWasenderSession(WORKSPACE_ID, USER_ID)

      // Should NOT have called WasenderAPI (no session to delete)
      expect(mockWasenderClient.deleteSession).not.toHaveBeenCalled()
      // Should still have cleared the DB fields
      expect(mockPrismaGlobal.workspace.update).toHaveBeenCalledWith({
        where: { id: WORKSPACE_ID },
        data: expect.objectContaining({ wasenderSessionId: null, channelStatus: false }),
      })
    })

    it('should call wasenderClient.deleteSession and clear DB fields', async () => {
      // SCENARIO: valid owner deletes their Wasender session
      // RULE: must call WasenderAPI to delete session, then null all wasender fields in DB
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue({
        wasenderSessionId: SESSION_ID,
        ownerId: USER_ID,
      })
      mockWasenderClient.deleteSession.mockResolvedValue(undefined)
      mockPrismaGlobal.workspace.update.mockResolvedValue({ id: WORKSPACE_ID })

      await service.deleteWasenderSession(WORKSPACE_ID, USER_ID)

      expect(mockWasenderClient.deleteSession).toHaveBeenCalledWith(SESSION_ID)
      expect(mockPrismaGlobal.workspace.update).toHaveBeenCalledWith({
        where: { id: WORKSPACE_ID },
        data: expect.objectContaining({
          wasenderSessionId: null,
          wasenderApiKey: null,
          wasenderSessionStatus: null,
          wasenderIsActive: false,
          channelStatus: false,
        }),
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. restartWasenderSession
  // ═══════════════════════════════════════════════════════════════════════════
  describe('restartWasenderSession', () => {
    it('should throw if workspace not found', async () => {
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue(null)

      await expect(
        service.restartWasenderSession(WORKSPACE_ID, USER_ID)
      ).rejects.toThrow('Workspace not found')
    })

    it('should throw if user is not owner', async () => {
      // SCENARIO: security — non-owner cannot restart sessions
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue({
        wasenderSessionId: SESSION_ID,
        ownerId: 'someone-else',
      })

      await expect(
        service.restartWasenderSession(WORKSPACE_ID, USER_ID)
      ).rejects.toThrow('Access denied')
    })

    it('should call restartSession and reset status to need_scan', async () => {
      // SCENARIO: session is stuck/disconnected, owner wants to recover without re-scan
      // RULE: wasenderSessionStatus → 'need_scan' so frontend polls for new connection
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue({
        wasenderSessionId: SESSION_ID,
        ownerId: USER_ID,
      })
      mockWasenderClient.restartSession.mockResolvedValue(undefined)
      mockPrismaGlobal.workspace.update.mockResolvedValue({ id: WORKSPACE_ID })

      await service.restartWasenderSession(WORKSPACE_ID, USER_ID)

      expect(mockWasenderClient.restartSession).toHaveBeenCalledWith(SESSION_ID)
      expect(mockPrismaGlobal.workspace.update).toHaveBeenCalledWith({
        where: { id: WORKSPACE_ID },
        data: { wasenderSessionStatus: 'need_scan' },
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. delete() workspace — Bug #1 fix: cleanup provider sessions
  // ═══════════════════════════════════════════════════════════════════════════
  describe('delete() workspace — provider cleanup', () => {
    it('should call wasenderClient.deleteSession before soft-deleting workspace', async () => {
      // SCENARIO: owner deletes entire workspace that has an active Wasender session
      // RULE (Bug #1): must call WasenderAPI to delete session to avoid zombie sessions
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue(wasenderWorkspace())
      mockWasenderClient.deleteSession.mockResolvedValue(undefined)
      mockRepository.delete.mockResolvedValue(true)

      await service.delete(WORKSPACE_ID)

      expect(mockWasenderClient.deleteSession).toHaveBeenCalledWith(SESSION_ID)
      expect(mockRepository.delete).toHaveBeenCalledWith(WORKSPACE_ID)
    })

    it('should still soft-delete workspace even if wasenderClient.deleteSession throws', async () => {
      // SCENARIO: WasenderAPI is unreachable during workspace delete
      // RULE: network error must NOT block workspace deletion — log warn and continue
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue(wasenderWorkspace())
      mockWasenderClient.deleteSession.mockRejectedValue(new Error('API timeout'))
      mockRepository.delete.mockResolvedValue(true)

      const result = await service.delete(WORKSPACE_ID)

      expect(result).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(mockRepository.delete).toHaveBeenCalledWith(WORKSPACE_ID)
    })

    it('should call waapiClient.deleteInstance when workspace uses waapi', async () => {
      // SCENARIO: workspace uses WaAPI provider — should clean up WaAPI instance too
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue({
        ...wasenderWorkspace(),
        whatsappProvider: 'waapi',
        wasenderSessionId: null,
        waapiInstanceId: 'waapi-inst-999',
      })
      mockWaapiClient.deleteInstance.mockResolvedValue(undefined)
      mockRepository.delete.mockResolvedValue(true)

      await service.delete(WORKSPACE_ID)

      expect(mockWaapiClient.deleteInstance).toHaveBeenCalledWith('waapi-inst-999')
      expect(mockWasenderClient.deleteSession).not.toHaveBeenCalled()
    })

    it('should not call any provider API if workspace has no session', async () => {
      // SCENARIO: workspace uses Meta or no provider configured — nothing to clean up
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue({
        whatsappProvider: 'meta',
        wasenderSessionId: null,
        waapiInstanceId: null,
      })
      mockRepository.delete.mockResolvedValue(true)

      await service.delete(WORKSPACE_ID)

      expect(mockWasenderClient.deleteSession).not.toHaveBeenCalled()
      expect(mockWaapiClient.deleteInstance).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. update() — Bug #3 fix: cleanup on provider switch
  // ═══════════════════════════════════════════════════════════════════════════
  describe('update() — provider switch cleanup', () => {
    // Helper: mock update() prerequisites
    function setupUpdateMocks(currentProvider: string, sessionId: string | null = SESSION_ID) {
      mockPrismaGlobal.workspace.findUnique.mockResolvedValue({
        enableWidget: false,
        enableWhatsapp: true,
        sellsProductsAndServices: true,
        ownerId: USER_ID,
        deletedAt: null,
        whatsappProvider: currentProvider,
        wasenderSessionId: sessionId,
        waapiInstanceId: currentProvider === 'waapi' ? 'waapi-inst-999' : null,
      })
      mockRepository.update.mockResolvedValue({ id: WORKSPACE_ID })
    }

    it('should delete Wasender session when switching from wasender to ultramsg', async () => {
      // SCENARIO: user decides to switch from Wasender to UltraMsg in Settings
      // RULE (Bug #3): old session on WasenderAPI must be deleted to avoid zombie billing
      setupUpdateMocks('wasender')
      mockWasenderClient.deleteSession.mockResolvedValue(undefined)

      await service.update(WORKSPACE_ID, { whatsappProvider: 'ultramsg' } as any)

      expect(mockWasenderClient.deleteSession).toHaveBeenCalledWith(SESSION_ID)
    })

    it('should null all wasender fields in DB when switching provider', async () => {
      // SCENARIO: switch wasender → meta
      // RULE: all wasender* fields must be cleared from DB to avoid stale data
      setupUpdateMocks('wasender')
      mockWasenderClient.deleteSession.mockResolvedValue(undefined)

      await service.update(WORKSPACE_ID, { whatsappProvider: 'meta' } as any)

      const updateCall = mockRepository.update.mock.calls[0][1] as any
      // repository.update receives the mutated data object
      expect(updateCall.wasenderSessionId).toBeNull()
      expect(updateCall.wasenderApiKey).toBeNull()
      expect(updateCall.wasenderSessionStatus).toBeNull()
      expect(updateCall.wasenderIsActive).toBe(false)
    })

    it('should NOT delete Wasender session when staying on wasender provider', async () => {
      // SCENARIO: user updates workspace name while on wasender — no cleanup needed
      setupUpdateMocks('wasender')

      await service.update(WORKSPACE_ID, { whatsappProvider: 'wasender', name: 'New Name' } as any)

      expect(mockWasenderClient.deleteSession).not.toHaveBeenCalled()
    })

    it('should NOT delete Wasender session when there is no sessionId', async () => {
      // SCENARIO: switching from wasender but session was already deleted
      // RULE: nothing to clean up on WasenderAPI, just update provider in DB
      setupUpdateMocks('wasender', null /* no sessionId */)

      await service.update(WORKSPACE_ID, { whatsappProvider: 'ultramsg' } as any)

      expect(mockWasenderClient.deleteSession).not.toHaveBeenCalled()
    })

    it('should delete WaAPI instance when switching from waapi to wasender', async () => {
      // SCENARIO: user switches from WaAPI to Wasender
      // RULE: old WaAPI instance must be removed to avoid billing on WaAPI side
      setupUpdateMocks('waapi')
      mockWaapiClient.deleteInstance.mockResolvedValue(undefined)

      await service.update(WORKSPACE_ID, { whatsappProvider: 'wasender' } as any)

      expect(mockWaapiClient.deleteInstance).toHaveBeenCalledWith('waapi-inst-999')
      expect(mockWasenderClient.deleteSession).not.toHaveBeenCalled()
    })

    it('should continue update even if WasenderAPI deleteSession throws', async () => {
      // SCENARIO: WasenderAPI is down during provider switch
      // RULE: provider switch must succeed anyway — log warn, clear DB fields
      setupUpdateMocks('wasender')
      mockWasenderClient.deleteSession.mockRejectedValue(new Error('Timeout'))

      await expect(
        service.update(WORKSPACE_ID, { whatsappProvider: 'ultramsg' } as any)
      ).resolves.toBeDefined()

      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })
})
