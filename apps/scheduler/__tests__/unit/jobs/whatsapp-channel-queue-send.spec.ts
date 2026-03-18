import { prisma } from '@echatbot/database'
import axios from 'axios'
import { whatsappChannelQueueJob, clearRecipientThrottleCache } from '../../../src/jobs/whatsapp-channel-queue.job'
import { getWorkspaceWhatsAppConfig } from '../../../src/services/whatsapp-config.service'
import { SecurityAgentService } from '../../../src/services/security-agent.service'
import { BillingService } from '../../../src/services/billing.service'

jest.mock('../../../src/services/whatsapp-config.service', () => ({
  getWorkspaceWhatsAppConfig: jest.fn(),
}))
jest.mock('axios')

describe('whatsappChannelQueueJob - WhatsApp send', () => {
  const mockedGetConfig = getWorkspaceWhatsAppConfig as jest.MockedFunction<typeof getWorkspaceWhatsAppConfig>

  let securitySpy: jest.SpyInstance
  let billingSpy: jest.SpyInstance
  let workspaceModel: any
  let queueModel: any
  let conversationModel: any
  let pushCampaignRecipientModel: any
  const setWorkspace = (workspace: any) => {
    workspaceModel.findMany.mockResolvedValue([workspace])
    workspaceModel.findUnique.mockResolvedValue(workspace)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetConfig.mockReset()
    securitySpy = jest.spyOn(SecurityAgentService.prototype, 'validateMessage').mockResolvedValue({ isSafe: true })
    billingSpy = jest.spyOn(BillingService.prototype, 'deductMessageCredit').mockResolvedValue({ success: true })
    jest.spyOn(BillingService.prototype, 'hasOwnerCredit').mockResolvedValue(true)
    clearRecipientThrottleCache()

    workspaceModel = { findMany: jest.fn(), findUnique: jest.fn() }
    queueModel = { findMany: jest.fn(), update: jest.fn(), findFirst: jest.fn() }
    conversationModel = { findUnique: jest.fn(), update: jest.fn() }
    pushCampaignRecipientModel = { findMany: jest.fn(), updateMany: jest.fn() }
    ;(prisma as any).workspace = workspaceModel
    ;(prisma as any).whatsAppQueue = queueModel
    ;(prisma as any).conversationMessage = conversationModel
    ;(prisma as any).pushCampaignRecipient = pushCampaignRecipientModel

    pushCampaignRecipientModel.findMany.mockResolvedValue([])
    queueModel.findFirst.mockResolvedValue(null)
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

    setWorkspace({ 
      id: 'w1', 
      name: 'W', 
      whatsappApiKey: 'token', 
      whatsappPhoneNumber: '19999999999', 
      channelStatus: true, 
      debugMode: false,
      whatsappProvider: 'meta',
      metaPhoneNumberId: '19999999999',
      metaAccessToken: 'token'
    })

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
    ;(axios.post as jest.Mock).mockResolvedValue({
      data: { messages: [{ id: 'wa-123' }] },
    })

    await whatsappChannelQueueJob()

    expect(axios.post).toHaveBeenCalled()
    expect(queueModel.update).toHaveBeenCalled()
    const sentCall = queueModel.update.mock.calls.find((call: any) => call[0]?.data?.status === 'sent')
    expect(sentCall?.[0].data.status).toBe('sent')
  })

  it('does NOT re-charge push cost in queue — push is pre-billed at enqueue in push-campaigns.job', async () => {
    // SCENARIO: Message in queue belongs to a push campaign (recipient found)
    // RULE: Push is pre-billed by push-campaigns.job.ts at enqueue time.
    //       The queue job must NOT bill again — only update sentAt on the recipient.
    // HISTORY: Previously caused 3x billing (push-campaigns + queue line 692 + queue line 731).
    mockedGetConfig.mockResolvedValue({
      workspaceId: 'w1',
      phoneNumber: '19999999999',
      apiKey: 'token',
    })

    setWorkspace({
      id: 'w1',
      name: 'W',
      whatsappApiKey: 'token',
      whatsappPhoneNumber: '19999999999',
      channelStatus: true,
      debugMode: false,
      whatsappProvider: 'meta',
      metaPhoneNumberId: '19999999999',
      metaAccessToken: 'token',
    })

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

    pushCampaignRecipientModel.findMany.mockResolvedValue([
      { messageId: 'q1' },
    ])

    queueModel.update.mockResolvedValue({})
    ;(axios.post as jest.Mock).mockResolvedValue({
      data: { messages: [{ id: 'wa-123' }] },
    })

    await whatsappChannelQueueJob()

    // Push messages must NOT trigger deductMessageCredit — pre-billed at enqueue
    expect(billingSpy).not.toHaveBeenCalled()
    // Instead, sentAt must be updated on the push recipient
    expect(pushCampaignRecipientModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { messageId: 'q1' }, data: expect.objectContaining({ sentAt: expect.any(Date) }) })
    )
  })

  it('uses phoneNumberId in Graph API URL (Meta expects ID, not display number)', async () => {
    // Problem: sending to /{phoneNumber} breaks in production because Meta expects phoneNumberId.
    mockedGetConfig.mockResolvedValue({
      workspaceId: 'w1',
      phoneNumber: '19999999999',
      phoneNumberId: '123456789012345',
      apiKey: 'token',
    })

    setWorkspace({ 
      id: 'w1', 
      name: 'W', 
      whatsappApiKey: 'token', 
      whatsappPhoneNumber: '19999999999', 
      channelStatus: true, 
      debugMode: false,
      whatsappProvider: 'meta',
      metaPhoneNumberId: '123456789012345',
      metaAccessToken: 'token'
    })

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

    ;(axios.post as jest.Mock).mockResolvedValue({
      data: { messages: [{ id: 'wa-123' }] },
    })

    await whatsappChannelQueueJob()

    const [url] = (axios.post as jest.Mock).mock.calls[0]
    expect(url).toContain('/v21.0/123456789012345/messages')
  })

  it('falls back to phoneNumber when phoneNumberId is missing', async () => {
    mockedGetConfig.mockResolvedValue({
      workspaceId: 'w1',
      phoneNumber: '19999999999',
      apiKey: 'token',
    })

    setWorkspace({ 
      id: 'w1', 
      name: 'W', 
      whatsappApiKey: 'token', 
      whatsappPhoneNumber: '19999999999', 
      channelStatus: true, 
      debugMode: false,
      whatsappProvider: 'meta',
      metaPhoneNumberId: '19999999999',
      metaAccessToken: 'token'
    })

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

    ;(axios.post as jest.Mock).mockResolvedValue({
      data: { messages: [{ id: 'wa-123' }] },
    })

    await whatsappChannelQueueJob()

    const [url] = (axios.post as jest.Mock).mock.calls[0]
    expect(url).toContain('/v21.0/19999999999/messages')
  })

  it('marks queue as error when credit or subscription is missing', async () => {
    jest.spyOn(BillingService.prototype, 'hasOwnerCredit').mockResolvedValue(false)

    mockedGetConfig.mockResolvedValue({
      workspaceId: 'w1',
      phoneNumber: '19999999999',
      apiKey: 'token',
    })

    setWorkspace({ 
      id: 'w1', 
      name: 'W', 
      whatsappApiKey: 'token', 
      whatsappPhoneNumber: '19999999999', 
      channelStatus: true, 
      debugMode: false,
      whatsappProvider: 'meta',
      metaPhoneNumberId: '19999999999',
      metaAccessToken: 'token'
    })

    queueModel.findMany.mockResolvedValue([
      {
        id: 'q1',
        workspaceId: 'w1',
        customerId: 'c1',
        phoneNumber: '+39000000000',
        messageContent: 'ciao',
        status: 'pending',
        channel: 'whatsapp',
        conversationMessageId: 'conv-123',
      },
    ])

    queueModel.update.mockResolvedValue({})
    jest.spyOn(BillingService.prototype, 'hasOwnerCredit').mockResolvedValue(false)

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

    setWorkspace({ 
      id: 'w1', 
      name: 'W', 
      whatsappApiKey: 'token', 
      whatsappPhoneNumber: '19999999999', 
      channelStatus: true, 
      debugMode: false,
      whatsappProvider: 'meta',
      metaPhoneNumberId: '19999999999',
      metaAccessToken: 'token'
    })

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

    ;(axios.post as jest.Mock).mockRejectedValue({
      message: 'Request failed with status code 500',
      response: { data: { error: { message: 'error' } } },
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

    setWorkspace({ 
      id: 'w1', 
      name: 'W', 
      whatsappApiKey: 'token', 
      whatsappPhoneNumber: '19999999999', 
      channelStatus: false, 
      debugMode: false,
      whatsappProvider: 'meta',
      metaPhoneNumberId: '19999999999',
      metaAccessToken: 'token'
    })

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

    ;(axios.post as jest.Mock).mockResolvedValue({
      data: { messages: [{ id: 'wa-456' }] },
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

    setWorkspace({ 
      id: 'w1', 
      name: 'W', 
      whatsappApiKey: 'token', 
      whatsappPhoneNumber: '19999999999', 
      channelStatus: false, 
      debugMode: false,
      whatsappProvider: 'meta',
      metaPhoneNumberId: '19999999999',
      metaAccessToken: 'token'
    })

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
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('sends system notifications (no conversationMessageId) even in WIP-only mode (channelStatus=false)', async () => {
    // SCENARIO: contactOperator creates a WhatsApp queue entry for the OPERATOR without
    // conversationMessageId (it's a system notification, not a conversation reply).
    // When channelStatus is false (wipOnly mode), this message should STILL be sent
    // because operator notifications are critical and should never be blocked by WIP mode.
    // RULE: Messages without conversationMessageId bypass wipOnly filter.
    mockedGetConfig.mockResolvedValue({
      workspaceId: 'w1',
      phoneNumber: '19999999999',
      apiKey: 'token',
    })

    setWorkspace({
      id: 'w1',
      name: 'W',
      whatsappApiKey: 'token',
      whatsappPhoneNumber: '19999999999',
      channelStatus: false, // WIP-only mode enabled
      debugMode: false,
      whatsappProvider: 'meta',
      metaPhoneNumberId: '19999999999',
      metaAccessToken: 'token',
    })

    queueModel.findMany.mockResolvedValue([
      {
        id: 'operator-notification-1',
        workspaceId: 'w1',
        customerId: 'c1',
        phoneNumber: '+34654728753', // Operator's phone number
        messageContent: '🔔 *RICHIESTA ASSISTENZA OPERATORE*\n\nCliente: Mario Rossi ha richiesto supporto.',
        status: 'pending',
        channel: 'whatsapp',
        conversationMessageId: null, // No conversationMessageId = system notification
      },
    ])

    queueModel.update.mockResolvedValue({})
    ;(axios.post as jest.Mock).mockResolvedValue({
      data: { messages: [{ id: 'wa-operator-1' }] },
    })

    await whatsappChannelQueueJob()

    // ASSERT: Message was sent despite WIP-only mode
    expect(axios.post).toHaveBeenCalled()
    const sentCall = queueModel.update.mock.calls.find((call: any) => call[0]?.data?.status === 'sent')
    expect(sentCall).toBeDefined()
    expect(sentCall?.[0].data.status).toBe('sent')
  })

  it('sends system notifications (no conversationMessageId) even when debugMode is true', async () => {
    // SCENARIO: Workspace has debugMode=true (another condition that activates wipOnly mode).
    // Operator notifications should STILL be delivered.
    // RULE: System notifications bypass wipOnly regardless of whether it was triggered by
    // channelStatus=false or debugMode=true.
    mockedGetConfig.mockResolvedValue({
      workspaceId: 'w1',
      phoneNumber: '19999999999',
      apiKey: 'token',
    })

    setWorkspace({
      id: 'w1',
      name: 'W',
      whatsappApiKey: 'token',
      whatsappPhoneNumber: '19999999999',
      channelStatus: true,
      debugMode: true, // debugMode activates wipOnly mode
      whatsappProvider: 'meta',
      metaPhoneNumberId: '19999999999',
      metaAccessToken: 'token',
    })

    queueModel.findMany.mockResolvedValue([
      {
        id: 'operator-notification-2',
        workspaceId: 'w1',
        customerId: 'c1',
        phoneNumber: '+34654728753',
        messageContent: '🔔 *RICHIESTA ASSISTENZA OPERATORE*',
        status: 'pending',
        channel: 'whatsapp',
        conversationMessageId: undefined, // undefined also means no conversationMessageId
      },
    ])

    queueModel.update.mockResolvedValue({})
    ;(axios.post as jest.Mock).mockResolvedValue({
      data: { messages: [{ id: 'wa-operator-2' }] },
    })

    await whatsappChannelQueueJob()

    // ASSERT: Message was sent despite debugMode wipOnly
    expect(axios.post).toHaveBeenCalled()
    const sentCall = queueModel.update.mock.calls.find((call: any) => call[0]?.data?.status === 'sent')
    expect(sentCall).toBeDefined()
  })
})
