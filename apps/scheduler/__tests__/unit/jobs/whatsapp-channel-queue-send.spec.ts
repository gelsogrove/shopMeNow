import { prisma } from '@echatbot/database'
import { whatsappChannelQueueJob } from '../../../src/jobs/whatsapp-channel-queue.job'
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

  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetConfig.mockReset()
    securitySpy = jest.spyOn(SecurityAgentService.prototype, 'validateMessage').mockResolvedValue({ isSafe: true })
    billingSpy = jest.spyOn(BillingService.prototype, 'deductMessageCredit').mockResolvedValue({ success: true })
    ;(global as any).fetch = jest.fn()

    workspaceModel = { findMany: jest.fn() }
    queueModel = { findMany: jest.fn(), update: jest.fn() }
    ;(prisma as any).workspace = workspaceModel
    ;(prisma as any).whatsAppQueue = queueModel
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
})
