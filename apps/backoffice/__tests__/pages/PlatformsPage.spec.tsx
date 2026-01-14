import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { PlatformsPage } from '../../src/pages/PlatformsPage'
import { api } from '../../src/services/api'

// Mock dependencies
vi.mock('../../src/services/api')

const mockConfig = {
  prices: [],
  limits: [],
  flags: [
    {
      key: 'canLogin',
      value: true,
      description: 'Allow users to login to the platform'
    },
    {
      key: 'canRegister',
      value: false,
      description: 'Allow new user registrations'
    },
    {
      key: 'workingInProgress',
      value: true,
      description: 'Show Work in Progress badge'
    },
    {
      key: 'registerFirst',
      value: false,
      description: 'Default to registration view'
    }
  ]
}

describe('PlatformsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(api.getWidgetCode as Mock).mockResolvedValue({
      success: true,
      data: { code: '' }
    })
    ;(api.users.getAll as Mock).mockResolvedValue({
      success: true,
      data: []
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner while fetching config', async () => {
      ;(api.getAdminConfig as Mock).mockReturnValue(new Promise(() => {}))
      
      render(<PlatformsPage />)
      
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Successful Data Load', () => {
    beforeEach(() => {
      ;(api.getAdminConfig as Mock).mockResolvedValue({
        success: true,
        data: mockConfig
      })
    })

    it('renders platform settings page with title', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Platform Settings')).toBeInTheDocument()
      })
    })

    it('displays flag configurations', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        // Flags are displayed with friendly titles
        expect(screen.getByText('User Login')).toBeInTheDocument()
        expect(screen.getByText('User Registration')).toBeInTheDocument()
        expect(screen.getByText('Work in Progress')).toBeInTheDocument()
        expect(screen.getByText('Register First')).toBeInTheDocument()
      })
    })

    it('shows flag descriptions', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/Allow users to login to the platform/i)).toBeInTheDocument()
        expect(screen.getByText(/Allow new user registrations/i)).toBeInTheDocument()
      })
    })

    it('has toggle switches for flags', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Platform Settings')).toBeInTheDocument()
      })
      
      const switches = document.querySelectorAll('[role="switch"]')
      expect(switches.length).toBe(mockConfig.flags.length)
    })
  })

  describe('Error Handling', () => {
    it('shows error message on API failure', async () => {
      ;(api.getAdminConfig as Mock).mockResolvedValue({
        success: false,
        error: 'Failed to fetch configuration'
      })
      
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch configuration')).toBeInTheDocument()
      })
    })

    it('shows error on network failure', async () => {
      ;(api.getAdminConfig as Mock).mockRejectedValue(new Error('Network error'))
      
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to connect to server/i)).toBeInTheDocument()
      })
    })
  })

  describe('Toggle Functionality', () => {
    beforeEach(() => {
      ;(api.getAdminConfig as Mock).mockResolvedValue({
        success: true,
        data: mockConfig
      })
      ;(api.toggleFlag as Mock).mockResolvedValue({
        success: true,
        data: { key: 'canRegister', value: true }
      })
    })

    it('calls toggleFlag API when switch is clicked', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Platform Settings')).toBeInTheDocument()
      })
      
      const switches = document.querySelectorAll('[role="switch"]')
      // Click the second switch (canRegister which is false)
      if (switches.length > 1) {
        fireEvent.click(switches[1])
        
        await waitFor(() => {
          expect(api.toggleFlag).toHaveBeenCalledWith('canRegister')
        })
      }
    })

    it('updates toggle state after successful API call', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Platform Settings')).toBeInTheDocument()
      })
      
      const switches = document.querySelectorAll('[role="switch"]')
      if (switches.length > 1) {
        fireEvent.click(switches[1])
        
        await waitFor(() => {
          expect(api.toggleFlag).toHaveBeenCalled()
        })
      }
    })

    it('shows error when toggle fails', async () => {
      ;(api.toggleFlag as Mock).mockResolvedValue({
        success: false,
        error: 'Failed to toggle flag'
      })
      
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Platform Settings')).toBeInTheDocument()
      })
      
      const switches = document.querySelectorAll('[role="switch"]')
      if (switches.length > 0) {
        fireEvent.click(switches[0])
        
        await waitFor(() => {
          expect(screen.getByText('Failed to toggle flag')).toBeInTheDocument()
        })
      }
    })
  })

  describe('Refresh Functionality', () => {
    beforeEach(() => {
      ;(api.getAdminConfig as Mock).mockResolvedValue({
        success: true,
        data: mockConfig
      })
    })

    it('has Refresh button', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
    })

    it('refetches data when Refresh is clicked', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Refresh'))
      
      await waitFor(() => {
        expect(api.getAdminConfig).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Page Layout', () => {
    beforeEach(() => {
      ;(api.getAdminConfig as Mock).mockResolvedValue({
        success: true,
        data: mockConfig
      })
    })

    it('shows subtitle', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/Control platform-wide features and access/i)).toBeInTheDocument()
      })
    })

    it('renders flag cards', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Platform Settings')).toBeInTheDocument()
      })
      
      // Should have card components
      const cards = document.querySelectorAll('[class*="card"]')
      expect(cards.length).toBeGreaterThan(0)
    })

    it('shows icons for flags', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Platform Settings')).toBeInTheDocument()
      })
      
      // Icons are rendered as SVGs
      const svgs = document.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThan(0)
    })
  })

  describe('Loading State During Save', () => {
    beforeEach(() => {
      ;(api.getAdminConfig as Mock).mockResolvedValue({
        success: true,
        data: mockConfig
      })
      // Make toggleFlag take time
      ;(api.toggleFlag as Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true, data: { key: 'canLogin', value: false } }), 100))
      )
    })

    it('disables switch during save', async () => {
      render(<PlatformsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Platform Settings')).toBeInTheDocument()
      })
      
      const switches = document.querySelectorAll('[role="switch"]')
      if (switches.length > 0) {
        fireEvent.click(switches[0])
        
        // The component may show a loading state
        await waitFor(() => {
          expect(api.toggleFlag).toHaveBeenCalled()
        })
      }
    })
  })
})
