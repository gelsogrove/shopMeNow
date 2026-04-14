import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import SettingsPage from '@/pages/SettingsPage'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { ChatProvider } from '@/contexts/ChatContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { api } from '@/services/api'
import { toast } from '@/lib/toast'

// Mock updateWorkspace function - must use vi.fn() directly, not a variable
vi.mock('@/services/workspaceApi', () => ({
  updateWorkspace: vi.fn(),
  getWorkspaceById: vi.fn(),
  deleteWorkspace: vi.fn(),
  workspaceApi: {
    update: vi.fn(),
  },
}))

vi.mock('@/services/agent-config-api', () => ({
  resetAgentPromptsToDefaults: vi.fn(),
}))

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))
vi.mock('@/lib/toast')
vi.mock('@/hooks/useWorkspaceRole', () => ({
  useWorkspaceRole: () => ({ isSuperAdmin: true, isOwner: true }),
}))
vi.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Import mocked functions after mock definition
import { updateWorkspace, getWorkspaceById } from '@/services/workspaceApi'
const mockUpdateWorkspace = vi.mocked(updateWorkspace)
const mockGetWorkspaceById = vi.mocked(getWorkspaceById)

const mockWorkspace = {
  id: 'test-workspace-1',
  name: 'Test Channel',
  whatsappPhoneNumber: '+39 333 1234567',
  whatsappApiKey: 'whatsapp-api-key',
  whatsappPhoneNumberId: '1234567890',
  whatsappVerifyToken: 'verify-token',
  adminEmail: 'admin@test.com',
  url: 'https://test.com',
  channelStatus: true,
  debugMode: false,
  welcomeMessage: 'Welcome to our channel!',
  wipMessage: 'We are under maintenance',
  allowedExternalLinks: ['stripe.com', 'paypal.com'],
  enableWhatsapp: true,
  enableWidget: false,
  channelMode: 'ECOMMERCE' as any,
  hasSalesAgents: false,
  hasHumanSupport: true,
  humanSupportInstructions: 'Contact our team for help',
  operatorContactMethod: 'email',
  operatorWhatsappNumber: '',
  toneOfVoice: 'friendly',
  botIdentityResponse: 'I am your AI assistant',
  address: 'Via Roma 123, Roma',
  customAiRules: '',
  translateProductNames: false,
  translateCategoryNames: false,
  translateServiceNames: true,
  catalogBaseLanguage: 'it',
  notificationEmail: 'notify@test.com',
  widgetTitle: 'Chat with us',
  widgetLanguage: 'en',
  widgetPrimaryColor: '#22c55e',
  chatbotName: 'Sofia',
  businessType: 'retail',
  currency: 'USD',
  defaultLanguage: 'it',
  widgetIcon: 'chat',
  widgetUseChannelLogo: false,
  registrationPage: '',
  requireManualApproval: false,
  isActive: true,
  isDelete: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const setupWorkspaceGet = () => {
  vi.mocked(api.get).mockResolvedValue({ data: mockWorkspace })
  mockUpdateWorkspace.mockResolvedValue(mockWorkspace)
  mockGetWorkspaceById.mockResolvedValue(mockWorkspace)
}

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageProvider>
          <ChatProvider>
            <WorkspaceProvider initialWorkspace={mockWorkspace}>
              {component}
            </WorkspaceProvider>
          </ChatProvider>
        </LanguageProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

const waitForLoaded = async () => {
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })
}

const openSection = async (title: string) => {
  const user = userEvent.setup()
  // Map old section names to new dropdown menu items
  const menuConfig: Record<string, { menuLabel: string, heading: string }> = {
    'Business Configuration': { menuLabel: 'Business Config', heading: 'Business Configuration' },
    'General Settings': { menuLabel: 'Business Config', heading: 'Business Configuration' },
    'Personality & Behavior': { menuLabel: 'AI Personality', heading: 'AI Personality' },
    'AI Personality': { menuLabel: 'AI Personality', heading: 'AI Personality' },
    'AI Configuration': { menuLabel: 'AI Personality', heading: 'AI Personality' },
    'Security & Access': { menuLabel: 'Security', heading: 'Security' },
    'Support & Escalation': { menuLabel: 'Human Support', heading: 'Human Support' },
    'Security & Support': { menuLabel: 'Security', heading: 'Security' },
    'WhatsApp Configuration': { menuLabel: 'WhatsApp Channel', heading: 'WhatsApp Channel' },
    'Channels & Connections': { menuLabel: 'WhatsApp Channel', heading: 'WhatsApp Channel' },
    'Channels': { menuLabel: 'WhatsApp Channel', heading: 'WhatsApp Channel' },
  }
  const config = menuConfig[title] || { menuLabel: title, heading: title }

  // Find the dropdown button (Button with ChevronDown)
  // It should contain the current section label (e.g., "Business Config")
  const buttons = screen.getAllByRole('button')
  const dropdownButton = buttons.find(btn => {
    const hasChevron = btn.querySelector('svg.lucide-chevron-down')
    return hasChevron
  })

  if (!dropdownButton) {
    throw new Error('Could not find settings dropdown button')
  }

  // If the section is already active, no need to click
  if (dropdownButton.textContent?.includes(config.menuLabel)) {
    // Already on this section, just wait for heading
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: new RegExp(config.heading, 'i') })).toBeInTheDocument()
    })
    return
  }

  // Click dropdown to open menu
  await user.click(dropdownButton)

  // Wait for menu to open and find the menu item
  await waitFor(() => {
    const menuItems = screen.getAllByText(config.menuLabel)
    const menuItem = menuItems.find(el => el.className.includes('font-medium'))
    expect(menuItem).toBeInTheDocument()
  })

  // Click the menu item (the one with font-medium class, not the button)
  const menuItems = screen.getAllByText(config.menuLabel)
  const menuItem = menuItems.find(el => el.className.includes('font-medium'))
  await user.click(menuItem!)

  // Wait for section heading to render
  await waitFor(() => {
    const heading = screen.getAllByRole('heading', { name: new RegExp(config.heading, 'i') })[0]
    expect(heading).toBeInTheDocument()
  })
}

describe('SettingsPage - Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupWorkspaceGet()
    mockUpdateWorkspace.mockClear()
  })

  it('should show error for empty channel name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('Business Configuration')

    // Wait for the section to render
    await waitFor(() => {
      expect(screen.getByLabelText(/channel name/i)).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/channel name/i)
    await user.clear(nameInput)

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/channel name is required/i)).toBeInTheDocument()
    })
    expect(toast.error).toHaveBeenCalledWith('Please fix the errors before saving')
  })

  it('should show error border for empty channel name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('Business Configuration')

    await waitFor(() => {
      expect(screen.getByLabelText(/channel name/i)).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/channel name/i)
    await user.clear(nameInput)

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(nameInput).toHaveClass('border-red-500')
    })
  })

  it('should clear error when field is corrected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('Business Configuration')

    const nameInput = screen.getByLabelText(/channel name/i)
    await user.clear(nameInput)

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/channel name is required/i)).toBeInTheDocument()
    })

    await user.type(nameInput, 'New Channel Name')

    await waitFor(() => {
      expect(screen.queryByText(/channel name is required/i)).not.toBeInTheDocument()
    })
  })
})

describe('SettingsPage - Toggle Behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupWorkspaceGet()
  })

  it('should toggle channel active status', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()

    // Find the channel status indicator by looking for the specific status span and its parent
    // Use more specific query to avoid matching help text containing "Inactive"
    const channelStatusElements = screen.getAllByText(/^(Active|Inactive)$/i)
    // Find the actual status label (not the help text)
    const statusLabel = channelStatusElements.find(el => 
      el.tagName === 'SPAN' && el.className.includes('font-medium')
    )
    expect(statusLabel).toBeInTheDocument()
    
    const channelStatusContainer = statusLabel!.closest('div')
    expect(channelStatusContainer).toBeInTheDocument()

    const channelSwitch = within(channelStatusContainer!).getByRole('switch')
    expect(channelSwitch).toBeChecked() // Default is true

    await user.click(channelSwitch)
    await waitFor(() => {
      expect(channelSwitch).not.toBeChecked()
    })
  })
})

describe('SettingsPage - Data Population', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupWorkspaceGet()
  })

  it('should populate form with workspace data', async () => {
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('General Settings')

    await waitFor(() => {
      expect(screen.getByLabelText(/channel name/i)).toHaveValue('Test Channel')
    })
    expect(screen.getByLabelText(/business email/i)).toHaveValue('admin@test.com')
  })

  it('should convert allowed external links array to comma-separated string', async () => {
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('Security & Support')

    const linksTextarea = await screen.findByPlaceholderText(/example.com, trusted-site.com/i)
    expect(linksTextarea).toHaveValue('stripe.com, paypal.com')
  })

  it('should display personality fields correctly', async () => {
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('AI Configuration')

    // Check for tone of voice section
    await waitFor(() => {
      expect(screen.getByText(/tone of voice/i)).toBeInTheDocument()
    })
  })
})

describe('SettingsPage - Save Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupWorkspaceGet()
    mockUpdateWorkspace.mockResolvedValue(mockWorkspace)
  })

  it('should call updateWorkspace with correct data on save', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('General Settings')

    const nameInput = await screen.findByLabelText(/channel name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Channel')

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateWorkspace).toHaveBeenCalled()
    })

    const callArgs = mockUpdateWorkspace.mock.calls[0]
    expect(callArgs[1]).toMatchObject({
      name: 'Updated Channel',
    })
  }, 15000)

  it('should prevent save with validation errors', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('General Settings')

    const nameInput = await screen.findByLabelText(/channel name/i)
    await user.clear(nameInput)

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please fix the errors before saving')
    })

    expect(mockUpdateWorkspace).not.toHaveBeenCalled()
  })
})
