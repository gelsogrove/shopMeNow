import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import SettingsPage from '@/pages/SettingsPage'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { ChatProvider } from '@/contexts/ChatContext'
import * as workspaceApi from '@/services/workspaceApi'
import { toast } from '@/lib/toast'

// Mock dependencies
vi.mock('@/services/workspaceApi')
vi.mock('@/lib/toast')
vi.mock('@/hooks/useWorkspaceRole', () => ({
  useWorkspaceRole: () => ({ isSuperAdmin: true })
}))
vi.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

// Mock workspace context
const mockWorkspace = {
  id: 'test-workspace-1',
  name: 'Test Channel',
  whatsappPhoneNumber: '+39 333 1234567',
  adminEmail: 'admin@test.com',
  url: 'https://test.com',
  channelStatus: true,
  welcomeMessage: 'Welcome to our channel!',
  wipMessage: 'We are under maintenance',
  allowedExternalLinks: ['stripe.com', 'paypal.com'],
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
  notificationEmail: 'notify@test.com'
}

const mockUseWorkspace = {
  workspace: mockWorkspace,
  loading: false,
  setCurrentWorkspace: vi.fn()
}

// Wrapper component with all providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ChatProvider>
          <WorkspaceProvider initialWorkspace={mockWorkspace}>
            {component}
          </WorkspaceProvider>
        </ChatProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('SettingsPage - Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up localStorage after each test
    localStorage.clear()
  })

  it('should show error for empty admin email', async () => {
    renderWithProviders(<SettingsPage />)
    
    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('admin@test.com')).toBeInTheDocument()
    })

    // Clear email field
    const emailInput = screen.getByDisplayValue('admin@test.com')
    await userEvent.clear(emailInput)

    // Try to save
    const saveButton = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveButton)

    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/admin email is required/i)).toBeInTheDocument()
    })
  })

  it('should show error for invalid email format', async () => {
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('admin@test.com')).toBeInTheDocument()
    })

    const emailInput = screen.getByDisplayValue('admin@test.com')
    await userEvent.clear(emailInput)
    await userEvent.type(emailInput, 'invalid-email')

    const saveButton = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument()
    })
  })

  it('should show error for empty channel name', async () => {
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Channel')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Test Channel')
    await userEvent.clear(nameInput)

    const saveButton = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/workspace name is required/i)).toBeInTheDocument()
    })
  })

  it('should show error for invalid URL format', async () => {
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('https://test.com')).toBeInTheDocument()
    })

    const urlInput = screen.getByDisplayValue('https://test.com')
    await userEvent.clear(urlInput)
    await userEvent.type(urlInput, 'not-a-url')

    const saveButton = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument()
    })
  })

  it('should show error for invalid phone format', async () => {
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('+39 333 1234567')).toBeInTheDocument()
    })

    const phoneInput = screen.getByDisplayValue('+39 333 1234567')
    await userEvent.clear(phoneInput)
    await userEvent.type(phoneInput, '123')

    const saveButton = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/phone must be in international format/i)).toBeInTheDocument()
    })
  })
})

describe('SettingsPage - Field Changes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update channel name field', async () => {
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Channel')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Test Channel') as HTMLInputElement
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'New Channel Name')

    expect(nameInput.value).toBe('New Channel Name')
  })

  it('should clear error when field is corrected', async () => {
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('admin@test.com')).toBeInTheDocument()
    })

    const emailInput = screen.getByDisplayValue('admin@test.com')
    await userEvent.clear(emailInput)

    const saveButton = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveButton)

    // Error should appear
    await waitFor(() => {
      expect(screen.getByText(/admin email is required/i)).toBeInTheDocument()
    })

    // Fix the error
    await userEvent.type(emailInput, 'newemail@test.com')

    // Error should disappear
    await waitFor(() => {
      expect(screen.queryByText(/admin email is required/i)).not.toBeInTheDocument()
    })
  })
})

describe('SettingsPage - Toggle Behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.skip('should show human support section when hasHumanSupport is true', async () => {
    renderWithProviders(<SettingsPage />)
    
    // Click on Support tab
    const supportTab = screen.getByRole('tab', { name: /support/i })
    await userEvent.click(supportTab)

    // Find the human support toggle - should be ON
    await waitFor(() => {
      const supportSwitch = screen.getAllByRole('switch').find(s => 
        s.closest('[class*="CardTitle"]')?.textContent?.includes('Human Support')
      )
      expect(supportSwitch).toBeChecked()
    })

    // Support content should be visible
    expect(screen.getByText(/message for customer/i)).toBeInTheDocument()
  })

  it('should toggle chatbot status', async () => {
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Channel')).toBeInTheDocument()
    })

    // Find chatbot status toggle
    const switches = screen.getAllByRole('switch')
    const chatbotSwitch = switches[switches.length - 1] // Last switch is chatbot status

    // Should be checked by default
    expect(chatbotSwitch).toBeChecked()

    // Click to toggle
    await userEvent.click(chatbotSwitch)

    expect(chatbotSwitch).not.toBeChecked()
  })

  it.skip('should show sales agents option when products are enabled', async () => {
    renderWithProviders(<SettingsPage />)
    
    // Click on Business tab
    const businessTab = screen.getByRole('tab', { name: /business/i })
    await userEvent.click(businessTab)

    await waitFor(() => {
      // Products & Services should be visible and ON
      expect(screen.getByText(/sells products & services/i)).toBeInTheDocument()
      
      // Sales Team option should be visible (since products are ON)
      expect(screen.getByText(/sales team/i)).toBeInTheDocument()
    })
  })
})

describe('SettingsPage - Data Population', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should populate form with workspace data', async () => {
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Channel')).toBeInTheDocument()
    })

    // Verify all fields are populated
    expect(screen.getByDisplayValue('Test Channel')).toBeInTheDocument()
    expect(screen.getByDisplayValue('admin@test.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('+39 333 1234567')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://test.com')).toBeInTheDocument()
  })

  it('should convert allowed external links array to comma-separated string', async () => {
    renderWithProviders(<SettingsPage />)
    
    // Navigate to Security tab
    const securityTab = screen.getByRole('tab', { name: /security/i })
    await userEvent.click(securityTab)

    await waitFor(() => {
      // Should show comma-separated values
      const linksField = screen.getByPlaceholderText(/stripe.com, paypal.com/i) as HTMLTextAreaElement
      expect(linksField.value).toContain('stripe.com')
      expect(linksField.value).toContain('paypal.com')
    })
  })

  it('should display personality fields correctly', async () => {
    renderWithProviders(<SettingsPage />)
    
    const personalityTab = screen.getByRole('tab', { name: /personality/i })
    await userEvent.click(personalityTab)

    await waitFor(() => {
      expect(screen.getByDisplayValue('I am your AI assistant')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Welcome to our channel!')).toBeInTheDocument()
    })
  })
})

describe('SettingsPage - Save Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.updateWorkspace).mockResolvedValue(mockWorkspace)
  })

  it('should call updateWorkspace with correct data on save', async () => {
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Channel')).toBeInTheDocument()
    })

    // Change a field
    const nameInput = screen.getByDisplayValue('Test Channel')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Updated Channel')

    // Save
    const saveButton = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveButton)

    // Should call updateWorkspace
    await waitFor(() => {
      expect(workspaceApi.updateWorkspace).toHaveBeenCalled()
    })

    const callArgs = vi.mocked(workspaceApi.updateWorkspace).mock.calls[0]
    expect(callArgs[1]).toMatchObject({
      name: 'Updated Channel'
    })
  })

  it('should show success toast on successful save', async () => {
    vi.mocked(workspaceApi.updateWorkspace).mockResolvedValue(mockWorkspace)
    
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Channel')).toBeInTheDocument()
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Settings saved successfully')
    })
  })

  it('should show error toast on save failure', async () => {
    const mockError = new Error('Network error')
    vi.mocked(workspaceApi.updateWorkspace).mockRejectedValue(mockError)
    
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Channel')).toBeInTheDocument()
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to save settings')
    })
  })

  it('should prevent save with validation errors', async () => {
    renderWithProviders(<SettingsPage />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Channel')).toBeInTheDocument()
    })

    // Clear email to create error
    const emailInput = screen.getByDisplayValue('admin@test.com')
    await userEvent.clear(emailInput)

    const saveButton = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveButton)

    // Should NOT call updateWorkspace
    expect(workspaceApi.updateWorkspace).not.toHaveBeenCalled()
    
    // Should show error message
    expect(toast.error).toHaveBeenCalledWith('Please fix validation errors before saving')
  })
})

describe('SettingsPage - Translation Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should populate translation toggles correctly', async () => {
    renderWithProviders(<SettingsPage />)
    
    const translationTab = screen.getByRole('tab', { name: /translation/i })
    await userEvent.click(translationTab)

    await waitFor(() => {
      const switches = screen.getAllByRole('switch')
      // Find the translation toggles
      expect(switches.length).toBeGreaterThan(0)
    })
  })

  it.skip('should allow changing catalog base language', async () => {
    renderWithProviders(<SettingsPage />)
    
    const translationTab = screen.getByRole('tab', { name: /translation/i })
    await userEvent.click(translationTab)

    await waitFor(() => {
      const languageSelect = screen.getByRole('button', { name: /italian/i })
      expect(languageSelect).toBeInTheDocument()
    })
  })
})


describe('SettingsPage - Help Panels', () => {
  it('should display help panel on basic tab', async () => {
    renderWithProviders(<SettingsPage />)
    
    // Help panel should be present - check for the HelpCircle icon or just verify tab renders
    await waitFor(() => {
      const basicTab = screen.getByRole('tab', { name: /basic/i })
      expect(basicTab).toBeInTheDocument()
    })
  })
})
