import { prisma } from '@echatbot/database'
import { whatsappChannelQueueJob, clearRecipientThrottleCache } from '../../../src/jobs/whatsapp-channel-queue.job'
import { getWorkspaceWhatsAppConfig } from '../../../src/services/whatsapp-config.service'
import { SecurityAgentService } from '../../../src/services/security-agent.service'
import { BillingService } from '../../../src/services/billing.service'

jest.mock('../../../src/services/whatsapp-config.service', () => ({
  getWorkspaceWhatsAppConfig: jest.fn(),
}))

describe('whatsappChannelQueueJob - WhatsApp send', () => {
  const mockedGetConfig = getWorkspaceWhatsAppConfig as jest.MockedFunction<typeof getWorkspaceWhatsAppConfig>

  let securitySpy: jest.SpyInstance
  let billingSpy: jest.SpyInstance
  let workspaceModel: any
  let queueModel: any
  let conversationModel: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetConfig.mockReset()
    securitySpy = jest.spyOn(SecurityAgentService.prototype, 'validateMessage').mockResolvedValue({ isSafe: true })
    billingSpy = jest.spyOn(BillingService.prototype, 'deductMessageCredit').mockResolvedValue({ success: true })
    jest.spyOn(BillingService.prototype, 'hasOwnerCredit').mockResolvedValue(true)
    ;(global as any).fetch = jest.fn()
    clearRecipientThrottleCache()

    workspaceModel = { findMany: jest.fn() }
    queueModel = { findMany: jest.fn(), update: jest.fn() }
    conversationModel = { findUnique: jest.fn(), update: jest.fn() }
    ;(prisma as any).workspace = workspaceModel
    ;(prisma as any).whatsAppQueue = queueModel
    ;(prisma as any).conversationMessage = conversationModel
  })

  afterEach(() => {
    securitySpy?.mockRestore()
    billingSpy?.mockRestore()
  })

  it('sends WhatsApp messages when config exists', async () => {
    mockedGetConfig.mockResolvedValue({
      workspaceId: 'w1',
      phoneNumber: '19999999999',
      apiKey: 'token',
    })

    workspaceModel.findMany.mockResolvedValue([
      { id: 'w1', name: 'W', whatsappApiKey: 'token', whatsappPhoneNumber: '19999999999', channelStatus: true, debugMode: false },
    ])

    queueModel.findMany.mockResolvedValue([
      {
        id: 'q1',
        workspaceId: 'w1',
        customerId: 'c1',
        phoneNumber: '+39000000000',
        messageContent: 'hello world',
        status: 'pending',
        channel: 'whatsapp',
        conversationMessageId: undefined,
      },
    ])

    queueModel.update.mockResolvedValue({})

    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wa-123' }] }),
    })

    await whatsappChannelQueueJob()

    expect(fetch).toHaveBeenCalled()
    expect(queueModel.update).toHaveBeenCalled()
    const sentCall = queueModel.update.mock.calls.find((call: any) => call[0]?.data?.status === 'sent')
    expect(sentCall?.[0].data.status).toBe('sent')
  })

  it('marks queue as error when credit or subscription is missing', async () => {
    jest.spyOn(BillingService.prototype, 'hasOwnerCredit').mockResolvedValue(false)

    mockedGetConfig.mockResolvedValue({
      workspaceId: 'w1',
      phoneNumber: '19999999999',
      apiKey: 'token',
    })

    workspaceModel.findMany.mockResolvedValue([
      { id: 'w1', name: 'W', whatsappApiKey: 'token', whatsappPhoneNumber: '19999999999', channelStatus: true, debugMode: false },
    ])

    queueModel.findMany.mockResolvedValue([
      {
        id: 'q1',
        workspaceId: 'w1',
        customerId: 'c1',
        phoneNumber: '+39000000000',
        messageContent: 'ciao',
        status: 'pending',
        channel: 'whatsapp',
        conversationMessageId: undefined,
      },
    ])

    queueModel.update.mockResolvedValue({})

    await whatsappChannelQueueJob()

    const errorCall = queueModel.update.mock.calls.find((call: any) => call[0]?.data?.status === 'error')
    expect(errorCall?.[0].data.status).toBe('error')
    expect(errorCall?.[0].data.errorMessage).toContain('credit')
  })

  it('marks queue as error when WhatsApp API fails', async () => {
    mockedGetConfig.mockResolvedValue({
      workspaceId: 'w1',
      phoneNumber: '19999999999',
      apiKey: 'token',
    })

    workspaceModel.findMany.mockResolvedValue([
      { id: 'w1', name: 'W', whatsappApiKey: 'token', whatsappPhoneNumber: '19999999999', channelStatus: true, debugMode: false },
    ])

    queueModel.findMany.mockResolvedValue([
      {
        id: 'q1',
        workspaceId: 'w1',
        customerId: 'c1',
        phoneNumber: '+39000000000',
        messageContent: 'ciao',
        status: 'pending',
        channel: 'whatsapp',
        conversationMessageId: undefined,
      },
    ])

    queueModel.update.mockResolvedValue({})

    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'error',
    })

    await whatsappChannelQueueJob()

    expect(queueModel.update).toHaveBeenCalled()
    const errorCall = queueModel.update.mock.calls.find((call: any) => call[0]?.data?.status === 'error')
    expect(errorCall?.[0].data.status).toBe('error')
  })

  it('sends ONLY WIP messages when channelStatus is false', async () => {
    mockedGetConfig.mockResolvedValue({
      workspaceId: 'w1',
      phoneNumber: '19999999999',
      apiKey: 'token',
    })

    workspaceModel.findMany.mockResolvedValue([
      { id: 'w1', name: 'W', whatsappApiKey: 'token', whatsappPhoneNumber: '19999999999', channelStatus: false, debugMode: false },
    ])

    queueModel.findMany.mockResolvedValue([
      {
        id: 'msg-wip',
        workspaceId: 'w1',
        customerId: 'c1',
        phoneNumber: '+39000000000',
        messageContent: 'Maintenance message',
        status: 'pending',
        channel: 'whatsapp',
        conversationMessageId: 'conv-1',
      },
    ])

    conversationModel.findUnique.mockResolvedValue({
      debugInfo: JSON.stringify({ channelDisabled: true }),
    })
    conversationModel.update.mockResolvedValue({})
    queueModel.update.mockResolvedValue({})

    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wa-456' }] }),
    })

    await whatsappChannelQueueJob()

    const sentCall = queueModel.update.mock.calls.find((call: any) => call[0]?.data?.status === 'sent')
    expect(sentCall?.[0].data.status).toBe('sent')
    expect(billingSpy).not.toHaveBeenCalled()
  })

  it('skips non-WIP messages when channelStatus is false', async () => {
    mockedGetConfig.mockResolvedValue({
      workspaceId: 'w1',
      phoneNumber: '19999999999',
      apiKey: 'token',
    })

    workspaceModel.findMany.mockResolvedValue([
      { id: 'w1', name: 'W', whatsappApiKey: 'token', whatsappPhoneNumber: '19999999999', channelStatus: false, debugMode: false },
    ])

    queueModel.findMany.mockResolvedValue([
      {
        id: 'msg-normal',
        workspaceId: 'w1',
        customerId: 'c1',
        phoneNumber: '+39000000000',
        messageContent: 'Hello',
        status: 'pending',
        channel: 'whatsapp',
        conversationMessageId: 'conv-2',
      },
    ])

    conversationModel.findUnique.mockResolvedValue({
      debugInfo: JSON.stringify({ channelDisabled: false }),
    })

    await whatsappChannelQueueJob()

    expect(queueModel.update).not.toHaveBeenCalled()
    expect(billingSpy).not.toHaveBeenCalled()
    expect((global as any).fetch).not.toHaveBeenCalled()
  })
})
