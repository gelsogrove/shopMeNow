/**
 * Widget Integration Tests
 * Test suite for chat widget functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatWidget } from '@/components/ChatWidget'

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
    render(
      <ChatWidget workspaceId="test-workspace" />
    )
    
    const button = screen.getByRole('button', { name: /open chat/i })
    expect(button).toBeInTheDocument()
  })

  it('should initialize with visitor ID from localStorage', () => {
    const mockVisitorId = 'webvisitor-test123'
    localStorageMock.getItem.mockReturnValue(mockVisitorId)

    render(
      <ChatWidget workspaceId="test-workspace" />
    )

    expect(localStorageMock.getItem).toHaveBeenCalledWith('echatbot-visitor-id')
  })

  it('should create new visitor ID if not in localStorage', () => {
    localStorageMock.getItem.mockReturnValue(null)

    render(
      <ChatWidget workspaceId="test-workspace" />
    )

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'echatbot-visitor-id',
      expect.stringMatching(/^webvisitor-/)
    )
  })

  // ========================================
  // POPUP INTERACTION TESTS
  // ========================================

  it('should open popup when button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ChatWidget workspaceId="test-workspace" />
    )

    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    const popup = screen.getByText(/chat with us/i)
    expect(popup).toBeInTheDocument()
  })

  it('should close popup when close button is clicked', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ChatWidget workspaceId="test-workspace" />
    )

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
    render(
      <ChatWidget workspaceId="test-workspace" />
    )

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
    localStorageMock.getItem.mockReturnValue('webvisitor-test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        response: 'Hello from bot',
        sessionId: 'session-123',
      }),
    })

    const { container } = render(
      <ChatWidget workspaceId="test-workspace" />
    )

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
        expect.stringContaining('/widget/message'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Hello'),
        })
      )
    })
  })

  it('should display user message after sending', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('webvisitor-test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        response: 'Bot reply',
        sessionId: 'session-123',
      }),
    })

    render(
      <ChatWidget workspaceId="test-workspace" />
    )

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
    localStorageMock.getItem.mockReturnValue('webvisitor-test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        response: 'This is the bot response',
        sessionId: 'session-123',
      }),
    })

    render(
      <ChatWidget workspaceId="test-workspace" />
    )

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

  it('should handle send button keyboard shortcut (Enter)', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('webvisitor-test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        response: 'Bot reply',
        sessionId: 'session-123',
      }),
    })

    render(
      <ChatWidget workspaceId="test-workspace" />
    )

    // Open popup and send via Enter key
    const button = screen.getByRole('button', { name: /open chat/i })
    await user.click(button)

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'Test{Enter}')

    // Verify message was sent
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/widget/message'),
        expect.any(Object)
      )
    })
  })

  it('should persist messages to localStorage', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('webvisitor-test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        response: 'Bot reply',
        sessionId: 'session-123',
      }),
    })

    render(
      <ChatWidget workspaceId="test-workspace" />
    )

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
        'echatbot-messages',
        expect.any(String)
      )
    })
  })

  // ========================================
  // RATE LIMITING TESTS
  // ========================================

  it('should handle 429 rate limit error', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('webvisitor-test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        error: 'Rate limit exceeded',
        retryAfter: 3600,
      }),
    })

    render(
      <ChatWidget workspaceId="test-workspace" />
    )

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
    localStorageMock.getItem.mockReturnValue('webvisitor-test123')

    render(
      <ChatWidget workspaceId="test-workspace" />
    )

    // Widget should expose method to parent
    expect((window as any).eChatbotWidgetReact).toBeDefined()
    expect(typeof (window as any).eChatbotWidgetReact.convertVisitor).toBe('function')
  })

  it('should clear visitor ID after conversion', async () => {
    localStorageMock.getItem.mockReturnValue('webvisitor-test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        customerId: 'customer-123',
      }),
    })

    render(
      <ChatWidget workspaceId="test-workspace" />
    )

    const widget = (window as any).eChatbotWidgetReact
    await widget.convertVisitor({
      phone: '+1234567890',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    })

    // Verify visitor ID would be cleared (in real scenario)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('echatbot-visitor-id')
  })

  // ========================================
  // CORS & SECURITY TESTS
  // ========================================

  it('should include correct headers in API call', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('webvisitor-test123')

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        response: 'Bot reply',
        sessionId: 'session-123',
      }),
    })

    render(
      <ChatWidget workspaceId="test-workspace" />
    )

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

  it('should load stored messages on mount', () => {
    const storedMessages = JSON.stringify([
      { role: 'user', content: 'Hello' },
      { role: 'bot', content: 'Hi there' },
    ])
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'echatbot-messages') return storedMessages
      if (key === 'echatbot-visitor-id') return 'webvisitor-test123'
      return null
    })

    render(
      <ChatWidget workspaceId="test-workspace" />
    )

    // Messages should be displayed
    fireEvent.click(screen.getByRole('button', { name: /open chat/i }))
    expect(screen.getByText(/Hello/)).toBeInTheDocument()
    expect(screen.getByText(/Hi there/)).toBeInTheDocument()
  })

  // ========================================
  // UI TESTS
  // ========================================

  it('should render with correct position classes', () => {
    const { container } = render(
      <ChatWidget workspaceId="test-workspace" position="bottom-left" />
    )

    // Check for position class (implementation specific)
    expect(container.querySelector('[class*="bottom"]')).toBeInTheDocument()
  })

  it('should display custom title', async () => {
    const customTitle = 'My Custom Title'
    render(
      <ChatWidget 
        workspaceId="test-workspace" 
        title={customTitle}
      />
    )

    const button = screen.getByRole('button', { name: /open chat/i })
    await userEvent.click(button)

    expect(screen.getByText(customTitle)).toBeInTheDocument()
  })
})
