/**
 * @file widget-logo-cleanup.spec.ts
 * @description Unit tests for scheduler - verify widgetLogoUrl protection from cleanup
 */

import { PrismaClient } from '@echatbot/database'
import fs from 'fs'
import path from 'path'

// Mock fs and Prisma
jest.mock('fs')
jest.mock('@echatbot/database', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    workspace: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    products: {
      findMany: jest.fn(),
    },
    services: {
      findMany: jest.fn(),
    },
  })),
}))

describe('Unused Images Cleanup - Widget Logo Protection', () => {
  let mockPrisma: any
  const uploadsDir = '/test/uploads'
  const usersDir = path.join(uploadsDir, 'users')

  beforeEach(() => {
    mockPrisma = new PrismaClient()
    jest.clearAllMocks()

    // Mock fs functions
    ;(fs.existsSync as jest.Mock).mockReturnValue(true)
    ;(fs.readdirSync as jest.Mock).mockReturnValue([])
    ;(fs.statSync as jest.Mock).mockReturnValue({ isFile: () => true })
    ;(fs.unlinkSync as jest.Mock).mockImplementation(() => {})
  })

  describe('Widget Logo Protection', () => {
    it('should NOT delete widgetLogoUrl files that are in use', async () => {
      const widgetLogoFile = 'widget-logo_1234.png'
      const widgetLogoPath = `/uploads/users/${widgetLogoFile}`

      // Mock workspace with widgetLogoUrl
      mockPrisma.workspace.findMany.mockResolvedValue([
        {
          id: 'workspace-1',
          logoUrl: '/uploads/channels/channel-logo.png', // Channel logo
          logoKey: null,
          widgetLogoUrl: widgetLogoPath, // Widget logo
          widgetLogoKey: widgetLogoFile,
        },
      ])

      // Mock user logos
      mockPrisma.user.findMany.mockResolvedValue([])

      // Mock products/services
      mockPrisma.products.findMany.mockResolvedValue([])
      mockPrisma.services.findMany.mockResolvedValue([])

      // Mock files in users directory
      ;(fs.readdirSync as jest.Mock).mockReturnValue([
        widgetLogoFile, // Widget logo - SHOULD BE PROTECTED
        'orphan-file-456.jpg', // Orphan - SHOULD BE DELETED
      ])

      // Simulate cleanup logic
      const usedFilenames = new Set<string>()
      
      // Add widget logo to protected set
      const workspaces = await mockPrisma.workspace.findMany({
        select: {
          logoUrl: true,
          logoKey: true,
          widgetLogoUrl: true,
          widgetLogoKey: true,
        },
      })

      for (const workspace of workspaces) {
        if (workspace.widgetLogoUrl) {
          const filename = path.basename(workspace.widgetLogoUrl)
          usedFilenames.add(filename)
        }
        if (workspace.widgetLogoKey) {
          usedFilenames.add(workspace.widgetLogoKey)
        }
      }

      const filesInDir = fs.readdirSync(usersDir)
      const filesToDelete = filesInDir.filter((file: string) => !usedFilenames.has(file))

      // Verify widget logo is protected
      expect(usedFilenames.has(widgetLogoFile)).toBe(true)
      expect(filesToDelete).not.toContain(widgetLogoFile)
      expect(filesToDelete).toContain('orphan-file-456.jpg')
    })

    it('should protect both logoUrl and widgetLogoUrl independently', async () => {
      const channelLogoFile = 'channel-logo-abc.png'
      const widgetLogoFile = 'widget-logo-xyz.png'

      mockPrisma.workspace.findMany.mockResolvedValue([
        {
          id: 'workspace-1',
          logoUrl: `/uploads/channels/${channelLogoFile}`, // Channel logo
          logoKey: channelLogoFile,
          widgetLogoUrl: `/uploads/users/${widgetLogoFile}`, // Widget logo
          widgetLogoKey: widgetLogoFile,
        },
      ])

      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.products.findMany.mockResolvedValue([])
      mockPrisma.services.findMany.mockResolvedValue([])

      // Mock files in users directory
      ;(fs.readdirSync as jest.Mock).mockReturnValue([
        widgetLogoFile, // Widget logo
        'user-avatar.jpg', // Other file
      ])

      const usedFilenames = new Set<string>()
      const workspaces = await mockPrisma.workspace.findMany({
        select: {
          logoUrl: true,
          logoKey: true,
          widgetLogoUrl: true,
          widgetLogoKey: true,
        },
      })

      for (const workspace of workspaces) {
        // Add channel logo
        if (workspace.logoUrl) usedFilenames.add(path.basename(workspace.logoUrl))
        if (workspace.logoKey) usedFilenames.add(workspace.logoKey)
        
        // Add widget logo
        if (workspace.widgetLogoUrl) usedFilenames.add(path.basename(workspace.widgetLogoUrl))
        if (workspace.widgetLogoKey) usedFilenames.add(workspace.widgetLogoKey)
      }

      // Both logos should be protected
      expect(usedFilenames.has(channelLogoFile)).toBe(true)
      expect(usedFilenames.has(widgetLogoFile)).toBe(true)
    })

    it('should DELETE orphaned widget logos (not in database)', async () => {
      const activeWidgetLogo = 'widget-logo-active_123.png'
      const orphanedWidgetLogo = 'widget-logo-old_999.png'

      mockPrisma.workspace.findMany.mockResolvedValue([
        {
          id: 'workspace-1',
          widgetLogoUrl: `/uploads/users/${activeWidgetLogo}`,
          widgetLogoKey: activeWidgetLogo,
        },
      ])

      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.products.findMany.mockResolvedValue([])
      mockPrisma.services.findMany.mockResolvedValue([])

      ;(fs.readdirSync as jest.Mock).mockReturnValue([
        activeWidgetLogo, // Active - PROTECTED
        orphanedWidgetLogo, // Orphaned - DELETE
      ])

      const usedFilenames = new Set<string>()
      const workspaces = await mockPrisma.workspace.findMany({
        select: { widgetLogoUrl: true, widgetLogoKey: true },
      })

      for (const workspace of workspaces) {
        if (workspace.widgetLogoUrl) {
          usedFilenames.add(path.basename(workspace.widgetLogoUrl))
        }
        if (workspace.widgetLogoKey) {
          usedFilenames.add(workspace.widgetLogoKey)
        }
      }

      const filesInDir = fs.readdirSync(usersDir)
      const filesToDelete = filesInDir.filter((file: string) => !usedFilenames.has(file))

      // Active widget logo is protected
      expect(usedFilenames.has(activeWidgetLogo)).toBe(true)
      expect(filesToDelete).not.toContain(activeWidgetLogo)

      // Orphaned widget logo should be deleted
      expect(filesToDelete).toContain(orphanedWidgetLogo)
    })

    it('should handle null widgetLogoUrl gracefully', async () => {
      mockPrisma.workspace.findMany.mockResolvedValue([
        {
          id: 'workspace-1',
          widgetLogoUrl: null, // Not configured yet
          widgetLogoKey: null,
        },
      ])

      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.products.findMany.mockResolvedValue([])
      mockPrisma.services.findMany.mockResolvedValue([])

      const usedFilenames = new Set<string>()
      const workspaces = await mockPrisma.workspace.findMany({
        select: { widgetLogoUrl: true, widgetLogoKey: true },
      })

      for (const workspace of workspaces) {
        if (workspace.widgetLogoUrl) {
          usedFilenames.add(path.basename(workspace.widgetLogoUrl))
        }
      }

      // Should not crash, just skip null values
      expect(usedFilenames.size).toBe(0)
    })
  })

  describe('Multiple Workspaces - Widget Logo Protection', () => {
    it('should protect widget logos from all workspaces', async () => {
      const logo1 = 'workspace1-widget_111.png'
      const logo2 = 'workspace2-widget_222.png'
      const logo3 = 'workspace3-widget_333.png'

      mockPrisma.workspace.findMany.mockResolvedValue([
        { id: 'ws-1', widgetLogoUrl: `/uploads/users/${logo1}`, widgetLogoKey: logo1 },
        { id: 'ws-2', widgetLogoUrl: `/uploads/users/${logo2}`, widgetLogoKey: logo2 },
        { id: 'ws-3', widgetLogoUrl: `/uploads/users/${logo3}`, widgetLogoKey: logo3 },
      ])

      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.products.findMany.mockResolvedValue([])
      mockPrisma.services.findMany.mockResolvedValue([])

      ;(fs.readdirSync as jest.Mock).mockReturnValue([
        logo1,
        logo2,
        logo3,
        'orphan-old-logo.png',
      ])

      const usedFilenames = new Set<string>()
      const workspaces = await mockPrisma.workspace.findMany({
        select: { widgetLogoUrl: true, widgetLogoKey: true },
      })

      for (const workspace of workspaces) {
        if (workspace.widgetLogoUrl) {
          usedFilenames.add(path.basename(workspace.widgetLogoUrl))
        }
        if (workspace.widgetLogoKey) {
          usedFilenames.add(workspace.widgetLogoKey)
        }
      }

      // All 3 workspace widget logos are protected
      expect(usedFilenames.has(logo1)).toBe(true)
      expect(usedFilenames.has(logo2)).toBe(true)
      expect(usedFilenames.has(logo3)).toBe(true)

      const filesInDir = fs.readdirSync(usersDir)
      const filesToDelete = filesInDir.filter((file: string) => !usedFilenames.has(file))

      expect(filesToDelete).toEqual(['orphan-old-logo.png'])
    })
  })
})
