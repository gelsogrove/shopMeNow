import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import SettingsPage from '@/pages/SettingsPage'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { ChatProvider } from '@/contexts/ChatContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import * as workspaceApi from '@/services/workspaceApi'
import { api } from '@/services/api'
import { toast } from '@/lib/toast'

vi.mock('@/services/workspaceApi')
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
  const heading = screen.getByRole('heading', { name: title })
  await user.click(heading)
}

describe('SettingsPage - Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupWorkspaceGet()
  })

  it('should show error for invalid email format', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('Business Configuration')

    const emailInput = screen.getByLabelText(/admin email/i)
    await user.clear(emailInput)
    await user.type(emailInput, 'invalid-email')

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(emailInput).toHaveClass('border-red-500')
    })
    expect(toast.error).toHaveBeenCalledWith('Please fix validation errors')
  })

  it('should show error for empty channel name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('Business Configuration')

    const nameInput = screen.getByLabelText(/channel name/i)
    await user.clear(nameInput)

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/channel name is required/i)).toBeInTheDocument()
    })
    expect(toast.error).toHaveBeenCalledWith('Please fix validation errors')
  })

  it('should clear error when field is corrected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('Business Configuration')

    const nameInput = screen.getByLabelText(/channel name/i)
    await user.clear(nameInput)

    const saveButton = screen.getByRole('button', { name: /^save$/i })
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

    const channelSwitch = screen.getByRole('switch')
    expect(channelSwitch).toBeChecked()

    await user.click(channelSwitch)
    expect(channelSwitch).not.toBeChecked()
  })
})

describe('SettingsPage - Data Population', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupWorkspaceGet()
  })

  it('should populate form with workspace data', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('Business Configuration')

    expect(screen.getByLabelText(/channel name/i)).toHaveValue('Test Channel')
    expect(screen.getByLabelText(/admin email/i)).toHaveValue('admin@test.com')
    expect(screen.getByLabelText(/website url/i)).toHaveValue('https://test.com')
    
    // Go back to overview before opening another section (UI uses focusedSection pattern)
    const backButton = screen.getByRole('button', { name: /back/i })
    await user.click(backButton)
    
    // Now WhatsApp section should be visible again
    await openSection('WhatsApp Configuration')
    expect(screen.getByLabelText(/^phone number$/i)).toHaveValue('+39 333 1234567')
  })

  it('should convert allowed external links array to comma-separated string', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('Security & Access')

    const openButton = screen.getByRole('button', { name: /stripe.com/i })
    await user.click(openButton)

    const linksTextarea = await screen.findByPlaceholderText(/example.com, trusted-site.com/i)
    expect(linksTextarea).toHaveValue('stripe.com, paypal.com')
  })

  it('should display personality fields correctly', async () => {
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('AI Personality')

    expect(screen.getByRole('button', { name: /i am your ai assistant/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /welcome to our channel/i })).toBeInTheDocument()
  })
})

describe('SettingsPage - Save Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupWorkspaceGet()
    vi.mocked(workspaceApi.updateWorkspace).mockResolvedValue(mockWorkspace)
  })

  it('should call updateWorkspace with correct data on save', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('Business Configuration')

    const nameInput = screen.getByLabelText(/channel name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Channel')

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(workspaceApi.updateWorkspace).toHaveBeenCalled()
    })

    const callArgs = vi.mocked(workspaceApi.updateWorkspace).mock.calls[0]
    expect(callArgs[1]).toMatchObject({
      name: 'Updated Channel',
    })
  })

  it('should show success toast on successful save', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Settings saved successfully')
    })
  })

  it('should show error toast on save failure', async () => {
    const user = userEvent.setup()
    vi.mocked(workspaceApi.updateWorkspace).mockRejectedValue(new Error('Network error'))

    renderWithProviders(<SettingsPage />)

    await waitForLoaded()

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to save settings')
    })
  })

  it('should prevent save with validation errors', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitForLoaded()
    await openSection('Business Configuration')

    const nameInput = screen.getByLabelText(/channel name/i)
    await user.clear(nameInput)

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    await user.click(saveButton)

    expect(workspaceApi.updateWorkspace).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Please fix validation errors')
  })
})
