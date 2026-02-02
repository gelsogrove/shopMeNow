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

  it('🔴 MUST contain Embed Code section in WebsiteWidgetSection.tsx', () => {
    // CRITICAL: This test verifies the source code contains the embed code section
    // Reading the actual WebsiteWidgetSection.tsx file to ensure code is not deleted
    
    const fs = require('fs')
    const path = require('path')
    const widgetSectionPath = path.resolve(__dirname, '../../src/components/settings/sections/WebsiteWidgetSection.tsx')
    const widgetSectionContent = fs.readFileSync(widgetSectionPath, 'utf-8')

    // ✅ MUST contain "Embed Code" label
    expect(widgetSectionContent).toContain('Embed Code')
    
    // ✅ MUST contain window.eChatbotConfig
    expect(widgetSectionContent).toContain('window.eChatbotConfig')
    
    // ✅ MUST contain workspaceId configuration
    expect(widgetSectionContent).toContain('workspaceId:')
    
    // ✅ MUST contain widget.js script tag
    expect(widgetSectionContent).toContain('widget.js')
    
    // ✅ MUST contain Copy button for embed code
    expect(widgetSectionContent).toContain('Copy')
    expect(widgetSectionContent).toContain('navigator.clipboard.writeText')
    
    // ✅ MUST include all widget configuration parameters
    expect(widgetSectionContent).toContain('title:')
    expect(widgetSectionContent).toContain('primaryColor:')
    expect(widgetSectionContent).toContain('icon:')
    expect(widgetSectionContent).toContain('language:')
    expect(widgetSectionContent).toContain('useChannelLogo')
    expect(widgetSectionContent).toContain('logoUrl')
  })

  it('🔴 MUST generate complete widget embed code', () => {
    // CRITICAL: Verify the embed code structure is correct
    
    const fs = require('fs')
    const path = require('path')
    const widgetSectionPath = path.resolve(__dirname, '../../src/components/settings/sections/WebsiteWidgetSection.tsx')
    const widgetSectionContent = fs.readFileSync(widgetSectionPath, 'utf-8')

    // ✅ MUST have script tags
    expect(widgetSectionContent).toContain('<script>')
    expect(widgetSectionContent).toContain('</script>')
    
    // ✅ MUST have async attribute on widget.js
    expect(widgetSectionContent).toContain('async')
    
    // ✅ MUST use workspaceId prop
    expect(widgetSectionContent).toContain('workspaceId')
  })

  it('🔴 MUST use formData for widget configuration', () => {
    // CRITICAL: Verify widget config comes from formData props
    
    const fs = require('fs')
    const path = require('path')
    const widgetSectionPath = path.resolve(__dirname, '../../src/components/settings/sections/WebsiteWidgetSection.tsx')
    const widgetSectionContent = fs.readFileSync(widgetSectionPath, 'utf-8')

    // ✅ MUST use formData.widgetTitle
    expect(widgetSectionContent).toContain('formData.widgetTitle')
    
    // ✅ MUST use formData.widgetPrimaryColor
    expect(widgetSectionContent).toContain('formData.widgetPrimaryColor')
    
    // ✅ MUST use formData.widgetIcon
    expect(widgetSectionContent).toContain('formData.widgetIcon')
    
    // ✅ MUST use formData.widgetLanguage
    expect(widgetSectionContent).toContain('formData.widgetLanguage')
    
    // ✅ MUST use formData.widgetUseChannelLogo
    expect(widgetSectionContent).toContain('formData.widgetUseChannelLogo')
  })

  it('🔴 MUST have fallback values for widget config', () => {
    // CRITICAL: Embed code must have sensible defaults
    
    const fs = require('fs')
    const path = require('path')
    const widgetSectionPath = path.resolve(__dirname, '../../src/components/settings/sections/WebsiteWidgetSection.tsx')
    const widgetSectionContent = fs.readFileSync(widgetSectionPath, 'utf-8')

    // ✅ MUST have fallback for title
    expect(widgetSectionContent).toContain('"Chat with us"')
    
    // ✅ MUST have fallback for primaryColor
    expect(widgetSectionContent).toContain('"#22c55e"')
    
    // ✅ MUST have fallback for icon
    expect(widgetSectionContent).toContain('"chat"')
    
    // ✅ MUST have fallback for language
    expect(widgetSectionContent).toContain('"it"')
  })
})
