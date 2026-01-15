/**
 * Support Ticket Service Unit Tests
 * Tests business logic for support ticket operations
 */

import { SupportTicketService } from '../../../src/services/support-ticket.service'
import { supportTicketRepository } from '../../../src/repositories/support-ticket.repository'
import { storageService } from '../../../src/services/storage.service'
import { SupportIssueType, SupportTicketStatus, SupportSenderType } from '@echatbot/database'

// Mock dependencies
jest.mock('../../../src/repositories/support-ticket.repository')
jest.mock('../../../src/services/storage.service')
jest.mock('../../../src/application/services/email.service')
jest.mock('../../../src/services/websocket.service')

describe('SupportTicketService', () => {
  let service: SupportTicketService

  beforeEach(() => {
    service = new SupportTicketService()
    jest.clearAllMocks()
  })

  describe('createTicket', () => {
    it('should create a support ticket successfully', async () => {
      const mockTicket = {
        id: 'ticket-1',
        ticketCode: 'TKT-ABC123',
        userId: 'user-1',
        workspaceId: 'workspace-1',
        issueType: SupportIssueType.TECHNICAL,
        subject: 'Test Issue',
        status: SupportTicketStatus.PENDING,
        user: { id: 'user-1', email: 'test@test.com', firstName: 'Test', lastName: 'User' },
        workspace: { id: 'workspace-1', name: 'Test Workspace' },
        messages: [],
        _count: { messages: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(supportTicketRepository.create as jest.Mock).mockResolvedValue(mockTicket)

      const result = await service.createTicket({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        issueType: SupportIssueType.TECHNICAL,
        subject: 'Test Issue',
        initialMessage: 'This is a test message',
      })

      expect(result).toEqual(mockTicket)
      expect(supportTicketRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        issueType: SupportIssueType.TECHNICAL,
        subject: 'Test Issue',
        initialMessage: 'This is a test message',
        createdById: undefined,
        createdByType: undefined,
      })
    })

    it('should create ticket without workspaceId (optional)', async () => {
      const mockTicket = {
        id: 'ticket-1',
        ticketCode: 'TKT-ABC123',
        userId: 'user-1',
        workspaceId: null,
        issueType: SupportIssueType.ACCOUNT_ISSUE,
        subject: 'Account Issue',
        status: SupportTicketStatus.PENDING,
        user: { id: 'user-1', email: 'test@test.com', firstName: null, lastName: null },
        workspace: null,
        messages: [],
        _count: { messages: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(supportTicketRepository.create as jest.Mock).mockResolvedValue(mockTicket)

      const result = await service.createTicket({
        userId: 'user-1',
        issueType: SupportIssueType.ACCOUNT_ISSUE,
        subject: 'Account Issue',
        initialMessage: 'I need help with my account',
      })

      expect(result.workspaceId).toBeNull()
      expect(result.workspace).toBeNull()
    })
  })

  describe('createTicket (admin initiated)', () => {
    it('should create a support ticket with admin as sender', async () => {
      const mockTicket = {
        id: 'ticket-2',
        ticketCode: 'TKT-ADMIN1',
        userId: 'user-2',
        workspaceId: null,
        issueType: SupportIssueType.OTHER,
        subject: 'Support Message',
        status: SupportTicketStatus.PENDING,
        user: { id: 'user-2', email: 'owner@test.com', firstName: 'Owner', lastName: 'User' },
        workspace: null,
        messages: [],
        _count: { messages: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(supportTicketRepository.create as jest.Mock).mockResolvedValue(mockTicket)

      const result = await service.createTicket({
        userId: 'user-2',
        issueType: SupportIssueType.OTHER,
        subject: 'Support Message',
        initialMessage: 'Hello from support',
        createdById: 'admin-1',
        createdByType: SupportSenderType.ADMIN,
      })

      expect(result).toEqual(mockTicket)
      expect(supportTicketRepository.create).toHaveBeenCalledWith({
        userId: 'user-2',
        workspaceId: undefined,
        issueType: SupportIssueType.OTHER,
        subject: 'Support Message',
        initialMessage: 'Hello from support',
        createdById: 'admin-1',
        createdByType: SupportSenderType.ADMIN,
      })
    })
  })

  describe('getUserTickets', () => {
    it('should return tickets with hasUnreadMessages field for customer', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          ticketCode: 'TKT-1',
          userId: 'user-1',
          status: SupportTicketStatus.PENDING,
          messages: [
            { id: 'msg-1', senderType: SupportSenderType.ADMIN, readByCustomer: false },
            { id: 'msg-2', senderType: SupportSenderType.CUSTOMER, readByCustomer: true },
          ],
        },
        {
          id: 'ticket-2',
          ticketCode: 'TKT-2',
          userId: 'user-1',
          status: SupportTicketStatus.IN_PROGRESS,
          messages: [
            { id: 'msg-3', senderType: SupportSenderType.CUSTOMER, readByCustomer: true },
          ],
        },
      ]

      ;(supportTicketRepository.findAll as jest.Mock).mockResolvedValue({
        tickets: mockTickets,
        total: 2,
        page: 1,
        totalPages: 1,
      })

      const result = await service.getUserTickets('user-1', 1, 20)

      expect(result.tickets[0].hasUnreadMessages).toBe(true) // Has unread ADMIN message
      expect(result.tickets[1].hasUnreadMessages).toBe(false) // No unread ADMIN messages
    })
  })

  describe('getAllTickets (admin)', () => {
    it('should return tickets with hasUnreadMessages field for admin', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          ticketCode: 'TKT-1',
          userId: 'user-1',
          status: SupportTicketStatus.PENDING,
          messages: [
            { id: 'msg-1', senderType: SupportSenderType.CUSTOMER, readByAdmin: false },
          ],
        },
        {
          id: 'ticket-2',
          ticketCode: 'TKT-2',
          userId: 'user-2',
          status: SupportTicketStatus.IN_PROGRESS,
          messages: [
            { id: 'msg-2', senderType: SupportSenderType.ADMIN, readByAdmin: true },
          ],
        },
      ]

      ;(supportTicketRepository.findAll as jest.Mock).mockResolvedValue({
        tickets: mockTickets,
        total: 2,
        page: 1,
        totalPages: 1,
      })

      const result = await service.getAllTickets(1, 20)

      expect(result.tickets[0].hasUnreadMessages).toBe(true) // Has unread CUSTOMER message
      expect(result.tickets[1].hasUnreadMessages).toBe(false) // No unread CUSTOMER messages
    })
  })

  describe('addMessage', () => {
    it('should add message with attachments', async () => {
      const mockMessage = {
        id: 'msg-1',
        ticketId: 'ticket-1',
        senderId: 'user-1',
        senderType: SupportSenderType.CUSTOMER,
        content: 'Test message',
        attachments: [],
        createdAt: new Date(),
      }

      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('fake-image-data'),
        mimetype: 'image/jpeg',
        size: 1024,
      }

      ;(supportTicketRepository.addMessage as jest.Mock).mockResolvedValue(mockMessage)
      ;(storageService.upload as jest.Mock).mockResolvedValue({
        url: 'http://localhost:3001/uploads/support-tickets/ticket-1/test.jpg',
        key: '/uploads/support-tickets/ticket-1/test.jpg',
      })
      ;(supportTicketRepository.addAttachment as jest.Mock).mockResolvedValue({
        id: 'att-1',
        messageId: 'msg-1',
        filename: 'test.jpg',
        url: 'http://localhost:3001/uploads/support-tickets/ticket-1/test.jpg',
        storageKey: '/uploads/support-tickets/ticket-1/test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      })
      ;(supportTicketRepository.findById as jest.Mock).mockResolvedValue({
        id: 'ticket-1',
        messages: [
          {
            ...mockMessage,
            attachments: [
              {
                id: 'att-1',
                filename: 'test.jpg',
                url: 'http://localhost:3001/uploads/support-tickets/ticket-1/test.jpg',
              },
            ],
          },
        ],
      })

      const result = await service.addMessage(
        {
          ticketId: 'ticket-1',
          senderId: 'user-1',
          senderType: SupportSenderType.CUSTOMER,
          content: 'Test message',
        },
        [mockFile]
      )

      expect(storageService.upload).toHaveBeenCalledWith(
        mockFile.buffer,
        expect.objectContaining({
          filename: expect.stringContaining('test.jpg'),
          folder: 'support-tickets/ticket-1',
          contentType: 'image/jpeg',
          isPublic: false,
        })
      )
      expect(supportTicketRepository.addAttachment).toHaveBeenCalled()
    })

    it('should handle multiple attachments (max 5)', async () => {
      const mockMessage = {
        id: 'msg-1',
        ticketId: 'ticket-1',
        senderId: 'user-1',
        senderType: SupportSenderType.CUSTOMER,
        content: 'Test message',
        attachments: [],
      }

      const mockFiles = Array(3)
        .fill(null)
        .map((_, i) => ({
          originalname: `file${i}.jpg`,
          buffer: Buffer.from(`data${i}`),
          mimetype: 'image/jpeg',
          size: 1024,
        }))

      ;(supportTicketRepository.addMessage as jest.Mock).mockResolvedValue(mockMessage)
      ;(storageService.upload as jest.Mock).mockResolvedValue({
        url: 'http://localhost:3001/uploads/file.jpg',
        key: '/uploads/file.jpg',
      })
      ;(supportTicketRepository.addAttachment as jest.Mock).mockResolvedValue({})
      ;(supportTicketRepository.findById as jest.Mock).mockResolvedValue({
        messages: [mockMessage],
      })

      await service.addMessage(
        {
          ticketId: 'ticket-1',
          senderId: 'user-1',
          senderType: SupportSenderType.CUSTOMER,
          content: 'Test message',
        },
        mockFiles
      )

      expect(storageService.upload).toHaveBeenCalledTimes(3)
      expect(supportTicketRepository.addAttachment).toHaveBeenCalledTimes(3)
    })
  })

  describe('updateStatus', () => {
    it('should update ticket status', async () => {
      const mockTicket = {
        id: 'ticket-1',
        status: SupportTicketStatus.CLOSED,
      }

      ;(supportTicketRepository.updateStatus as jest.Mock).mockResolvedValue(mockTicket)

      const result = await service.updateStatus('ticket-1', SupportTicketStatus.CLOSED)

      expect(supportTicketRepository.updateStatus).toHaveBeenCalledWith(
        'ticket-1',
        SupportTicketStatus.CLOSED
      )
      expect(result.status).toBe(SupportTicketStatus.CLOSED)
    })
  })

  describe('countUnreadMessages', () => {
    it('should count unread messages for customer', async () => {
      ;(supportTicketRepository.countUnreadMessages as jest.Mock).mockResolvedValue(3)

      const count = await service.countUnreadMessages('user-1')

      expect(count).toBe(3)
      expect(supportTicketRepository.countUnreadMessages).toHaveBeenCalledWith('user-1')
    })
  })

  describe('countUnreadMessagesForAdmin', () => {
    it('should count unread messages for admin', async () => {
      ;(supportTicketRepository.countUnreadMessagesForAdmin as jest.Mock).mockResolvedValue(5)

      const count = await service.countUnreadMessagesForAdmin()

      expect(count).toBe(5)
    })
  })

  describe('deleteTicket', () => {
    it('should delete ticket and attachments from storage', async () => {
      const mockTicket = {
        id: 'ticket-1',
        ticketCode: 'TKT-ABC123',
        messages: [
          {
            id: 'msg-1',
            attachments: [
              { id: 'att-1', storageKey: 'support-tickets/ticket-1/one.png' },
              { id: 'att-2', storageKey: 'support-tickets/ticket-1/two.pdf' },
            ],
          },
          { id: 'msg-2', attachments: [] },
        ],
      }

      ;(supportTicketRepository.findById as jest.Mock).mockResolvedValue(mockTicket)
      ;(supportTicketRepository.deleteTicket as jest.Mock).mockResolvedValue({
        id: 'ticket-1',
        ticketCode: 'TKT-ABC123',
      })
      ;(storageService.delete as jest.Mock).mockResolvedValue(undefined)

      const result = await service.deleteTicket('ticket-1')

      expect(storageService.delete).toHaveBeenCalledTimes(2)
      expect(supportTicketRepository.deleteTicket).toHaveBeenCalledWith('ticket-1')
      expect(result).toEqual({ id: 'ticket-1', ticketCode: 'TKT-ABC123' })
    })

    it('should return null when ticket does not exist', async () => {
      ;(supportTicketRepository.findById as jest.Mock).mockResolvedValue(null)

      const result = await service.deleteTicket('missing-ticket')

      expect(result).toBeNull()
      expect(storageService.delete).not.toHaveBeenCalled()
      expect(supportTicketRepository.deleteTicket).not.toHaveBeenCalled()
    })
  })
})
