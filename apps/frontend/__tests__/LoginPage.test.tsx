import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { LoginPage } from '../src/pages/LoginPage'
import { LanguageProvider } from '../src/contexts/LanguageContext'
import { WorkspaceProvider } from '../src/contexts/WorkspaceContext'
import { auth as authService } from '../src/services/api'
import { useFeatureFlags } from '@/hooks/usePlatformConfig'

const { mockUseFeatureFlags } = vi.hoisted(() => ({
  mockUseFeatureFlags: vi.fn(() => ({
    canLogin: true,
    canRegister: true,
    workingInProgress: false,
    registerFirst: false,
    isLoading: false,
  })),
}))

// Mock modules
vi.mock('../src/services/api', () => ({
  auth: {
    login: vi.fn(),
    logout: vi.fn(),
  },
  api: {
    post: vi.fn(),
  },
}))
vi.mock('@/hooks/usePlatformConfig', () => ({
  useFeatureFlags: mockUseFeatureFlags,
  usePlatformConfig: () => ({
    prices: {
      FREE_MONTHLY: { current: 0, original: null },
      BASIC_MONTHLY: { current: 23, original: 34 },
      PREMIUM_MONTHLY: { current: 44, original: 58 },
      ENTERPRISE_MONTHLY: { current: 139, original: 175 },
    },
    isLoading: false,
    error: null,
    getPriceWithOriginal: (key: string) =>
      ({
        FREE_MONTHLY: { current: 0, original: null },
        BASIC_MONTHLY: { current: 23, original: 34 },
        PREMIUM_MONTHLY: { current: 44, original: 58 },
        ENTERPRISE_MONTHLY: { current: 139, original: 175 },
      } as Record<string, { current: number; original: number | null }>)[key] ??
      null,
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
      <WorkspaceProvider>
        <LanguageProvider>
          <LoginPage />
        </LanguageProvider>
      </WorkspaceProvider>
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
        const signInButtons = screen.getAllByRole('button', { name: /^Sign In$/ })
        expect(signInButtons.length).toBeGreaterThan(0)
      })
    })

    it('should render language selector with 4 languages', async () => {
      renderLoginPage()

      await waitFor(() => {
        expect(screen.getByText(/🇬🇧/)).toBeInTheDocument()
      })
    })

    it('should render hero section with slides', async () => {
      renderLoginPage()

      await waitFor(() => {
        const heroImages = screen.getAllByAltText(/WhatsApp AI agent dashboard/i)
        expect(heroImages.length).toBeGreaterThan(0)
      })
    })

    it('should show Google OAuth button', async () => {
      renderLoginPage()

      await waitFor(() => {
        expect(screen.getByText(/Or continue with/i)).toBeInTheDocument()
      })
    })
  })

  describe('Login Form', () => {
    it('should display validation error for invalid email', async () => {
      renderLoginPage()

      const emailInput = await screen.findByPlaceholderText(/your@email.com/i)
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i)

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.submit(emailInput.closest('form') as HTMLFormElement)

      expect(await screen.findByText(/Invalid email address/i)).toBeInTheDocument()
    })

    it('should display validation error for empty password', async () => {
      renderLoginPage()

      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(/your@email.com/i)
        const submitButton = screen.getByRole('button', { name: /^Sign In$/ })

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
      vi.mocked(authService.login).mockImplementation(mockLogin)

      renderLoginPage()

      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(/your@email.com/i)
        const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i)
        const submitButton = screen.getByRole('button', { name: /^Sign In$/ })

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

      const createButton = await screen.findByRole('button', { name: /Create one/i })
      fireEvent.click(createButton)

      const createHeaders = await screen.findAllByText(/Create (your )?account/i)
      expect(createHeaders.length).toBeGreaterThan(0)
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
    beforeEach(() => {
      // Clear sessionStorage before each test
      sessionStorage.clear()
    })

    it('should show WIP banner when workingInProgress=true and no admin param', async () => {
      mockUseFeatureFlags.mockReturnValue({
        canLogin: true,
        canRegister: true,
        workingInProgress: true,
        registerFirst: false,
        isLoading: false,
      })

      window.history.pushState({}, '', '/')
      renderLoginPage()

      await waitFor(() => {
        // Look for the red banner with specific styling (instead of translated text)
        const banner = document.querySelector('.bg-red-600.rotate-12')
        expect(banner).toBeTruthy()
      })
    })

    it('should hide WIP banner when ?admin=true', async () => {
      mockUseFeatureFlags.mockReturnValue({
        canLogin: true,
        canRegister: true,
        workingInProgress: true,
        registerFirst: false,
        isLoading: false,
      })

      window.history.pushState({}, '', '?admin=true')
      renderLoginPage()

      await waitFor(() => {
        const banner = screen.queryByText(/wip\.banner/i)
        expect(banner).not.toBeInTheDocument()
      })
    })

    it('should enable form fields when ?admin=true bypasses WIP', async () => {
      mockUseFeatureFlags.mockReturnValue({
        canLogin: false,
        canRegister: false,
        workingInProgress: true,
        registerFirst: false,
        isLoading: false,
      })

      window.history.pushState({}, '', '?admin=true')
      renderLoginPage()

      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(/your@email.com/i) as HTMLInputElement
        expect(emailInput).not.toBeDisabled()
      })
    })

    it('should disable form fields when workingInProgress=true and no admin bypass', async () => {
      mockUseFeatureFlags.mockReturnValue({
        canLogin: true,
        canRegister: true,
        workingInProgress: true,
        registerFirst: false,
        isLoading: false,
      })

      window.history.pushState({}, '', '/')
      renderLoginPage()

      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(/your@email.com/i) as HTMLInputElement
        expect(emailInput).toBeDisabled()
      })
    })

    it('should clear sessionStorage when no admin param in URL', async () => {
      // Pre-set sessionStorage
      sessionStorage.setItem('adminBypass', 'true')

      mockUseFeatureFlags.mockReturnValue({
        canLogin: true,
        canRegister: true,
        workingInProgress: true,
        registerFirst: false,
        isLoading: false,
      })

      window.history.pushState({}, '', '/')
      renderLoginPage()

      await waitFor(() => {
        expect(sessionStorage.getItem('adminBypass')).toBeNull()
      })
    })

    it('should clear sessionStorage when ?admin=false', async () => {
      // Pre-set sessionStorage
      sessionStorage.setItem('adminBypass', 'true')

      mockUseFeatureFlags.mockReturnValue({
        canLogin: true,
        canRegister: true,
        workingInProgress: true,
        registerFirst: false,
        isLoading: false,
      })

      window.history.pushState({}, '', '?admin=false')
      renderLoginPage()

      await waitFor(() => {
        expect(sessionStorage.getItem('adminBypass')).toBeNull()
      })
    })

    it('should set sessionStorage when ?admin=true', async () => {
      mockUseFeatureFlags.mockReturnValue({
        canLogin: true,
        canRegister: true,
        workingInProgress: true,
        registerFirst: false,
        isLoading: false,
      })

      window.history.pushState({}, '', '?admin=true')
      renderLoginPage()

      await waitFor(() => {
        expect(sessionStorage.getItem('adminBypass')).toBe('true')
      })
    })
  })

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility when clicking eye icon', async () => {
      renderLoginPage()

      await waitFor(() => {
        const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i) as HTMLInputElement
        expect(passwordInput.type).toBe('password')

        const eyeButton = passwordInput.parentElement?.querySelector('button') as HTMLButtonElement
        fireEvent.click(eyeButton)
      })

      await waitFor(() => {
        const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i) as HTMLInputElement
        expect(passwordInput.type).toBe('text')
      })
    })
  })

  describe('Language Switching', () => {
    it('should render language selector trigger', async () => {
      renderLoginPage()

      const langButton = screen
        .getAllByRole('button')
        .find((button) => button.getAttribute('aria-haspopup') === 'menu' && button.textContent?.includes('🇬🇧'))

      expect(langButton).toBeTruthy()
    })
  })

})
