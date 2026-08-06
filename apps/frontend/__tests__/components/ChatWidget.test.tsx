/**
 * Widget Integration Tests
 * Test suite for chat widget functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatWidget } from '@/components/ChatWidget'
import { LanguageProvider } from '@/contexts/LanguageContext'

// Mock fetch globally
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

const renderWithLanguage = (ui: React.ReactElement) =>
  render(<LanguageProvider>{ui}</LanguageProvider>)

describe('ChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ========================================
  // INITIALIZATION TESTS
  // ========================================

  it('should render widget button', () => {
    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)
    
    const button = screen.getByRole('button', { name: /open chat/i })
    expect(button).toBeInTheDocument()
  })

  it('should initialize with visitor ID from localStorage', () => {
    const mockVisitorId = 'visitor_1700000000000_test123'
    localStorageMock.getItem.mockReturnValue(mockVisitorId)

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    expect(localStorageMock.getItem).toHaveBeenCalledWith('echatbot-visitor-id:test-workspace')
  })

  it('should create new visitor ID if not in localStorage', () => {
    localStorageMock.getItem.mockReturnValue(null)

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'echatbot-visitor-id:test-workspace',
      expect.stringMatching(/^visitor_\d{13}_/)
    )
  })

  // ========================================
  // POPUP INTERACTION TESTS
  // ========================================

  it('should open popup when button is clicked', async () => {
    const user = userEvent.setup()
    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    const popup = screen.getByText(/chat with us/i)
    expect(popup).toBeInTheDocument()
  })

  it('should close popup when close button is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    // Open popup
    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    // Close popup
    const closeBtn = container.querySelector('[aria-label="Close chat"]')
    if (closeBtn) {
      await user.click(closeBtn)
    }
  })

  it('should toggle popup on button click', async () => {
    const user = userEvent.setup()
    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    const button = screen.getByRole('button', { name: /open chat/i })

    // First click - open
    await user.click(button)
    let popup = screen.queryByText(/chat with us/i)
    expect(popup).toBeInTheDocument()

    // Note: Closing popup might require finding close button
  })

  // ========================================
  // MESSAGE SENDING TESTS
  // ========================================

  it('should send message when send button is clicked', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('visitor_1700000000000_test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        response: 'Hello from bot',
        sessionId: 'session-123',
      }),
    })

    const { container } = renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    // Open popup
    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    // Type message
    const input = screen.getByPlaceholderText(/type a message/i) as HTMLInputElement
    await user.type(input, 'Hello')

    // Send message
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    await user.click(sendBtn)

    // Verify API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/widget/chat/test-workspace'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Hello'),
        })
      )
    })
  })

  it('should display user message after sending', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('visitor_1700000000000_test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        response: 'Bot reply',
        sessionId: 'session-123',
      }),
    })

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    // Open popup
    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    // Send message
    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'Test message')
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    await user.click(sendBtn)

    // Verify user message appears
    await waitFor(() => {
      expect(screen.getByText(/Test message/i)).toBeInTheDocument()
    })
  })

  it('should display bot response after sending message', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('visitor_1700000000000_test123')

    ;(global.fetch as any)
      // First call: widget status (reconcile / returning-user path)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'active',
          channelStatus: true,
          debugMode: false,
          workspaceId: 'test-workspace',
          workspace: {
            channelStatus: true,
            debugMode: false,
            whatsappPhoneNumber: '+391234',
            name: 'Test Workspace',
          },
        }),
      })
      // Second call: restoreOperatorState → /widget/operator-messages (always called at init)
      // RULE: must be mocked because it runs before the user interaction fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activeChatbot: true, messages: [] }),
      })
      // Third call: send message
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          response: 'This is the bot response',
          sessionId: 'session-123',
        }),
      })

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    // Open and send message
    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'Hello bot')
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    await user.click(sendBtn)

    // Verify bot response appears
    await waitFor(() => {
      expect(screen.getByText(/This is the bot response/i)).toBeInTheDocument()
    })
  })

  // ========================================
  // OPERATOR HANDOFF TESTS
  // ========================================

  it('should display the hand-off message on the escalation turn (activeChatbot=false WITH response)', async () => {
    // WHY: the escalation response carries BOTH the configured hand-off text
    // (workspace.humanSupportMessage, translated by the LLM) AND
    // activeChatbot:false. The widget used to discard the response entirely
    // when it saw the flag — the customer answered the last question and got
    // silence before waiting mode. Seen live on DemoRobot (2026-08-06): the
    // message was saved in conversation_messages but never rendered.
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('visitor_1700000000000_test123')

    ;(global.fetch as any)
      // Init: widget status
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'active',
          channelStatus: true,
          debugMode: false,
          workspaceId: 'test-workspace',
          workspace: {
            channelStatus: true,
            debugMode: false,
            whatsappPhoneNumber: '+391234',
            name: 'Test Workspace',
          },
        }),
      })
      // Init: restoreOperatorState → /widget/operator-messages
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activeChatbot: true, messages: [] }),
      })
      // Send: the ESCALATION turn — hand-off text + takeover flag together
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          response: 'Thank you Andrea, I am connecting you with our Customer Care team.',
          sessionId: 'session-123',
          activeChatbot: false,
        }),
      })
      // Any later operator-messages polls triggered by botDisabled=true
      .mockResolvedValue({
        ok: true,
        json: async () => ({ activeChatbot: false, messages: [] }),
      })

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'andrea')
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    await user.click(sendBtn)

    // The hand-off message MUST be rendered as a bot bubble...
    await waitFor(() => {
      expect(
        screen.getByText(/connecting you with our Customer Care team/i)
      ).toBeInTheDocument()
    })
    // ...AND the widget switches to waiting mode (operator banner visible)
    await waitFor(() => {
      expect(
        screen.getByText(/Connecting you with our team — replies coming shortly/i)
      ).toBeInTheDocument()
    })
  })

  it('should NOT add a bot bubble on post-takeover messages (activeChatbot=false with empty response)', async () => {
    // WHY: once the operator owns the chat, the backend blocks the LLM and the
    // adapter returns response:"" with activeChatbot:false. Nothing must be
    // rendered for those turns — only the waiting banner. This is the case the
    // old discard logic was written for; it must keep working after the fix.
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('visitor_1700000000000_test123')

    ;(global.fetch as any)
      // Init: widget status
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'active',
          channelStatus: true,
          debugMode: false,
          workspaceId: 'test-workspace',
          workspace: {
            channelStatus: true,
            debugMode: false,
            whatsappPhoneNumber: '+391234',
            name: 'Test Workspace',
          },
        }),
      })
      // Init: restoreOperatorState → /widget/operator-messages
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activeChatbot: true, messages: [] }),
      })
      // Send: operator already owns the chat — backend blocked the LLM
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          activeChatbot: false,
          blocked: true,
          sessionId: 'session-123',
        }),
      })
      // Any later operator-messages polls triggered by botDisabled=true
      .mockResolvedValue({
        ok: true,
        json: async () => ({ activeChatbot: false, messages: [] }),
      })

    const { container } = renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'hello?')
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    await user.click(sendBtn)

    // Waiting banner appears...
    await waitFor(() => {
      expect(
        screen.getByText(/Connecting you with our team — replies coming shortly/i)
      ).toBeInTheDocument()
    })
    // ...and the only stored message is the user's own — no bot bubble was
    // added for the blocked turn (persisted history is the source of truth
    // the widget re-renders from)
    expect(screen.getByText('hello?')).toBeInTheDocument()
    const persistedBotEntries = localStorageMock.setItem.mock.calls
      .filter(([key]) => String(key).includes('messages'))
      .flatMap(([, value]) => {
        try {
          return JSON.parse(String(value)) as Array<{ role: string }>
        } catch {
          return []
        }
      })
      .filter((m) => m.role === 'bot')
    expect(persistedBotEntries.length).toBe(0)
  })

  it('should handle send button keyboard shortcut (Enter)', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('visitor_1700000000000_test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        response: 'Bot reply',
        sessionId: 'session-123',
      }),
    })

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    // Open popup and send via Enter key
    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'Test{Enter}')

    // Verify message was sent
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/widget/chat/test-workspace'),
        expect.any(Object)
      )
    })
  })

  it('should persist messages to localStorage', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('visitor_1700000000000_test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        response: 'Bot reply',
        sessionId: 'session-123',
      }),
    })

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    // Send message
    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'Test message')
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    await user.click(sendBtn)

    // Verify localStorage save called
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'echatbot-messages:test-workspace',
        expect.any(String)
      )
    })
  })

  // ========================================
  // RATE LIMITING TESTS
  // ========================================

  it('should handle 429 rate limit error', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('visitor_1700000000000_test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        error: 'Rate limit exceeded',
        retryAfter: 3600,
      }),
    })

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    // Try to send message
    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'Test')
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    await user.click(sendBtn)

    // Should show error message (non-blocking)
    await waitFor(() => {
      // Error should be displayed in UI
      expect(screen.queryByText(/couldn't process/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  // ========================================
  // VISITOR CONVERSION TESTS
  // ========================================

  it('should expose convertVisitor method', async () => {
    localStorageMock.getItem.mockReturnValue('visitor_1700000000000_test123')

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    // Widget should expose method to parent
    expect((window as any).eChatbotWidgetReact).toBeDefined()
    expect(typeof (window as any).eChatbotWidgetReact.convertVisitor).toBe('function')
  })

  it('should clear visitor ID after conversion', async () => {
    localStorageMock.getItem.mockReturnValue('visitor_1700000000000_test123')

    ;(global.fetch as any)
      // First call: widget status (reconcile / returning-user path)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'active',
          channelStatus: true,
          debugMode: false,
          workspaceId: 'test-workspace',
          workspace: {
            channelStatus: true,
            debugMode: false,
            whatsappPhoneNumber: '+391234',
            name: 'Test Workspace',
          },
        }),
      })
      // Second call: restoreOperatorState → /widget/operator-messages (always called at init)
      // RULE: must be mocked because it runs before the convertVisitor call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activeChatbot: true, messages: [] }),
      })
      // Third call: convertVisitor
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          customerId: 'customer-123',
        }),
      })

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    const widget = (window as any).eChatbotWidgetReact
    await widget.convertVisitor({
      phone: '+1234567890',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    })

    // Verify visitor ID would be cleared (in real scenario)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('echatbot-visitor-id:test-workspace')
  })

  // ========================================
  // CORS & SECURITY TESTS
  // ========================================

  it('should include correct headers in API call', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('visitor_1700000000000_test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        response: 'Bot reply',
        sessionId: 'session-123',
      }),
    })

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    // Send message
    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'Test')
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    await user.click(sendBtn)

    // Verify headers
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })
  })

  // ========================================
  // STORAGE TESTS
  // ========================================

  it('should load stored messages on mount', async () => {
    const storedMessages = JSON.stringify([
      { role: 'user', content: 'Hello' },
      { role: 'bot', content: 'Hi there' },
    ])
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'echatbot-messages:test-workspace') return storedMessages
      if (key === 'echatbot-visitor-id:test-workspace') return 'visitor_1700000000000_test123'
      if (key === 'echatbot-customer-id:test-workspace') return 'customer-abc' // skip registration form
      return null
    })

    renderWithLanguage(<ChatWidget workspaceId="test-workspace" />)

    // Messages should be displayed
    fireEvent.click(screen.getByRole('button', { name: /open chat/i }))

    await waitFor(() => {
      expect(screen.getByText(/Hello/)).toBeInTheDocument()
      expect(screen.getByText(/Hi there/)).toBeInTheDocument()
    })
  })

  // ========================================
  // UI TESTS
  // ========================================

  it('should render with correct position classes', () => {
    const { container } = renderWithLanguage(<ChatWidget workspaceId="test-workspace" position="bottom-left" />)

    // Check for position class (implementation specific)
    expect(container.querySelector('[class*="bottom"]')).toBeInTheDocument()
  })

  it('should display custom title', async () => {
    const customTitle = 'My Custom Title'
    renderWithLanguage(<ChatWidget workspaceId="test-workspace" title={customTitle} />)

    const button = screen.getByRole('button', { name: /open chat/i })
    await userEvent.click(button)

    expect(screen.getByText(customTitle)).toBeInTheDocument()
  })
})
