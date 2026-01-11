/**
 * @file workspace-widget-config.simple.spec.ts
 * @description Simplified tests for widget configuration
 */

import { prisma } from '@echatbot/database'

// Simple integration-style tests that verify schema and data operations
describe('Widget Configuration - Data Layer', () => {
  const testWorkspaceId = 'test-ws-widget-' + Date.now()
  const testWidgetLogoUrl = '/uploads/users/widget-logo_test.png'
  const testChannelLogoUrl = '/uploads/channels/channel-logo_test.png'

  afterAll(async () => {
    // Cleanup
    try {
      await prisma.workspace.deleteMany({
        where: { id: testWorkspaceId },
      })
      await prisma.$disconnect()
    } catch (error) {
      // Ignore cleanup errors in tests
      console.error('Cleanup error:', error)
    }
  })

  describe('Schema - Widget Fields Exist', () => {
    it('should have widgetLogoUrl field in Workspace model', async () => {
      const workspace = await prisma.workspace.create({
        data: {
          id: testWorkspaceId,
          name: 'Widget Test Workspace',
          widgetLogoUrl: testWidgetLogoUrl,
        },
      })

      expect(workspace.widgetLogoUrl).toBe(testWidgetLogoUrl)
    })

    it('should have widgetLogoKey field in Workspace model', async () => {
      const widgetLogoKey = 'widget-logo_test_123.png'
      
      const workspace = await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: { widgetLogoKey },
      })

      expect(workspace.widgetLogoKey).toBe(widgetLogoKey)
    })

    it('should have widgetTitle field in Workspace model', async () => {
      const widgetTitle = 'Customer Support Chat'
      
      const workspace = await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: { widgetTitle },
      })

      expect(workspace.widgetTitle).toBe(widgetTitle)
    })

    it('should have widgetLanguage field with default "it"', async () => {
      const workspace = await prisma.workspace.findUnique({
        where: { id: testWorkspaceId },
        select: { widgetLanguage: true },
      })

      // Should have default value
      expect(workspace?.widgetLanguage).toBe('it')
    })

    it('should have widgetPrimaryColor field with default "#22c55e"', async () => {
      const workspace = await prisma.workspace.findUnique({
        where: { id: testWorkspaceId },
        select: { widgetPrimaryColor: true },
      })

      // Should have default value
      expect(workspace?.widgetPrimaryColor).toBe('#22c55e')
    })
  })

  describe('Logo Separation - Channel vs Widget', () => {
    it('should store logoUrl (channel) and widgetLogoUrl separately', async () => {
      const workspace = await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: {
          logoUrl: testChannelLogoUrl,
          widgetLogoUrl: testWidgetLogoUrl,
        },
      })

      expect(workspace.logoUrl).toBe(testChannelLogoUrl)
      expect(workspace.widgetLogoUrl).toBe(testWidgetLogoUrl)
      expect(workspace.logoUrl).not.toBe(workspace.widgetLogoUrl)
    })

    it('should allow updating widgetLogoUrl without affecting logoUrl', async () => {
      const originalLogoUrl = testChannelLogoUrl
      const newWidgetLogoUrl = '/uploads/users/new-widget-logo.png'

      const workspace = await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: { widgetLogoUrl: newWidgetLogoUrl },
      })

      expect(workspace.widgetLogoUrl).toBe(newWidgetLogoUrl)
      expect(workspace.logoUrl).toBe(originalLogoUrl) // Unchanged
    })

    it('should allow null widgetLogoUrl while logoUrl is set', async () => {
      const workspace = await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: { widgetLogoUrl: null },
      })

      expect(workspace.widgetLogoUrl).toBeNull()
      expect(workspace.logoUrl).toBe(testChannelLogoUrl) // Still set
    })
  })

  describe('Widget Configuration - Update Operations', () => {
    it('should update widgetTitle, widgetLanguage, widgetPrimaryColor together', async () => {
      const widgetConfig = {
        widgetTitle: 'Updated Chat',
        widgetLanguage: 'en',
        widgetPrimaryColor: '#ff5722',
      }

      const workspace = await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: widgetConfig,
      })

      expect(workspace.widgetTitle).toBe('Updated Chat')
      expect(workspace.widgetLanguage).toBe('en')
      expect(workspace.widgetPrimaryColor).toBe('#ff5722')
    })

    it('should persist widget config across reads (simulating page refresh)', async () => {
      // Save config
      await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: {
          widgetTitle: 'Persistent Chat',
          widgetLanguage: 'es',
          widgetPrimaryColor: '#3b82f6',
          widgetLogoUrl: '/uploads/users/persistent-logo.png',
        },
      })

      // Simulate page refresh - fresh read
      const workspace = await prisma.workspace.findUnique({
        where: { id: testWorkspaceId },
        select: {
          widgetTitle: true,
          widgetLanguage: true,
          widgetPrimaryColor: true,
          widgetLogoUrl: true,
        },
      })

      expect(workspace?.widgetTitle).toBe('Persistent Chat')
      expect(workspace?.widgetLanguage).toBe('es')
      expect(workspace?.widgetPrimaryColor).toBe('#3b82f6')
      expect(workspace?.widgetLogoUrl).toBe('/uploads/users/persistent-logo.png')
    })
  })

  describe('Widget Configuration - Null Handling', () => {
    it('should allow null values for optional widget fields', async () => {
      const workspace = await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: {
          widgetTitle: null,
          widgetLogoUrl: null,
          widgetLogoKey: null,
        },
      })

      expect(workspace.widgetTitle).toBeNull()
      expect(workspace.widgetLogoUrl).toBeNull()
      expect(workspace.widgetLogoKey).toBeNull()
    })

    it('should return default values for widgetLanguage and widgetPrimaryColor', async () => {
      // Create fresh workspace without explicit widget config
      const freshWorkspaceId = 'test-ws-fresh-' + Date.now()
      
      const workspace = await prisma.workspace.create({
        data: {
          id: freshWorkspaceId,
          name: 'Fresh Workspace',
        },
      })

      expect(workspace.widgetLanguage).toBe('it')
      expect(workspace.widgetPrimaryColor).toBe('#22c55e')

      // Cleanup
      await prisma.workspace.delete({ where: { id: freshWorkspaceId } })
    })
  })

  describe('Workspace Isolation - Multiple Workspaces', () => {
    it('should store different widget configs for different workspaces', async () => {
      const workspace2Id = 'test-ws-widget-2-' + Date.now()

      // Create second workspace
      const workspace2 = await prisma.workspace.create({
        data: {
          id: workspace2Id,
          name: 'Widget Workspace 2',
          widgetTitle: 'WS2 Chat',
          widgetLogoUrl: '/uploads/users/ws2-logo.png',
          widgetLanguage: 'en',
          widgetPrimaryColor: '#3b82f6',
        },
      })

      // Get first workspace
      const workspace1 = await prisma.workspace.findUnique({
        where: { id: testWorkspaceId },
      })

      // Verify isolation - configs are different
      expect(workspace1?.widgetTitle).not.toBe(workspace2.widgetTitle)
      expect(workspace1?.widgetLogoUrl).not.toBe(workspace2.widgetLogoUrl)

      // Cleanup
      await prisma.workspace.delete({ where: { id: workspace2Id } })
    })
  })
})
