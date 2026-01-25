import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  workspaceApi: {
    update: vi.fn(),
  },
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
  useWorkspaceRole: () => ({ isSuperAdmin: true }),
}))
vi.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Import mocked updateWorkspace after mock definition
import { updateWorkspace } from '@/services/workspaceApi'
const mockUpdateWorkspace = vi.mocked(updateWorkspace)

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
  sellsProductsAndServices: true,
  hasSalesAgents: false,
  hasHumanSupport: true,
  humanSupportInstructions: 'Contact our team for help',
  frustrationEscalationInstructions: 'Call operator on angry customer',
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
}

const setupWorkspaceGet = () => {
  vi.mocked(api.get).mockResolvedValue({ data: mockWorkspace })
  mockUpdateWorkspace.mockResolvedValue(mockWorkspace)
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
  // Map old section names to new menu items AND their heading titles
  const menuConfig: Record<string, { menuLabel: string, heading: string }> = {
    'Business Configuration': { menuLabel: 'General Settings', heading: 'Business Configuration' },
    'General Settings': { menuLabel: 'General Settings', heading: 'Business Configuration' },
    'Personality & Behavior': { menuLabel: 'AI Configuration', heading: 'AI Personality' },
    'AI Personality': { menuLabel: 'AI Configuration', heading: 'AI Personality' },
    'AI Configuration': { menuLabel: 'AI Configuration', heading: 'AI Personality' },
    'Security & Access': { menuLabel: 'Security & Support', heading: 'Security & Support' },
    'Support & Escalation': { menuLabel: 'Security & Support', heading: 'Security & Support' },
    'Security & Support': { menuLabel: 'Security & Support', heading: 'Security & Support' },
    'WhatsApp Configuration': { menuLabel: 'Channels', heading: 'Channels & Connections' },
    'Channels & Connections': { menuLabel: 'Channels', heading: 'Channels & Connections' },
    'Channels': { menuLabel: 'Channels', heading: 'Channels & Connections' },
  }
  const config = menuConfig[title] || { menuLabel: title, heading: title }
  const button = screen.getByRole('button', { name: new RegExp(config.menuLabel, 'i') })
  await user.click(button)
  // Wait for section heading to render
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: new RegExp(config.heading, 'i') })).toBeInTheDocument()
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
    // Default section is 'channels', Channel Active switch is the first one
    const switches = screen.getAllByRole('switch')
    const channelSwitch = switches[0] // First switch is Channel Active
    expect(channelSwitch).toBeChecked()

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
    expect(screen.getByLabelText(/admin email/i)).toHaveValue('admin@test.com')
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
  })

  it.skip('should show success toast on successful save', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    // Default section is Channels, Save button is visible
    const saveButton = await screen.findByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    // Wait for update to complete and toast to be called
    await waitFor(() => {
      expect(mockUpdateWorkspace).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('Settings saved successfully')
    }, { timeout: 10000 })
  })

  it.skip('should show error toast on save failure', async () => {
    const user = userEvent.setup()
    mockUpdateWorkspace.mockRejectedValue(new Error('Network error'))

    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    // Default section is Channels
    const saveButton = await screen.findByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    // Wait for update to fail and error toast to be called
    await waitFor(() => {
      expect(mockUpdateWorkspace).toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalled()
    }, { timeout: 10000 })
  })

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
