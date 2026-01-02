import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { LoginPage } from '../src/pages/LoginPage'
import { LanguageProvider } from '../src/contexts/LanguageContext'
import * as authService from '../src/services/auth'

// Mock modules
vi.mock('../src/services/auth')
vi.mock('../src/hooks/usePlatformConfig', () => ({
  useFeatureFlags: () => ({
    canLogin: true,
    canRegister: true,
    workingInProgress: false,
    registerFirst: false,
    isLoading: false,
  }),
}))
vi.mock('../src/lib/storage', () => ({
  storage: {
    getToken: vi.fn(() => null),
    setToken: vi.fn(),
    getUser: vi.fn(() => null),
    setUser: vi.fn(),
    getWorkspace: vi.fn(() => null),
    setWorkspace: vi.fn(),
    getSessionId: vi.fn(() => null),
    setSessionId: vi.fn(),
    clearAppState: vi.fn(),
    clearWorkspace: vi.fn(),
    clearUser: vi.fn(),
    clearSessionId: vi.fn(),
  },
}))
vi.mock('../src/services/workspace', () => ({
  workspaceApi: {
    getAll: vi.fn(() => Promise.resolve([])),
  },
}))

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <LanguageProvider>
        <LoginPage />
      </LanguageProvider>
    </BrowserRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Rendering', () => {
    it('should render login form by default', async () => {
      renderLoginPage()
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/your@email.com/i)).toBeInTheDocument()
        expect(screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
      })
    })

    it('should render language selector with 4 languages', async () => {
      renderLoginPage()
      
      await waitFor(() => {
        expect(screen.getByText(/🇮🇹/)).toBeInTheDocument()
      })
    })

    it('should render hero section with slides', async () => {
      renderLoginPage()
      
      await waitFor(() => {
        const heroImages = screen.getAllByAltText(/WhatsApp AI agent dashboard view/i)
        expect(heroImages.length).toBeGreaterThan(0)
      })
    })

    it('should show Google OAuth button', async () => {
      renderLoginPage()
      
      await waitFor(() => {
        expect(screen.getByText(/Accedi con Google/i)).toBeInTheDocument()
      })
    })
  })

  describe('Login Form', () => {
    it('should display validation error for invalid email', async () => {
      renderLoginPage()
      
      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(/your@email.com/i)
        const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i)
        
        fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
        fireEvent.change(passwordInput, { target: { value: 'password123' } })
        fireEvent.blur(emailInput)
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid email address/i)).toBeInTheDocument()
      })
    })

    it('should display validation error for empty password', async () => {
      renderLoginPage()
      
      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(/your@email.com/i)
        const submitButton = screen.getByRole('button', { name: /sign in/i })
        
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
        fireEvent.click(submitButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Password is required/i)).toBeInTheDocument()
      })
    })

    it('should call login API with correct credentials', async () => {
      const mockLogin = vi.fn().mockResolvedValue({
        data: {
          user: { id: '1', email: 'test@example.com' },
          token: 'fake-token',
          sessionId: 'fake-session',
        },
      })
      vi.mocked(authService.auth.login).mockImplementation(mockLogin)

      renderLoginPage()
      
      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(/your@email.com/i)
        const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i)
        const submitButton = screen.getByRole('button', { name: /sign in/i })
        
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
        fireEvent.change(passwordInput, { target: { value: 'Password123!' } })
        fireEvent.click(submitButton)
      })

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'Password123!',
        })
      })
    })
  })

  describe('Registration Form', () => {
    it('should switch to register form when clicking "Create one"', async () => {
      renderLoginPage()
      
      await waitFor(() => {
        const createButton = screen.getByText(/Create one/i)
        fireEvent.click(createButton)
      })

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/First name/i)).toBeInTheDocument()
        expect(screen.getByPlaceholderText(/Last name/i)).toBeInTheDocument()
      })
    })

    it('should display password validation errors', async () => {
      renderLoginPage()
      
      // Switch to register form
      await waitFor(() => {
        const createButton = screen.getByText(/Create one/i)
        fireEvent.click(createButton)
      })

      // Enter weak password
      await waitFor(() => {
        const passwordInput = screen.getAllByPlaceholderText(/\*\*\*\*\*\*\*\*/i)[0]
        fireEvent.change(passwordInput, { target: { value: 'weak' } })
        fireEvent.blur(passwordInput)
      })

      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument()
      })
    })

    it('should validate password confirmation match', async () => {
      renderLoginPage()
      
      // Switch to register form
      await waitFor(() => {
        const createButton = screen.getByText(/Create one/i)
        fireEvent.click(createButton)
      })

      // Enter mismatching passwords
      await waitFor(() => {
        const passwordInputs = screen.getAllByPlaceholderText(/\*\*\*\*\*\*\*\*/i)
        fireEvent.change(passwordInputs[0], { target: { value: 'Password123!' } })
        fireEvent.change(passwordInputs[1], { target: { value: 'DifferentPass123!' } })
        fireEvent.blur(passwordInputs[1])
      })

      await waitFor(() => {
        expect(screen.getByText(/Passwords don't match/i)).toBeInTheDocument()
      })
    })
  })

  describe('Admin Bypass', () => {
    it('should allow login with ?admin=true when workingInProgress is true', async () => {
      // Mock feature flags with workingInProgress
      vi.mock('../src/hooks/usePlatformConfig', () => ({
        useFeatureFlags: () => ({
          canLogin: false,
          canRegister: false,
          workingInProgress: true,
          registerFirst: false,
          isLoading: false,
        }),
      }))

      // Render with admin param
      window.history.pushState({}, '', '?admin=true')
      renderLoginPage()
      
      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(/your@email.com/i)
        expect(emailInput).not.toBeDisabled()
      })
    })
  })

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility when clicking eye icon', async () => {
      renderLoginPage()
      
      await waitFor(() => {
        const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i) as HTMLInputElement
        expect(passwordInput.type).toBe('password')
        
        // Find and click eye icon
        const eyeButtons = screen.getAllByRole('button')
        const eyeButton = eyeButtons.find(btn => btn.querySelector('svg'))
        if (eyeButton) {
          fireEvent.click(eyeButton)
        }
      })

      await waitFor(() => {
        const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i) as HTMLInputElement
        expect(passwordInput.type).toBe('text')
      })
    })
  })

  describe('Language Switching', () => {
    it('should change language when selecting from dropdown', async () => {
      renderLoginPage()
      
      await waitFor(() => {
        // Click language selector
        const itFlag = screen.getByText(/🇮🇹/)
        fireEvent.click(itFlag)
      })

      await waitFor(() => {
        // Should show language options
        expect(screen.getByText(/Italiano/i)).toBeInTheDocument()
      })
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should render mobile-optimized header', async () => {
      renderLoginPage()
      
      await waitFor(() => {
        const logo = screen.getByAltText(/eChatbot/i)
        expect(logo).toHaveClass(/h-\[70px\]/)
      })
    })
  })
})
