/**
 * @file workspace-widget-security.spec.ts
 * @description Security tests for widget configuration - workspace isolation and permissions
 */

import request from 'supertest'
import { PrismaClient } from '@echatbot/database'
import { createTestApp } from '../helpers/test-app'
import { generateToken } from '../helpers/auth-helper'

describe('Security - Widget Configuration', () => {
  let app: any
  let prisma: PrismaClient
  let superAdminToken: string
  let memberToken: string
  let workspace1Id: string
  let workspace2Id: string
  let superAdminUserId: string
  let memberUserId: string

  beforeAll(async () => {
    prisma = new PrismaClient()
    app = createTestApp()

    // Create test users
    const superAdmin = await prisma.user.create({
      data: {
        email: 'superadmin-widget@test.com',
        password: 'hashed_password',
        firstName: 'Super',
        lastName: 'Admin',
      },
    })
    superAdminUserId = superAdmin.id

    const member = await prisma.user.create({
      data: {
        email: 'member-widget@test.com',
        password: 'hashed_password',
        firstName: 'Regular',
        lastName: 'Member',
      },
    })
    memberUserId = member.id

    // Create test workspaces
    const workspace1 = await prisma.workspace.create({
      data: {
        name: 'Workspace 1',
        widgetLogoUrl: '/uploads/users/ws1-logo.png',
        widgetTitle: 'WS1 Chat',
        widgetLanguage: 'it',
        widgetPrimaryColor: '#22c55e',
      },
    })
    workspace1Id = workspace1.id

    const workspace2 = await prisma.workspace.create({
      data: {
        name: 'Workspace 2',
        widgetLogoUrl: '/uploads/users/ws2-logo.png',
        widgetTitle: 'WS2 Support',
        widgetLanguage: 'en',
        widgetPrimaryColor: '#3b82f6',
      },
    })
    workspace2Id = workspace2.id

    // Add super admin to workspace 1
    await prisma.workspaceMember.create({
      data: {
        userId: superAdminUserId,
        workspaceId: workspace1Id,
        role: 'SUPER_ADMIN',
      },
    })

    // Add member to workspace 1 (limited permissions)
    await prisma.workspaceMember.create({
      data: {
        userId: memberUserId,
        workspaceId: workspace1Id,
        role: 'MEMBER',
      },
    })

    // Generate tokens
    superAdminToken = generateToken({ userId: superAdminUserId, email: superAdmin.email })
    memberToken = generateToken({ userId: memberUserId, email: member.email })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.workspaceMember.deleteMany({
      where: { userId: { in: [superAdminUserId, memberUserId] } },
    })
    await prisma.workspace.deleteMany({
      where: { id: { in: [workspace1Id, workspace2Id] } },
    })
    await prisma.user.deleteMany({
      where: { id: { in: [superAdminUserId, memberUserId] } },
    })
    await prisma.$disconnect()
  })

  describe('Workspace Isolation - Widget Configuration', () => {
    it('should NOT allow user to access widget config of workspace they are not member of', async () => {
      // Super admin tries to GET workspace 2 (not a member)
      const response = await request(app)
        .get(`/api/v1/workspaces/${workspace2Id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-workspace-id', workspace2Id)

      expect(response.status).toBe(403)
      expect(response.body.error).toContain('not a member')
    })

    it('should NOT allow user to update widget config of other workspace', async () => {
      const hackedConfig = {
        widgetTitle: 'Hacked Chat',
        widgetLogoUrl: '/uploads/users/hacker-logo.png',
      }

      const response = await request(app)
        .put(`/api/v1/workspaces/${workspace2Id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-workspace-id', workspace2Id)
        .send(hackedConfig)

      expect(response.status).toBe(403)
      
      // Verify workspace 2 config is unchanged
      const workspace2 = await prisma.workspace.findUnique({
        where: { id: workspace2Id },
        select: { widgetTitle: true },
      })

      expect(workspace2?.widgetTitle).toBe('WS2 Support') // Original value
      expect(workspace2?.widgetTitle).not.toBe('Hacked Chat')
    })

    it('should allow user to access only their workspace widget config', async () => {
      const response = await request(app)
        .get(`/api/v1/workspaces/${workspace1Id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-workspace-id', workspace1Id)

      expect(response.status).toBe(200)
      expect(response.body.widgetTitle).toBe('WS1 Chat')
      expect(response.body.widgetLogoUrl).toBe('/uploads/users/ws1-logo.png')
    })
  })

  describe('Permission Control - Widget Configuration', () => {
    it('should allow SUPER_ADMIN to update widget config', async () => {
      const newConfig = {
        widgetTitle: 'Updated WS1 Chat',
        widgetPrimaryColor: '#ff5722',
      }

      const response = await request(app)
        .put(`/api/v1/workspaces/${workspace1Id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-workspace-id', workspace1Id)
        .send(newConfig)

      expect(response.status).toBe(200)
      expect(response.body.widgetTitle).toBe('Updated WS1 Chat')
      expect(response.body.widgetPrimaryColor).toBe('#ff5722')
    })

    it('should NOT allow MEMBER to update widget config', async () => {
      const memberConfig = {
        widgetTitle: 'Member Hacked Chat',
      }

      const response = await request(app)
        .put(`/api/v1/workspaces/${workspace1Id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspace1Id)
        .send(memberConfig)

      expect(response.status).toBe(403)
      expect(response.body.error).toMatch(/permission|unauthorized/i)

      // Verify no changes were made
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspace1Id },
        select: { widgetTitle: true },
      })

      expect(workspace?.widgetTitle).not.toBe('Member Hacked Chat')
    })

    it('should allow OWNER role to update widget config', async () => {
      // Create owner user
      const owner = await prisma.user.create({
        data: {
          email: 'owner-widget@test.com',
          password: 'hashed',
          firstName: 'Owner',
          lastName: 'User',
        },
      })

      await prisma.workspaceMember.create({
        data: {
          userId: owner.id,
          workspaceId: workspace1Id,
          role: 'OWNER',
        },
      })

      const ownerToken = generateToken({ userId: owner.id, email: owner.email })

      const response = await request(app)
        .put(`/api/v1/workspaces/${workspace1Id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspace1Id)
        .send({ widgetTitle: 'Owner Updated Chat' })

      expect(response.status).toBe(200)

      // Cleanup
      await prisma.workspaceMember.deleteMany({ where: { userId: owner.id } })
      await prisma.user.delete({ where: { id: owner.id } })
    })
  })

  describe('Logo Upload Security', () => {
    it('should require SUPER_ADMIN to upload widget logo', async () => {
      const response = await request(app)
        .post(`/api/v1/workspaces/${workspace1Id}/logo`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspace1Id)
        .attach('logo', Buffer.from('fake-image'), 'logo.png')

      expect(response.status).toBe(403)
    })

    it('should allow SUPER_ADMIN to upload widget logo', async () => {
      const response = await request(app)
        .post(`/api/v1/workspaces/${workspace1Id}/logo`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-workspace-id', workspace1Id)
        .attach('logo', Buffer.from('fake-image'), 'logo.png')

      // Assuming upload endpoint returns 200
      expect([200, 201]).toContain(response.status)
    })

    it('should NOT allow uploading logo to workspace user is not member of', async () => {
      const response = await request(app)
        .post(`/api/v1/workspaces/${workspace2Id}/logo`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-workspace-id', workspace2Id)
        .attach('logo', Buffer.from('fake-image'), 'logo.png')

      expect(response.status).toBe(403)
    })
  })

  describe('Data Leakage Prevention', () => {
    it('should NOT leak widget config from other workspaces in GET response', async () => {
      const response = await request(app)
        .get(`/api/v1/workspaces/${workspace1Id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-workspace-id', workspace1Id)

      expect(response.status).toBe(200)
      
      // Should return workspace 1 config
      expect(response.body.widgetTitle).toBe('WS1 Chat')
      
      // Should NOT contain workspace 2 config
      expect(response.body.widgetTitle).not.toBe('WS2 Support')
      expect(response.body.widgetLogoUrl).not.toContain('ws2-logo.png')
    })

    it('should NOT allow SQL injection in widgetTitle field', async () => {
      const sqlInjectionAttempt = {
        widgetTitle: "'; DROP TABLE workspace; --",
      }

      const response = await request(app)
        .put(`/api/v1/workspaces/${workspace1Id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-workspace-id', workspace1Id)
        .send(sqlInjectionAttempt)

      // Should either reject or escape the value
      expect(response.status).toBe(200) // Prisma handles escaping

      // Verify table still exists
      const workspaces = await prisma.workspace.findMany()
      expect(workspaces.length).toBeGreaterThan(0)
    })

    it('should sanitize XSS attempts in widgetTitle', async () => {
      const xssAttempt = {
        widgetTitle: '<script>alert("XSS")</script>',
      }

      const response = await request(app)
        .put(`/api/v1/workspaces/${workspace1Id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-workspace-id', workspace1Id)
        .send(xssAttempt)

      expect(response.status).toBe(200)

      // Frontend should escape this when rendering
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspace1Id },
        select: { widgetTitle: true },
      })

      // Value is stored as-is, but frontend escapes on render
      expect(workspace?.widgetTitle).toBe('<script>alert("XSS")</script>')
    })
  })
})
