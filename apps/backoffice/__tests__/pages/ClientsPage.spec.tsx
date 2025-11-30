import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { ClientsPage } from '../../src/pages/ClientsPage'
import { api } from '../../src/services/api'
import { useAuth } from '../../src/contexts/AuthContext'

// Mock dependencies
vi.mock('../../src/services/api')
vi.mock('../../src/contexts/AuthContext')

const mockLogout = vi.fn()

const mockUsers = [
  {
    id: 'user-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    isPlatformAdmin: false,
    isDeveloperUser: false,
    twoFactorEnabled: true,
    status: 'ACTIVE',
    createdAt: '2024-01-15T10:00:00Z',
    lastLogin: '2024-06-01T14:30:00Z',
    companyName: 'ACME Corp',
    phoneNumber: '+1234567890',
    profilePicture: null,
    authProvider: 'credentials',
    isOwner: true,
    ownedWorkspaces: [
      {
        id: 'ws-1',
        name: 'Test Workspace',
        slug: 'test-ws',
        creditBalance: 50.00,
        planType: 'FREE',
        language: 'ENG',
        isActive: true,
        whatsappPhoneNumber: '+1987654321',
        channelStatus: true,
        numCustomers: 25,
        numProducts: 100
      }
    ],
    totalCredit: 50.00,
    totalCustomers: 25,
    totalProducts: 100
  },
  {
    id: 'user-2',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    isPlatformAdmin: false,
    isDeveloperUser: false,
    twoFactorEnabled: false,
    status: 'ACTIVE',
    createdAt: '2024-02-20T08:00:00Z',
    lastLogin: null,
    companyName: null,
    phoneNumber: null,
    profilePicture: null,
    authProvider: 'google',
    isOwner: true,
    ownedWorkspaces: [],
    totalCredit: 0,
    totalCustomers: 0,
    totalProducts: 0
  }
]

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuth as Mock).mockReturnValue({ logout: mockLogout })
  })

  describe('Loading State', () => {
    it('shows loading spinner while fetching users', async () => {
      // Never resolve to keep loading
      ;(api.users.getAll as Mock).mockReturnValue(new Promise(() => {}))
      
      render(<ClientsPage />)
      
      // Should show spinner (Loader2 icon has animate-spin class)
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Successful Data Load', () => {
    beforeEach(() => {
      ;(api.users.getAll as Mock).mockResolvedValue({
        success: true,
        data: mockUsers
      })
    })

    it('renders user list after loading', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Client Management')).toBeInTheDocument()
      })
      
      // Should show user count
      expect(screen.getByText(/2 users registered/)).toBeInTheDocument()
    })

    it('displays user information', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument()
      })
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    })

    it('shows company name when available', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('ACME Corp')).toBeInTheDocument()
      })
    })

    it('shows workspace information', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Workspace')).toBeInTheDocument()
      })
      
      // Should show customer count
      expect(screen.getByText(/25/)).toBeInTheDocument()
    })

    it('shows 2FA badge when enabled', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('2FA')).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    beforeEach(() => {
      ;(api.users.getAll as Mock).mockResolvedValue({
        success: true,
        data: mockUsers
      })
    })

    it('has search input with correct placeholder', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Client Management')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/Search by email, name, or company/i)
      expect(searchInput).toBeInTheDocument()
    })

    it('filters users by email', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/Search by email, name, or company/i)
      fireEvent.change(searchInput, { target: { value: 'jane' } })
      
      await waitFor(() => {
        expect(screen.queryByText('john@example.com')).not.toBeInTheDocument()
      })
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    })

    it('filters users by company name', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Client Management')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/Search by email, name, or company/i)
      fireEvent.change(searchInput, { target: { value: 'ACME' } })
      
      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument()
        expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message on API failure', async () => {
      ;(api.users.getAll as Mock).mockResolvedValue({
        success: false,
        error: 'Failed to fetch users'
      })
      
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch users')).toBeInTheDocument()
      })
    })

    it('shows error on network failure', async () => {
      ;(api.users.getAll as Mock).mockRejectedValue(new Error('Network error'))
      
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load users/i)).toBeInTheDocument()
      })
    })
  })

  describe('User Actions', () => {
    beforeEach(() => {
      ;(api.users.getAll as Mock).mockResolvedValue({
        success: true,
        data: mockUsers
      })
    })

    it('has Refresh button', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
    })

    it('has Logout button that calls logout', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Logout'))
      expect(mockLogout).toHaveBeenCalled()
    })

    it('calls API again when Refresh is clicked', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Refresh'))
      
      // Should call getAll again
      await waitFor(() => {
        expect(api.users.getAll).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Status Toggle', () => {
    beforeEach(() => {
      ;(api.users.getAll as Mock).mockResolvedValue({
        success: true,
        data: mockUsers
      })
      ;(api.users.updateStatus as Mock).mockResolvedValue({
        success: true,
        data: { id: 'user-1', status: 'DISABLED' }
      })
    })

    it('has toggle switches for users', async () => {
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Client Management')).toBeInTheDocument()
      })
      
      // Should have switch elements
      const switches = document.querySelectorAll('[role="switch"]')
      expect(switches.length).toBeGreaterThan(0)
    })
  })

  describe('Empty State', () => {
    it('shows message when no users found', async () => {
      ;(api.users.getAll as Mock).mockResolvedValue({
        success: true,
        data: []
      })
      
      render(<ClientsPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/No users found/i)).toBeInTheDocument()
      })
    })
  })
})
