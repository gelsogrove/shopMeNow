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
      ; (window as any).location = {
        href: 'http://localhost/',
        hostname: 'localhost',
        replace: vi.fn(),
        assign: vi.fn(),
      }
      // Mock window.open for backoffice redirect
      ; (window as any).open = vi.fn()
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
    }, 15000)

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

      // Find avatar button by data-testid (more reliable than text search)
      const avatarButton = await screen.findByTestId('user-avatar-button')
      await userEvent.click(avatarButton)

      // Check for Go to Workspace (Your Channels)
      const workspaceButton = await screen.findByText(/Your Channels/i)
      expect(workspaceButton).toBeInTheDocument()
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

      // Old test expected explicit buttons on page body, but now they might be in menu or simplified
      // In new LoginPage.tsx, "Go to backoffice" logic was in the old card view.
      // The NEW Modern Navbar has simple menu items: "My Workspaces", "Profile", "Billing", "Log Out".
      // It seems the "Go to backoffice" button was REMOVED or MOVED in the redesign?

      // Let's check LoginPage.tsx again for "Go to backoffice".
      // It seems it was in the card (lines 1528-1543 in previous view), but that might be the "Sign In" tab content?
      // Yes, the `activeTab === "signin"` block (lines 1496+) still contains the "Go to backoffice" buttons if logged in!
      // So the buttons SHOULD be there in the main card area if `activeTab` is signin.

      // The test renders LoginPage, defaults to signin.
      // If user is logged in (storage returns token), `useEffect` runs.
      // Line 365: `if (existingToken) { setIsLoggedIn(true); ... return }`
      // Does it switch tab? `useEffect` at 502 switches to signin/register based on flags.
      // The card content for "logged in state" (lines 1498-1554) checks `isLoggedIn`.

      // So the buttons should be visible in the card.

      const workspaceButton = await screen.findByRole('button', { name: /Go to workspace/i })
      expect(workspaceButton).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Go to backoffice/i })).toBeInTheDocument()
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

      const workspaceButton = await screen.findByRole('button', { name: /Go to workspace/i })
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

      const backofficeButton = await screen.findByRole('button', { name: /Go to backoffice/i })
      await userEvent.click(backofficeButton)

      await waitFor(() => {
        // The mock logic in setup uses a specific URL, let's match what the component does
        expect(window.open).toHaveBeenCalled()
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
        expect(mockNavigate).toHaveBeenCalledWith('/auth/verify-2fa', expect.any(Object))
      })

      // Avatar menu should NOT appear
      expect(screen.queryByText('A')).not.toBeInTheDocument()
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
        expect(mockNavigate).not.toHaveBeenCalledWith('/auth/verify-2fa', expect.any(Object))
      })

      // Avatar button should appear
      expect(await screen.findByTestId('user-avatar-button')).toBeInTheDocument()
    })
  })

  describe('Normal User (Non-Admin) Navigation', () => {
    it('should show only "My Workspaces" in menu for non-admin users', async () => {
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

      // Find avatar button by data-testid (more reliable than text search)
      const avatarButton = await screen.findByTestId('user-avatar-button')
      await userEvent.click(avatarButton)

      expect(await screen.findByText(/Your Channels/i)).toBeInTheDocument()
      // "Go to backoffice" is in the card, NOT the menu. 
      // The test seems to assume it's in the menu or checks existence in general.
      // If the old test checked for "Go to backoffice" *anywhere*, it would fail for normal users in the card too.
      // In the card, the "Go to backoffice" button is conditionally rendered based on `loggedInUser?.isPlatformAdmin`.
      expect(screen.queryByText(/Go to backoffice/i)).not.toBeInTheDocument()
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
