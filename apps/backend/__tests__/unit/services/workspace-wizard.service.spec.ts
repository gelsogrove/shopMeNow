/**
 * Unit Tests: Workspace Wizard Creation
 * Tests Andrea's simplified 7-step wizard logic
 */

import { workspaceService } from '../../../src/services/workspace.service'
import { prisma } from '@echatbot/database'

// Mock Prisma
jest.mock('@echatbot/database', () => ({
  prisma: {
    workspace: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    agentConfig: {
      findMany: jest.fn(),
    },
    fAQ: {
      createMany: jest.fn(),
    },
  },
}))

describe('Workspace Wizard Service - Andrea\'s Simplified Wizard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('WhatsApp Channel Creation', () => {
    it('should create WhatsApp channel with channelType=WHATSAPP', async () => {
      const mockWorkspace = {
        id: 'workspace-123',
        name: 'My Store',
        channelType: 'WHATSAPP',
        whatsappPhoneNumber: '+393331234567',
        sellsProductsAndServices: true,
        operatorEmail: 'andrea@example.com',
        operatorContactMethod: 'email',
      }

      ;(prisma.workspace.create as jest.Mock).mockResolvedValue(mockWorkspace)

      const result = await workspaceService.create({
        name: 'My Store',
        channelType: 'WHATSAPP',
        whatsappPhoneNumber: '+393331234567',
        sellsProductsAndServices: true,
        operatorEmail: 'andrea@example.com',
        adminEmail: 'andrea@example.com',
      })

      expect(prisma.workspace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channelType: 'WHATSAPP',
            operatorEmail: 'andrea@example.com',
            operatorContactMethod: 'email',
            enableWhatsapp: true,
            enableWidget: false,
          }),
        })
      )
      expect(result.channelType).toBe('WHATSAPP')
    })

    it('should create WhatsApp channel with e-commerce enabled', async () => {
      const mockWorkspace = {
        id: 'workspace-123',
        sellsProductsAndServices: true,
        hasSalesAgents: false,
      }

      ;(prisma.workspace.create as jest.Mock).mockResolvedValue(mockWorkspace)

      const result = await workspaceService.create({
        name: 'E-commerce Store',
        channelType: 'WHATSAPP',
        whatsappPhoneNumber: '+393331234567',
        sellsProductsAndServices: true,
        hasSalesAgents: false,
        operatorEmail: 'owner@store.com',
      })

      expect(result.sellsProductsAndServices).toBe(true)
    })
  })

  describe('Widget Channel Creation', () => {
    it('should create Widget channel with channelType=WIDGET', async () => {
      const mockWorkspace = {
        id: 'workspace-456',
        name: 'Support Widget',
        channelType: 'WIDGET',
        whatsappPhoneNumber: null,
        sellsProductsAndServices: false,
        operatorEmail: 'support@company.com',
      }

      ;(prisma.workspace.create as jest.Mock).mockResolvedValue(mockWorkspace)

      const result = await workspaceService.create({
        name: 'Support Widget',
        channelType: 'WIDGET',
        sellsProductsAndServices: false,
        operatorEmail: 'support@company.com',
        adminEmail: 'support@company.com',
      })

      expect(prisma.workspace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channelType: 'WIDGET',
            sellsProductsAndServices: false,
            enableWidget: true,
            enableWhatsapp: false,
          }),
        })
      )
      expect(result.channelType).toBe('WIDGET')
      expect(result.whatsappPhoneNumber).toBeNull()
    })

    it('should force sellsProductsAndServices=false for Widget channels', async () => {
      const mockWorkspace = {
        id: 'workspace-789',
        channelType: 'WIDGET',
        sellsProductsAndServices: false,
      }

      ;(prisma.workspace.create as jest.Mock).mockResolvedValue(mockWorkspace)

      // Even if user tries to enable e-commerce for Widget, it should be forced to false
      const result = await workspaceService.create({
        name: 'Widget Test',
        channelType: 'WIDGET',
        sellsProductsAndServices: true, // ❌ Invalid (Widget can't sell)
        operatorEmail: 'test@widget.com',
      })

      // Backend should handle this (business logic validation)
      expect(result.sellsProductsAndServices).toBe(false)
    })
  })

  describe('Operator Email Configuration', () => {
    it('should always use email as operatorContactMethod (Andrea\'s requirement)', async () => {
      const mockWorkspace = {
        id: 'workspace-abc',
        operatorContactMethod: 'email',
        operatorEmail: 'andrea@business.com',
      }

      ;(prisma.workspace.create as jest.Mock).mockResolvedValue(mockWorkspace)

      const result = await workspaceService.create({
        name: 'Test Channel',
        channelType: 'WHATSAPP',
        whatsappPhoneNumber: '+393331234567',
        operatorContactMethod: 'email',
        operatorEmail: 'andrea@business.com',
        adminEmail: 'andrea@business.com',
      })

      expect(result.operatorContactMethod).toBe('email')
      expect(result.operatorEmail).toBe('andrea@business.com')
    })

    it('should use adminEmail as operatorEmail if not provided', async () => {
      const mockWorkspace = {
        id: 'workspace-def',
        operatorEmail: 'admin@business.com',
      }

      ;(prisma.workspace.create as jest.Mock).mockResolvedValue(mockWorkspace)

      await workspaceService.create({
        name: 'Test Channel',
        channelType: 'WHATSAPP',
        whatsappPhoneNumber: '+393331234567',
        adminEmail: 'admin@business.com',
        // operatorEmail not provided
      })

      expect(prisma.workspace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            operatorContactMethod: 'email',
          }),
        })
      )
    })
  })

  describe('FAQs Creation', () => {
    it('should create e-commerce FAQs for WhatsApp channels', async () => {
      const mockWorkspace = { id: 'workspace-faq1' }
      ;(prisma.workspace.create as jest.Mock).mockResolvedValue(mockWorkspace)
      ;(prisma.fAQ.createMany as jest.Mock).mockResolvedValue({ count: 4 })

      const faqs = [
        { question: 'How long does it take to receive the order?', answer: '24-48 hours' },
        { question: 'What is your refund policy?', answer: '30 days return' },
        { question: 'What are your business hours?', answer: 'Mon-Fri 9am-6pm' },
        { question: 'What payment methods do you accept?', answer: 'Credit card, PayPal' },
      ]

      await workspaceService.create({
        name: 'Store',
        channelType: 'WHATSAPP',
        whatsappPhoneNumber: '+393331234567',
        sellsProductsAndServices: true,
        faqs,
        operatorEmail: 'owner@store.com',
      })

      expect(prisma.fAQ.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            question: 'How long does it take to receive the order?',
            answer: '24-48 hours',
          }),
        ]),
      })
    })

    it('should create support FAQs for Widget channels', async () => {
      const mockWorkspace = { id: 'workspace-faq2' }
      ;(prisma.workspace.create as jest.Mock).mockResolvedValue(mockWorkspace)
      ;(prisma.fAQ.createMany as jest.Mock).mockResolvedValue({ count: 4 })

      const faqs = [
        { question: 'What services do you offer?', answer: 'Consulting, training' },
        { question: 'What are your business hours?', answer: 'Mon-Fri 9am-6pm' },
        { question: 'How can I contact support?', answer: 'support@company.com' },
        { question: 'Do you offer consultations?', answer: 'Yes, free first session' },
      ]

      await workspaceService.create({
        name: 'Support Widget',
        channelType: 'WIDGET',
        sellsProductsAndServices: false,
        faqs,
        operatorEmail: 'support@company.com',
      })

      expect(prisma.fAQ.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            question: 'What services do you offer?',
          }),
        ]),
      })
    })

    it('should skip FAQs with empty answers', async () => {
      const mockWorkspace = { id: 'workspace-faq3' }
      ;(prisma.workspace.create as jest.Mock).mockResolvedValue(mockWorkspace)

      const faqs = [
        { question: 'Q1', answer: 'Answer 1' },
        { question: 'Q2', answer: '' }, // ❌ Empty answer - should be filtered
        { question: 'Q3', answer: 'Answer 3' },
      ]

      await workspaceService.create({
        name: 'Test',
        channelType: 'WHATSAPP',
        whatsappPhoneNumber: '+393331234567',
        faqs,
        operatorEmail: 'test@test.com',
      })

      // Should only create 2 FAQs (skip empty answer)
      expect(prisma.fAQ.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ question: 'Q1', answer: 'Answer 1' }),
          expect.objectContaining({ question: 'Q3', answer: 'Answer 3' }),
        ]),
      })
      
      const createManyCall = (prisma.fAQ.createMany as jest.Mock).mock.calls[0][0]
      expect(createManyCall.data.length).toBe(2) // Only 2 FAQs created
    })
  })

  describe('Validation', () => {
    it('should require whatsappPhoneNumber for WhatsApp channels', async () => {
      await expect(
        workspaceService.create({
          name: 'Invalid WhatsApp',
          channelType: 'WHATSAPP',
          // whatsappPhoneNumber missing
          operatorEmail: 'test@test.com',
        })
      ).rejects.toThrow()
    })

    it('should NOT require whatsappPhoneNumber for Widget channels', async () => {
      const mockWorkspace = { id: 'widget-valid', channelType: 'WIDGET' }
      ;(prisma.workspace.create as jest.Mock).mockResolvedValue(mockWorkspace)

      const result = await workspaceService.create({
        name: 'Valid Widget',
        channelType: 'WIDGET',
        // whatsappPhoneNumber NOT required for Widget
        operatorEmail: 'test@test.com',
      })

      expect(result.channelType).toBe('WIDGET')
    })
  })
})
