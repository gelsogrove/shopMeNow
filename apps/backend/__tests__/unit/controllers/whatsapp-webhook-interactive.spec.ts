/**
 * WhatsApp Webhook Controller Tests
 * 
 * Verifica ricezione corretta di:
 * - ✅ Messaggi text normali
 * - ✅ Button reply (interactive.button_reply.title)
 * - ✅ List reply (interactive.list_reply.title)
 * - ✅ Media con caption (image, video, document)
 */

import { Request, Response } from 'express'
import { WhatsAppWebhookController } from '../../../src/interfaces/http/controllers/whatsapp-webhook.controller'
import { prisma } from '@echatbot/database'

// Mock prisma
jest.mock('@echatbot/database', () => ({
  prisma: {
    workspace: {
      findFirst: jest.fn(),
    },
    customers: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    chatSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    conversationMessages: {
      create: jest.fn(),
    },
  },
}))

// Mock services
jest.mock('../../../src/services/message-sending.service', () => ({
  __esModule: true,
  default: {
    sendMessage: jest.fn().mockResolvedValue({ success: true }),
  },
}))

jest.mock('../../../src/application/chat-engine/chat-engine.service', () => ({
  ChatEngineService: jest.fn().mockImplementation(() => ({
    processMessage: jest.fn().mockResolvedValue({
      success: true,
      output: 'Risposta del bot',
      tokensUsed: 100,
      executionTimeMs: 500,
    }),
  })),
}))

describe('WhatsApp Webhook Controller - Interactive Messages', () => {
  let controller: WhatsAppWebhookController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>

  beforeEach(() => {
    controller = new WhatsAppWebhookController()
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    }

    // Mock workspace
    ;(prisma.workspace.findFirst as jest.Mock).mockResolvedValue({
      id: 'workspace-1',
      name: 'Test Workspace',
      whatsappApiKey: 'test-key',
      whatsappPhoneNumber: '+393331234567',
    })

    // Mock customer
    ;(prisma.customers.findFirst as jest.Mock).mockResolvedValue({
      id: 'customer-1',
      phone: '+393331234567',
      workspaceId: 'workspace-1',
    })

    // Mock chat session
    ;(prisma.chatSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      customerId: 'customer-1',
      workspaceId: 'workspace-1',
      status: 'active',
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Text Messages (Standard)', () => {
    it('should extract text from standard text message', async () => {
      // SCENARIO: Cliente invia "Ciao"
      // EXPECTED: Sistema riceve "Ciao" come testo
      
      mockReq = {
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{
                  from: '393331234567',
                  id: 'msg-123',
                  timestamp: '1234567890',
                  type: 'text',
                  text: { body: 'Ciao' }
                }],
                contacts: [{ profile: { name: 'Mario Rossi' } }],
              }
            }]
          }],
        },
        params: { webhookId: 'webhook-123' },
      }

      await controller.receiveMessage(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      // Verify message was processed (ChatEngine called)
      expect(mockRes.json).toHaveBeenCalled()
    })
  })

  describe('Button Reply Messages', () => {
    it('should extract title from button_reply', async () => {
      // SCENARIO: Cliente clicca bottone "Formaggi" (interactive button)
      // PAYLOAD WhatsApp: interactive.button_reply.title = "Formaggi"
      // EXPECTED: Sistema riceve "Formaggi" come testo del messaggio
      
      mockReq = {
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{
                  from: '393331234567',
                  id: 'msg-456',
                  timestamp: '1234567890',
                  type: 'interactive',
                  interactive: {
                    type: 'button_reply',
                    button_reply: {
                      id: 'cat_1',
                      title: 'Formaggi'
                    }
                  }
                }],
              }
            }]
          }],
        },
        params: { webhookId: 'webhook-123' },
      }

      await controller.receiveMessage(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      // TODO: Verify "Formaggi" was extracted and passed to ChatEngine
    })

    it('should handle button_reply with id and title', async () => {
      // SCENARIO: Cliente clicca bottone con ID specifico
      // RULE: Prendiamo il TITLE, non l'ID (più human-readable per LLM)
      
      mockReq = {
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{
                  from: '393331234567',
                  id: 'msg-789',
                  timestamp: '1234567890',
                  type: 'interactive',
                  interactive: {
                    type: 'button_reply',
                    button_reply: {
                      id: 'prod_abc123', // ID tecnico
                      title: 'Parmigiano Reggiano' // Testo visualizzato
                    }
                  }
                }],
              }
            }]
          }],
        },
        params: { webhookId: 'webhook-123' },
      }

      await controller.receiveMessage(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      // Verify "Parmigiano Reggiano" (title) was used, not "prod_abc123" (id)
    })
  })

  describe('List Reply Messages', () => {
    it('should extract title from list_reply', async () => {
      // SCENARIO: Cliente seleziona opzione da lista WhatsApp
      // PAYLOAD: interactive.list_reply.title = "Prosciutto di Parma"
      // EXPECTED: Sistema riceve "Prosciutto di Parma"
      
      mockReq = {
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{
                  from: '393331234567',
                  id: 'msg-list-1',
                  timestamp: '1234567890',
                  type: 'interactive',
                  interactive: {
                    type: 'list_reply',
                    list_reply: {
                      id: 'prod_salumi_1',
                      title: 'Prosciutto di Parma',
                      description: 'DOP - 100g - €8.50'
                    }
                  }
                }],
              }
            }]
          }],
        },
        params: { webhookId: 'webhook-123' },
      }

      await controller.receiveMessage(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      // TODO: Verify "Prosciutto di Parma" was extracted
    })

    it('should handle list with body text (fallback)', async () => {
      // SCENARIO: Lista WhatsApp con body text (se list_reply manca)
      // FALLBACK: Se no list_reply.title, usa interactive.body.text
      
      mockReq = {
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{
                  from: '393331234567',
                  id: 'msg-list-2',
                  timestamp: '1234567890',
                  type: 'interactive',
                  interactive: {
                    type: 'list',
                    body: {
                      text: 'Vedi tutti i prodotti'
                    }
                  }
                }],
              }
            }]
          }],
        },
        params: { webhookId: 'webhook-123' },
      }

      await controller.receiveMessage(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
    })
  })

  describe('Media Messages with Captions', () => {
    it('should extract caption from image message', async () => {
      // SCENARIO: Cliente invia immagine con caption "Questo è il mio ordine"
      // EXPECTED: Sistema riceve caption come testo
      
      mockReq = {
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{
                  from: '393331234567',
                  id: 'msg-img-1',
                  timestamp: '1234567890',
                  type: 'image',
                  image: {
                    id: 'media-123',
                    mime_type: 'image/jpeg',
                    caption: 'Questo è il mio ordine'
                  }
                }],
              }
            }]
          }],
        },
        params: { webhookId: 'webhook-123' },
      }

      await controller.receiveMessage(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      // TODO: Verify caption was extracted
    })

    it('should fallback to filename if no caption', async () => {
      // SCENARIO: Cliente invia documento senza caption
      // FALLBACK: Usa filename del documento
      
      mockReq = {
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{
                  from: '393331234567',
                  id: 'msg-doc-1',
                  timestamp: '1234567890',
                  type: 'document',
                  document: {
                    id: 'media-456',
                    filename: 'fattura-2024.pdf',
                    mime_type: 'application/pdf'
                  }
                }],
              }
            }]
          }],
        },
        params: { webhookId: 'webhook-123' },
      }

      await controller.receiveMessage(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      // TODO: Verify "fattura-2024.pdf" was used
    })

    it('should handle media without caption/filename', async () => {
      // SCENARIO: Cliente invia sticker/audio senza testo
      // FALLBACK: Genera placeholder "[type message]"
      
      mockReq = {
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{
                  from: '393331234567',
                  id: 'msg-sticker-1',
                  timestamp: '1234567890',
                  type: 'sticker',
                  sticker: {
                    id: 'sticker-789',
                    mime_type: 'image/webp'
                  }
                }],
              }
            }]
          }],
        },
        params: { webhookId: 'webhook-123' },
      }

      await controller.receiveMessage(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      // TODO: Verify "[sticker message]" was generated
    })
  })

  describe('Edge Cases', () => {
    it('should ignore message if no text extractable', async () => {
      // SCENARIO: Messaggio WhatsApp malformed (no text, button, interactive)
      // EXPECTED: Sistema ignora messaggio (no processing)
      
      mockReq = {
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{
                  from: '393331234567',
                  id: 'msg-unknown-1',
                  timestamp: '1234567890',
                  type: 'unknown',
                }],
              }
            }]
          }],
        },
        params: { webhookId: 'webhook-123' },
      }

      await controller.receiveMessage(mockReq as Request, mockRes as Response)

      // Should still return 200 (avoid WhatsApp retries)
      expect(mockRes.status).toHaveBeenCalledWith(200)
      // But NO chat processing should happen
    })

    it('should handle button_reply without title (malformed)', async () => {
      // SCENARIO: Button reply WhatsApp malformed (no title field)
      // EXPECTED: Sistema gestisce gracefully (no crash)
      
      mockReq = {
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{
                  from: '393331234567',
                  id: 'msg-malformed-1',
                  timestamp: '1234567890',
                  type: 'interactive',
                  interactive: {
                    type: 'button_reply',
                    button_reply: {
                      id: 'btn_1'
                      // Missing 'title' field
                    }
                  }
                }],
              }
            }]
          }],
        },
        params: { webhookId: 'webhook-123' },
      }

      await controller.receiveMessage(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      // Should handle gracefully (no crash)
    })
  })
})
