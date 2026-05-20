/**
 * Unit tests for applyEscalationNotification() in custom-client-chatbot.service.ts
 *
 * WHY these tests exist:
 *   The original code used a dynamic import with a .js extension
 *   (human-message-email.js) which silently failed in ts-node-dev because no
 *   compiled .js file exists in the source tree. The fix introduces a thin
 *   wrapper service (escalation-email.service.ts) that isolates the
 *   cross-package ESM module from Jest's CJS resolver. These tests verify:
 *     1. sendEscalationEmail() is called with the correct arguments
 *     2. All early-exit guards work (no workspace, no recipients, wrong method)
 *     3. The function never throws — fire-and-forget contract
 */

// ── Module mocks (before all imports) ────────────────────────────────────────

// Mock the wrapper service — this keeps Jest away from the custom-ecolaundry
// ESM internals (logger.js, models/index.js) which its CJS resolver can't follow.
jest.mock('../../src/application/services/escalation-email.service', () => ({
  sendEscalationEmail: jest.fn().mockResolvedValue(undefined),
}))

// WhatsAppDirectSendService is used in the whatsapp branch — mock to avoid DB
jest.mock('../../src/services/whatsapp-direct-send.service', () => ({
  WhatsAppDirectSendService: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue(undefined),
  })),
}))

import { applyEscalationNotification } from '../../src/application/services/custom-client-chatbot.service'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const emailSvc = require('../../src/application/services/escalation-email.service') as {
  sendEscalationEmail: jest.MockedFunction<() => Promise<void>>
}

// ── Shared test data ──────────────────────────────────────────────────────────

const baseParams = {
  workspaceId: 'ws-escalation-test',
  customerId: 'cust-escalation-001',
  escalationSummary: 'Usuario Andrea (34600000001) en Goya, lavadora 5. Display code unrecognised.',
  history: [
    { role: 'user' as const, content: 'Quiero hablar con un operador' },
    { role: 'assistant' as const, content: 'Vamos a revisar tu caso manualmente.' },
  ],
  customerName: 'Andrea',
  customerPhone: '+34600000001',
  notificationEmails: 'gelsogrove@gmail.com',
  operatorContactMethod: 'email' as const,
  operatorWhatsappNumber: '',
}

const workspaceRow = {
  hasHumanSupport: true,
  operatorContactMethod: 'email',
  operatorEmail: 'fallback@example.com',
  operatorWhatsappNumber: '',
  name: 'Ecolaundry Test',
}

function mockDb(overrides?: Partial<typeof workspaceRow> | null) {
  return {
    workspace: {
      findFirst: jest.fn().mockResolvedValue(
        overrides === null ? null : { ...workspaceRow, ...overrides }
      ),
    },
  } as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('applyEscalationNotification()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls sendEscalationEmail with the correct recipient and summary', async () => {
    // WHY: primary regression — the wrapper must be called, not the old .js import
    const db = mockDb()
    await applyEscalationNotification(baseParams, db)

    expect(emailSvc.sendEscalationEmail).toHaveBeenCalledTimes(1)
    const [data, recipients] = (emailSvc.sendEscalationEmail as jest.Mock).mock.calls[0]
    expect(recipients).toBe('gelsogrove@gmail.com')
    expect(data.summary).toContain('Andrea')
    expect(data.customerName).toBe('Andrea')
    expect(data.customerPhone).toBe('+34600000001')
    expect(data.companyName).toBe('Ecolaundry Test')
    expect(data.history).toHaveLength(2)
  })

  it('uses workspace.operatorEmail as fallback when notificationEmails is not set', async () => {
    // WHY: settings.json email takes precedence; DB operatorEmail is the last resort
    const db = mockDb()
    await applyEscalationNotification({ ...baseParams, notificationEmails: undefined }, db)

    expect(emailSvc.sendEscalationEmail).toHaveBeenCalledTimes(1)
    const [, recipients] = (emailSvc.sendEscalationEmail as jest.Mock).mock.calls[0]
    expect(recipients).toBe('fallback@example.com')
  })

  it('skips entirely when workspace is not found in DB', async () => {
    const db = mockDb(null)
    await applyEscalationNotification(baseParams, db)

    expect(emailSvc.sendEscalationEmail).not.toHaveBeenCalled()
  })

  it('skips when hasHumanSupport=false AND no custom emails configured', async () => {
    const db = mockDb({ hasHumanSupport: false })
    await applyEscalationNotification({ ...baseParams, notificationEmails: undefined }, db)

    expect(emailSvc.sendEscalationEmail).not.toHaveBeenCalled()
  })

  it('proceeds when hasHumanSupport=false BUT notificationEmails IS set', async () => {
    // WHY: ecolaundry configures emails in settings.json, not in DB hasHumanSupport
    const db = mockDb({ hasHumanSupport: false })
    await applyEscalationNotification(
      { ...baseParams, notificationEmails: 'gelsogrove@gmail.com' },
      db
    )

    expect(emailSvc.sendEscalationEmail).toHaveBeenCalledTimes(1)
  })

  it('skips when both notificationEmails and workspace.operatorEmail are absent', async () => {
    const db = mockDb({ operatorEmail: null })
    await applyEscalationNotification({ ...baseParams, notificationEmails: undefined }, db)

    expect(emailSvc.sendEscalationEmail).not.toHaveBeenCalled()
  })

  it('does not throw when sendEscalationEmail rejects', async () => {
    // WHY: caller uses `void applyEscalationNotification(...)` — must never propagate
    ;(emailSvc.sendEscalationEmail as jest.Mock).mockRejectedValueOnce(
      new Error('SMTP connection refused')
    )
    const db = mockDb()

    await expect(applyEscalationNotification(baseParams, db)).resolves.toBeUndefined()
  })

  it('does not call sendEscalationEmail when method is whatsapp', async () => {
    // WHY: routing is exclusive — whatsapp path returns early before the email block
    const db = mockDb({ operatorContactMethod: 'whatsapp', operatorWhatsappNumber: '' })
    await applyEscalationNotification(
      { ...baseParams, operatorContactMethod: 'whatsapp', operatorWhatsappNumber: '' },
      db
    )

    expect(emailSvc.sendEscalationEmail).not.toHaveBeenCalled()
  })
})
