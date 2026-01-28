/**
 * CRITICAL TEST: Widget Embed Code Must Always Be Present
 * 
 * Andrea's requirement: "mettimi un test che non scompaia mai più!!"
 * 
 * This test ensures the widget embed code generation is ALWAYS present in Settings page.
 * If this test fails, it means someone deleted critical widget functionality.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsPage } from '../../src/pages/SettingsPage'
import { WorkspaceProvider } from '../../src/contexts/WorkspaceContext'

// Mock dependencies
vi.mock('../../src/services/workspaceApi', () => ({
  getWorkspace: vi.fn().mockResolvedValue({
    id: 'test-workspace-123',
    name: 'Test Workspace',
    widgetTitle: 'Chat with us',
    widgetPrimaryColor: '#22c55e',
    widgetIcon: 'chat',
    widgetLanguage: 'it',
    sellsProductsAndServices: false,
    hasHumanSupport: true,
  }),
  updateWorkspace: vi.fn().mockResolvedValue({}),
}))

vi.mock('../../src/services/faqApi', () => ({
  getFAQs: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../src/hooks/useWorkspaceRole', () => ({
  useWorkspaceRole: () => ({
    isSuperAdmin: true,
    isLoading: false,
    role: 'SUPER_ADMIN',
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ workspaceId: 'test-workspace-123' }),
  }
})

const mockWorkspace = {
  id: 'test-workspace-123',
  name: 'Test Workspace',
  alias: 'test-channel',
  channelType: 'WIDGET' as const,
  widgetTitle: 'Chat with us',
  widgetPrimaryColor: '#22c55e',
  widgetIcon: 'chat',
  widgetLanguage: 'it',
  sellsProductsAndServices: false,
  hasHumanSupport: true,
  activeChatbot: true,
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const SettingsPageWrapper = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <WorkspaceProvider value={{ workspace: mockWorkspace, setWorkspace: vi.fn() }}>
        <SettingsPage />
      </WorkspaceProvider>
    </BrowserRouter>
  </QueryClientProvider>
)

/**
 * CRITICAL TEST: Widget Embed Code Must Always Be Present
 * 
 * Andrea's requirement: "mettimi un test che non scompaia mai più!!"
 * 
 * This test ensures the widget embed code generation is ALWAYS present in Settings page.
 * If this test fails, it means someone deleted critical widget functionality.
 */

describe('🚨 CRITICAL: Widget Embed Code Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('🔴 MUST contain Embed Code section in SettingsPage.tsx', () => {
    // CRITICAL: This test verifies the source code contains the embed code section
    // Reading the actual SettingsPage.tsx file to ensure code is not deleted
    
    const fs = require('fs')
    const path = require('path')
    const settingsPagePath = path.resolve(__dirname, '../../src/pages/SettingsPage.tsx')
    const settingsPageContent = fs.readFileSync(settingsPagePath, 'utf-8')

    // ✅ MUST contain "Embed Code" label
    expect(settingsPageContent).toContain('Embed Code')
    
    // ✅ MUST contain window.eChatbotConfig
    expect(settingsPageContent).toContain('window.eChatbotConfig')
    
    // ✅ MUST contain workspaceId configuration
    expect(settingsPageContent).toContain('workspaceId:')
    
    // ✅ MUST contain widget.js script tag
    expect(settingsPageContent).toContain('widget.js')
    
    // ✅ MUST contain Copy button for embed code
    expect(settingsPageContent).toContain('Copy')
    expect(settingsPageContent).toContain('navigator.clipboard.writeText')
    
    // ✅ MUST include all widget configuration parameters
    expect(settingsPageContent).toContain('title:')
    expect(settingsPageContent).toContain('primaryColor:')
    expect(settingsPageContent).toContain('icon:')
    expect(settingsPageContent).toContain('language:')
  })

  it('🔴 MUST generate complete widget embed code', () => {
    // CRITICAL: Verify the embed code structure is correct
    
    const fs = require('fs')
    const path = require('path')
    const settingsPagePath = path.resolve(__dirname, '../../src/pages/SettingsPage.tsx')
    const settingsPageContent = fs.readFileSync(settingsPagePath, 'utf-8')

    // ✅ MUST have script tags
    expect(settingsPageContent).toContain('<script>')
    expect(settingsPageContent).toContain('</script>')
    
    // ✅ MUST have async attribute on widget.js
    expect(settingsPageContent).toContain('async')
    
    // ✅ MUST use currentWorkspace?.id for workspaceId
    expect(settingsPageContent).toContain('currentWorkspace?.id')
  })

  it('🔴 MUST use formData for widget configuration', () => {
    // CRITICAL: Verify widget config comes from formData state
    
    const fs = require('fs')
    const path = require('path')
    const settingsPagePath = path.resolve(__dirname, '../../src/pages/SettingsPage.tsx')
    const settingsPageContent = fs.readFileSync(settingsPagePath, 'utf-8')

    // ✅ MUST use formData.widgetTitle
    expect(settingsPageContent).toContain('formData.widgetTitle')
    
    // ✅ MUST use formData.widgetPrimaryColor
    expect(settingsPageContent).toContain('formData.widgetPrimaryColor')
    
    // ✅ MUST use formData.widgetIcon
    expect(settingsPageContent).toContain('formData.widgetIcon')
    
    // ✅ MUST use formData.widgetLanguage
    expect(settingsPageContent).toContain('formData.widgetLanguage')
  })

  it('🔴 MUST have fallback values for widget config', () => {
    // CRITICAL: Embed code must have sensible defaults
    
    const fs = require('fs')
    const path = require('path')
    const settingsPagePath = path.resolve(__dirname, '../../src/pages/SettingsPage.tsx')
    const settingsPageContent = fs.readFileSync(settingsPagePath, 'utf-8')

    // ✅ MUST have fallback for title
    expect(settingsPageContent).toContain("'Chat with us'")
    
    // ✅ MUST have fallback for primaryColor
    expect(settingsPageContent).toContain("'#22c55e'")
    
    // ✅ MUST have fallback for icon
    expect(settingsPageContent).toContain("'chat'")
    
    // ✅ MUST have fallback for language
    expect(settingsPageContent).toContain("'it'")
  })
})
