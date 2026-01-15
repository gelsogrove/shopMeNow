/**
 * LoginPage.AdminNavigation.spec.tsx
 * 
 * Tests for Platform Admin navigation between Workspace and Backoffice
 * 
 * FEATURE: Admin users with isPlatformAdmin=true should see BOTH navigation options:
 * - "Go to Workspace" (frontend workspace management)
 * - "Go to Backoffice" (admin backoffice dashboard)
 * 
 * REQUIREMENT: Admin should NOT be auto-redirected to backoffice, but choose manually
 * 
 * @author Andrea Gelso
 * @date 2026-01-15
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { LoginPage } from '../../src/pages/LoginPage'
import { LanguageProvider } from '../../src/contexts/LanguageContext'
import { WorkspaceProvider } from '../../src/contexts/WorkspaceContext'
import { auth as authService } from '../../src/services/api'
import { storage } from '../../src/lib/storage'

// Mock modules
vi.mock('../../src/services/api', () => ({
  auth: {
    login: vi.fn(),
    logout: vi.fn(),
  },
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('../../src/lib/storage', () => ({
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

vi.mock('@/hooks/usePlatformConfig', () => {
  const prices = {
    FREE_MONTHLY: { current: 0, original: null },
    BASIC_MONTHLY: { current: 23, original: 34 },
    PREMIUM_MONTHLY: { current: 44, original: 58 },
    ENTERPRISE_MONTHLY: { current: 139, original: 175 },
  }
  return {
    useFeatureFlags: () => ({
      canLogin: true,
      canRegister: true,
      workingInProgress: false,
      registerFirst: false,
      cantryDemo: true,
      isLoading: false,
    }),
    usePlatformConfig: () => ({
      prices,
      isLoading: false,
      error: null,
      getPriceWithOriginal: (key: keyof typeof prices) => prices[key] ?? null,
    }),
  }
})

vi.mock('../../src/services/workspaceApi', () => ({
  workspaceApi: {
    getAll: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock('../../src/services/widgetApi', () => ({
  widgetApi: {
    getVisitorId: vi.fn(() => null),
    clearStoredMessages: vi.fn(),
  },
}))

vi.mock('../../src/services/subscriptionBillingApi', () => ({
  getBillingOverview: vi.fn(() => Promise.resolve({
    planType: 'BASIC',
    creditBalance: 100,
    limits: {},
    usage: {},
  })),
}))

vi.mock('../../src/services/supportApi', () => ({
  getUnreadCount: vi.fn(() => Promise.resolve(0)),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

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

describe('LoginPage - Platform Admin Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(storage.getToken).mockReturnValue(null)
    vi.mocked(storage.getUser).mockReturnValue(null)
    vi.mocked(storage.getWorkspace).mockReturnValue(null)
    // Reset window.location mock
    delete (window as any).location
    ;(window as any).location = {
      href: 'http://localhost/',
      hostname: 'localhost',
      replace: vi.fn(),
      assign: vi.fn(),
    }
    localStorage.setItem('language', 'en')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Admin Login Flow (No 2FA)', () => {
    it('should NOT auto-redirect Platform Admin to backoffice after login', async () => {
      const mockLogin = vi.fn().mockResolvedValue({
        data: {
          user: {
            id: '1',
            email: 'admin@echatbot.ai',
            firstName: 'Admin',
            lastName: 'User',
            isPlatformAdmin: true,
            isDeveloperUser: true,
          },
          token: 'fake-admin-token',
          sessionId: 'fake-admin-session',
        },
      })
      vi.mocked(authService.login).mockImplementation(mockLogin)
      vi.mocked(storage.getToken).mockReturnValue(null)

      renderLoginPage()

      const emailInput = await screen.findByPlaceholderText(/your@email.com/i)
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i)
      const submitButton = screen.getByRole('button', { name: /^Sign In$/ })

      await userEvent.type(emailInput, 'admin@echatbot.ai')
      await userEvent.type(passwordInput, 'venezia44')
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'admin@echatbot.ai',
          password: 'venezia44',
        })
      })

      // CRITICAL: Admin should NOT be redirected automatically
      expect(mockNavigate).not.toHaveBeenCalledWith('/workspace-selection')
      expect(window.location.replace).not.toHaveBeenCalled()
      expect(window.location.href).toBe('http://localhost/')
    })

    it('should show avatar menu with "Platform Admin" badge after admin login', async () => {
      const adminUser = {
        id: '1',
        email: 'admin@echatbot.ai',
        firstName: 'Admin',
        lastName: 'User',
        isPlatformAdmin: true,
        isDeveloperUser: true,
      }

      const mockLogin = vi.fn().mockResolvedValue({
        data: {
          user: adminUser,
          token: 'fake-admin-token',
          sessionId: 'fake-admin-session',
        },
      })
      vi.mocked(authService.login).mockImplementation(mockLogin)

      vi.mocked(storage.getToken).mockReturnValue('fake-admin-token')
      vi.mocked(storage.getUser).mockReturnValue(adminUser)

      renderLoginPage()

      const avatarButton = await screen.findByRole('button', { name: /admin menu/i })
      await userEvent.click(avatarButton)

      const badge = await screen.findByText(/Platform Admin/i)
      expect(badge).toBeInTheDocument()
    })

    it('should show BOTH "Go to Workspace" and "Go to Backoffice" buttons for admin', async () => {
      const adminUser = {
        id: '1',
        email: 'admin@echatbot.ai',
        firstName: 'Admin',
        lastName: 'User',
        isPlatformAdmin: true,
        isDeveloperUser: true,
      }

      vi.mocked(storage.getToken).mockReturnValue('fake-admin-token')
      vi.mocked(storage.getUser).mockReturnValue(adminUser)

      renderLoginPage()

      const workspaceButton = await screen.findByRole('button', { name: /go to workspace/i })
      expect(workspaceButton).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /go to backoffice/i })).toBeInTheDocument()
    })

    it('should navigate to workspace-selection when clicking "Go to Workspace"', async () => {
      const adminUser = {
        id: '1',
        email: 'admin@echatbot.ai',
        firstName: 'Admin',
        lastName: 'User',
        isPlatformAdmin: true,
        isDeveloperUser: true,
      }

      vi.mocked(storage.getToken).mockReturnValue('fake-admin-token')
      vi.mocked(storage.getUser).mockReturnValue(adminUser)

      renderLoginPage()

      const workspaceButton = await screen.findByRole('button', { name: /go to workspace/i })
      await userEvent.click(workspaceButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspace-selection')
      })
    })

    it('should redirect to backoffice URL when clicking "Go to Backoffice"', async () => {
      const adminUser = {
        id: '1',
        email: 'admin@echatbot.ai',
        firstName: 'Admin',
        lastName: 'User',
        isPlatformAdmin: true,
        isDeveloperUser: true,
      }

      vi.mocked(storage.getToken).mockReturnValue('fake-admin-token')
      vi.mocked(storage.getUser).mockReturnValue(adminUser)

      renderLoginPage()

      const backofficeButton = await screen.findByRole('button', { name: /go to backoffice/i })
      await userEvent.click(backofficeButton)

      await waitFor(() => {
        expect(window.location.assign).toHaveBeenCalledWith(
          expect.stringContaining('http://localhost:3002/auth/callback?token=fake-admin-token')
        )
      })
    })
  })

  describe('Admin Login with 2FA Required', () => {
    it('should redirect to 2FA verification if admin has 2FA enabled (not developer)', async () => {
      const mockLogin = vi.fn().mockResolvedValue({
        data: {
          requires2FA: true,
          userId: '1',
          email: 'admin@echatbot.ai',
        },
      })
      vi.mocked(authService.login).mockImplementation(mockLogin)

      renderLoginPage()

      const emailInput = await screen.findByPlaceholderText(/your@email.com/i)
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i)
      const submitButton = screen.getByRole('button', { name: /^Sign In$/ })

      await userEvent.type(emailInput, 'admin@echatbot.ai')
      await userEvent.type(passwordInput, 'venezia44')
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled()
        // Should navigate to 2FA verification (NOT show avatar menu yet)
        expect(mockNavigate).toHaveBeenCalledWith('/auth/verify-2fa', expect.any(Object))
      })

      // Avatar menu should NOT appear before 2FA verification
      expect(screen.queryByRole('button', { name: /admin/i })).not.toBeInTheDocument()
    })

    it('should skip 2FA and show avatar menu if admin is developer user', async () => {
      const adminUser = {
        id: '1',
        email: 'dev-admin@echatbot.ai',
        firstName: 'Dev',
        lastName: 'Admin',
        isPlatformAdmin: true,
        isDeveloperUser: true,
      }

      const mockLogin = vi.fn().mockResolvedValue({
        data: {
          user: adminUser,
          token: 'fake-dev-admin-token',
          sessionId: 'fake-dev-admin-session',
          // NO requires2FA because isDeveloperUser=true skips 2FA
        },
      })
      vi.mocked(authService.login).mockImplementation(mockLogin)

      renderLoginPage()

      const emailInput = await screen.findByPlaceholderText(/your@email.com/i)
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i)
      const submitButton = screen.getByRole('button', { name: /^Sign In$/ })

      await userEvent.type(emailInput, 'dev-admin@echatbot.ai')
      await userEvent.type(passwordInput, 'password')
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled()
        // Should NOT redirect to 2FA (developer user skips it)
        expect(mockNavigate).not.toHaveBeenCalledWith('/auth/verify-2fa', expect.any(Object))
      })

      // Avatar menu should appear immediately (2FA skipped)
      expect(await screen.findByRole('button', { name: /dev menu/i })).toBeInTheDocument()
    })
  })

  describe('Normal User (Non-Admin) Navigation', () => {
    it('should show only "Your Channels" button for non-admin users', async () => {
      const normalUser = {
        id: '2',
        email: 'user@example.com',
        firstName: 'Normal',
        lastName: 'User',
        isPlatformAdmin: false,
        isDeveloperUser: false,
      }

      vi.mocked(storage.getToken).mockReturnValue('fake-user-token')
      vi.mocked(storage.getUser).mockReturnValue(normalUser)

      renderLoginPage()

      const avatarButton = await screen.findByRole('button', { name: /normal menu/i })
      await userEvent.click(avatarButton)

      expect(await screen.findByText(/Your Channels/i)).toBeInTheDocument()
      expect(screen.queryByText(/Go to backoffice/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Platform Admin/i)).not.toBeInTheDocument()
    })

    it('should auto-redirect normal user to workspace-selection after login', async () => {
      const normalUser = {
        id: '2',
        email: 'user@example.com',
        firstName: 'Normal',
        lastName: 'User',
        isPlatformAdmin: false,
        isDeveloperUser: false,
      }

      const mockLogin = vi.fn().mockResolvedValue({
        data: {
          user: normalUser,
          token: 'fake-user-token',
          sessionId: 'fake-user-session',
        },
      })
      vi.mocked(authService.login).mockImplementation(mockLogin)

      renderLoginPage()

      const emailInput = await screen.findByPlaceholderText(/your@email.com/i)
      const passwordInput = screen.getByPlaceholderText(/\*\*\*\*\*\*\*\*/i)
      const submitButton = screen.getByRole('button', { name: /^Sign In$/ })

      await userEvent.type(emailInput, 'user@example.com')
      await userEvent.type(passwordInput, 'password')
      await userEvent.click(submitButton)

      await waitFor(() => {
        // Normal user should be auto-redirected to workspace selection
        expect(mockNavigate).toHaveBeenCalledWith('/workspace-selection')
      })
    })
  })

  describe('Admin Badge Visibility', () => {
    it('should show "Platform Admin" badge in avatar dropdown', async () => {
      const adminUser = {
        id: '1',
        email: 'admin@echatbot.ai',
        firstName: 'Admin',
        lastName: 'User',
        isPlatformAdmin: true,
        isDeveloperUser: true,
      }

      vi.mocked(storage.getToken).mockReturnValue('fake-admin-token')
      vi.mocked(storage.getUser).mockReturnValue(adminUser)

      renderLoginPage()

      const avatarButton = await screen.findByRole('button', { name: /admin menu/i })
      await userEvent.click(avatarButton)

      const badge = await screen.findByText(/Platform Admin/i)
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('text-purple-600')
    })

    it('should NOT show Platform Admin badge for normal users', async () => {
      const normalUser = {
        id: '2',
        email: 'user@example.com',
        firstName: 'Normal',
        lastName: 'User',
        isPlatformAdmin: false,
        isDeveloperUser: false,
      }

      vi.mocked(storage.getToken).mockReturnValue('fake-user-token')
      vi.mocked(storage.getUser).mockReturnValue(normalUser)

      renderLoginPage()

      const avatarButton = await screen.findByRole('button', { name: /normal menu/i })
      await userEvent.click(avatarButton)

      expect(screen.queryByText(/Platform Admin/i)).not.toBeInTheDocument()
    })
  })
})
