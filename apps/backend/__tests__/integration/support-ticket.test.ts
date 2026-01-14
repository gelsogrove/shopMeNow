/**
 * Support Ticket Controller Integration Tests
 * Tests API endpoints with real database
 */

import request from 'supertest'
import { app } from '../../../src/app'
import { prisma } from '@echatbot/database'
import { generateToken } from '../../../src/utils/jwt'

describe('Support Ticket API Integration Tests', () => {
  let authToken: string
  let userId: string
  let workspaceId: string
  let ticketId: string
  let adminToken: string
  let adminUserId: string

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'support-test@test.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        isPlatformAdmin: false,
      },
    })
    userId = user.id
    authToken = generateToken({
      userId: user.id,
      email: user.email,
      isPlatformAdmin: false,
    })

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: 'hashedpassword',
        firstName: 'Admin',
        lastName: 'User',
        isPlatformAdmin: true,
      },
    })
    adminUserId = admin.id
    adminToken = generateToken({
      userId: admin.id,
      email: admin.email,
      isPlatformAdmin: true,
    })

    // Create workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Test Workspace',
        ownerId: userId,
        whatsappNumber: '+1234567890',
      },
    })
    workspaceId = workspace.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.supportAttachment.deleteMany({})
    await prisma.supportMessage.deleteMany({})
    await prisma.supportTicket.deleteMany({})
    await prisma.workspace.deleteMany({ where: { id: workspaceId } })
    await prisma.user.deleteMany({
      where: { id: { in: [userId, adminUserId] } },
    })
    await prisma.$disconnect()
  })

  describe('POST /api/support/tickets', () => {
    it('should create a support ticket', async () => {
      const response = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workspaceId,
          issueType: 'TECHNICAL',
          subject: 'Test Ticket',
          message: '<p>This is a test ticket</p>',
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data).toHaveProperty('ticketCode')
      expect(response.body.data.subject).toBe('Test Ticket')
      expect(response.body.data.status).toBe('PENDING')

      ticketId = response.body.data.id
    })

    it('should create ticket without workspaceId', async () => {
      const response = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          issueType: 'ACCOUNT_ISSUE',
          subject: 'Account Issue',
          message: '<p>I need help with my account</p>',
        })

      expect(response.status).toBe(201)
      expect(response.body.data.workspaceId).toBeNull()
    })

    it('should reject without authentication', async () => {
      const response = await request(app).post('/api/support/tickets').send({
        issueType: 'TECHNICAL',
        subject: 'Test',
        message: 'Test',
      })

      expect(response.status).toBe(401)
    })

    it('should reject with invalid issue type', async () => {
      const response = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          issueType: 'INVALID_TYPE',
          subject: 'Test',
          message: 'Test',
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid issue type')
    })
  })

  describe('GET /api/support/tickets', () => {
    it('should get user tickets', async () => {
      const response = await request(app)
        .get('/api/support/tickets')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.tickets).toBeInstanceOf(Array)
      expect(response.body.data.tickets.length).toBeGreaterThan(0)
      expect(response.body.data).toHaveProperty('totalPages')
    })

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/support/tickets?status=PENDING')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      response.body.data.tickets.forEach((ticket: any) => {
        expect(ticket.status).toBe('PENDING')
      })
    })
  })

  describe('GET /api/support/tickets/:id', () => {
    it('should get ticket by ID', async () => {
      const response = await request(app)
        .get(`/api/support/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(ticketId)
      expect(response.body.data.messages).toBeInstanceOf(Array)
    })

    it('should reject unauthorized access', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@test.com',
          password: 'hashedpassword',
        },
      })
      const otherToken = generateToken({
        userId: otherUser.id,
        email: otherUser.email,
        isPlatformAdmin: false,
      })

      const response = await request(app)
        .get(`/api/support/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${otherToken}`)

      expect(response.status).toBe(403)

      // Cleanup
      await prisma.user.delete({ where: { id: otherUser.id } })
    })
  })

  describe('POST /api/support/tickets/:id/messages', () => {
    it('should add message to ticket', async () => {
      const response = await request(app)
        .post(`/api/support/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: '<p>This is a reply</p>',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data.content).toBe('<p>This is a reply</p>')
    })
  })

  describe('PATCH /api/support/tickets/:id/status', () => {
    it('should update ticket status (admin only)', async () => {
      const response = await request(app)
        .patch(`/api/support/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'IN_PROGRESS',
        })

      expect(response.status).toBe(200)
      expect(response.body.data.status).toBe('IN_PROGRESS')
    })

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .patch(`/api/support/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'CLOSED',
        })

      expect(response.status).toBe(403)
    })
  })

  describe('GET /api/support/unread-count', () => {
    it('should get unread count for user', async () => {
      const response = await request(app)
        .get('/api/support/unread-count')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(typeof response.body.data.count).toBe('number')
    })
  })

  describe('GET /api/support/admin/tickets', () => {
    it('should get all tickets (admin only)', async () => {
      const response = await request(app)
        .get('/api/support/admin/tickets')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data.tickets).toBeInstanceOf(Array)
    })

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .get('/api/support/admin/tickets')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(403)
    })
  })

  describe('hasUnreadMessages field', () => {
    it('should include hasUnreadMessages in ticket list', async () => {
      // Admin replies to create unread message for customer
      await request(app)
        .post(`/api/support/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          message: '<p>Admin reply</p>',
        })

      // Customer checks tickets
      const response = await request(app)
        .get('/api/support/tickets')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      const ticket = response.body.data.tickets.find((t: any) => t.id === ticketId)
      expect(ticket).toHaveProperty('hasUnreadMessages')
      expect(ticket.hasUnreadMessages).toBe(true) // Should have unread ADMIN message
    })
  })
})
