import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { SchedulersPage } from '../../src/pages/SchedulersPage'
import { api } from '../../src/services/api'
import { useAuth } from '../../src/contexts/AuthContext'

// Mock dependencies
vi.mock('../../src/services/api')
vi.mock('../../src/contexts/AuthContext')

const mockLogout = vi.fn()

const mockSchedulers = [
  {
    id: 'sched-1',
    jobName: 'whatsapp-channel-queue',
    isActive: true,
    lastRunAt: '2024-06-01T10:00:00Z',
    lastStatus: 'SUCCESS',
    lastError: null,
    lastDuration: 1500,
    nextRunAt: '2024-06-01T10:03:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T10:00:00Z'
  },
  {
    id: 'sched-2',
    jobName: 'short-urls-cleanup',
    isActive: true,
    lastRunAt: '2024-05-31T23:00:00Z',
    lastStatus: 'SUCCESS',
    lastError: null,
    lastDuration: 500,
    nextRunAt: '2024-06-01T23:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-05-31T23:00:00Z'
  },
  {
    id: 'sched-3',
    jobName: 'blocked-customers-cleanup',
    isActive: false,
    lastRunAt: null,
    lastStatus: 'NEVER_RUN',
    lastError: null,
    lastDuration: null,
    nextRunAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'sched-4',
    jobName: 'email-notification-queue',
    isActive: true,
    lastRunAt: '2024-06-01T09:55:00Z',
    lastStatus: 'FAILED',
    lastError: 'SMTP connection timeout',
    lastDuration: 30000,
    nextRunAt: '2024-06-01T10:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T09:55:00Z'
  }
]

describe('SchedulersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuth as Mock).mockReturnValue({ logout: mockLogout })
  })

  describe('Loading State', () => {
    it('shows loading spinner while fetching schedulers', async () => {
      ;(api.schedulers.getAll as Mock).mockReturnValue(new Promise(() => {}))
      
      render(<SchedulersPage />)
      
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Successful Data Load', () => {
    beforeEach(() => {
      ;(api.schedulers.getAll as Mock).mockResolvedValue({
        success: true,
        data: mockSchedulers
      })
    })

    it('renders scheduler list after loading', async () => {
      render(<SchedulersPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Schedulers')).toBeInTheDocument()
      })
    })

    it('displays scheduler job names', async () => {
      render(<SchedulersPage />)
      
      await waitFor(() => {
        // Job names are mapped to friendly names in the component
        expect(screen.getByText('WhatsApp Channel Queue')).toBeInTheDocument()
        expect(screen.getByText('Short URLs Cleanup')).toBeInTheDocument()
      })
    })

    it('shows job status badges', async () => {
      render(<SchedulersPage />)
      
      // Wait for page title to appear first
      await waitFor(() => {
        expect(screen.getByText('Schedulers')).toBeInTheDocument()
      })
      
      // Then wait for status badges
      await waitFor(() => {
        expect(screen.getAllByText('Success').length).toBeGreaterThan(0)
      })
      
      expect(screen.getByText('Failed')).toBeInTheDocument()
      expect(screen.getByText('Never Run')).toBeInTheDocument()
    })

    it('shows error message for failed jobs', async () => {
      render(<SchedulersPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/SMTP connection timeout/)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message on API failure', async () => {
      ;(api.schedulers.getAll as Mock).mockResolvedValue({
        success: false,
        error: 'Failed to fetch schedulers'
      })
      
      render(<SchedulersPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch schedulers')).toBeInTheDocument()
      })
    })

    it('shows error on network failure', async () => {
      ;(api.schedulers.getAll as Mock).mockRejectedValue(new Error('Network error'))
      
      render(<SchedulersPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load scheduler jobs/i)).toBeInTheDocument()
      })
    })
  })

  describe('User Actions', () => {
    beforeEach(() => {
      ;(api.schedulers.getAll as Mock).mockResolvedValue({
        success: true,
        data: mockSchedulers
      })
    })

    it('has Refresh button', async () => {
      render(<SchedulersPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
    })

    it('has Logout button that calls logout', async () => {
      render(<SchedulersPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Logout'))
      expect(mockLogout).toHaveBeenCalled()
    })

    it('calls API again when Refresh is clicked', async () => {
      render(<SchedulersPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Refresh'))
      
      await waitFor(() => {
        expect(api.schedulers.getAll).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Scheduler Toggle', () => {
    beforeEach(() => {
      ;(api.schedulers.getAll as Mock).mockResolvedValue({
        success: true,
        data: mockSchedulers
      })
      ;(api.schedulers.update as Mock).mockResolvedValue({
        success: true,
        data: { id: 'sched-1', isActive: false }
      })
    })

    it('has toggle switches for schedulers', async () => {
      render(<SchedulersPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Schedulers')).toBeInTheDocument()
      })
      
      const switches = document.querySelectorAll('[role="switch"]')
      expect(switches.length).toBeGreaterThan(0)
    })

    it('calls update API when toggle is clicked', async () => {
      render(<SchedulersPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Schedulers')).toBeInTheDocument()
      })
      
      const switches = document.querySelectorAll('[role="switch"]')
      if (switches.length > 0) {
        fireEvent.click(switches[0])
        
        await waitFor(() => {
          expect(api.schedulers.update).toHaveBeenCalled()
        })
      }
    })
  })

  describe('Empty State', () => {
    it('shows message when no schedulers found', async () => {
      ;(api.schedulers.getAll as Mock).mockResolvedValue({
        success: true,
        data: []
      })
      
      render(<SchedulersPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/No scheduler jobs found/i)).toBeInTheDocument()
      })
    })
  })
})