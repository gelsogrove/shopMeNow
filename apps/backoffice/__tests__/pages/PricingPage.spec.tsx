import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { PricingPage } from '../../src/pages/PricingPage'
import { api } from '../../src/services/api'

// Mock dependencies
vi.mock('../../src/services/api')

const mockConfig = {
  prices: [
    {
      key: 'STARTER_MONTHLY',
      current: 9.99,
      original: 14.99,
      description: 'Starter plan monthly subscription'
    },
    {
      key: 'LLM_PRICE_PER_1K_INPUT_TOKENS',
      current: 0.15,
      original: 0.10,
      description: 'Price per 1K input tokens for LLM API calls'
    },
    {
      key: 'LLM_PRICE_PER_1K_OUTPUT_TOKENS',
      current: 0.60,
      original: 0.40,
      description: 'Price per 1K output tokens for LLM API calls'
    },
    {
      key: 'WHATSAPP_MESSAGE_PRICE',
      current: 0.05,
      original: null,
      description: 'Price per WhatsApp message sent'
    }
  ],
  limits: [
    {
      key: 'FREE_MESSAGES_PER_MONTH',
      value: 100,
      description: 'Free messages included per month'
    },
    {
      key: 'MAX_PRODUCTS_FREE_TIER',
      value: 50,
      description: 'Maximum products for free tier'
    }
  ],
  flags: []
}

describe('PricingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading State', () => {
    it('shows loading spinner while fetching config', async () => {
      ;(api.getAdminConfig as Mock).mockReturnValue(new Promise(() => {}))
      
      render(<PricingPage />)
      
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

    it('renders pricing page with title', async () => {
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Pricing Configuration')).toBeInTheDocument()
      })
    })

    it('displays price configurations', async () => {
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/LLM_PRICE_PER_1K_INPUT_TOKENS/i)).toBeInTheDocument()
        expect(screen.getByText(/LLM_PRICE_PER_1K_OUTPUT_TOKENS/i)).toBeInTheDocument()
        expect(screen.getByText(/WHATSAPP_MESSAGE_PRICE/i)).toBeInTheDocument()
      })
    })

    it('displays limit configurations', async () => {
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/FREE_MESSAGES_PER_MONTH/i)).toBeInTheDocument()
        expect(screen.getByText(/MAX_PRODUCTS_FREE_TIER/i)).toBeInTheDocument()
      })
    })

    it('shows price descriptions', async () => {
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/Price per 1K input tokens/i)).toBeInTheDocument()
      })
    })

    it('shows current price values', async () => {
      render(<PricingPage />)
      
      await waitFor(() => {
        // Values are displayed as currency with $
        expect(screen.getByText('$0.15')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message on API failure', async () => {
      ;(api.getAdminConfig as Mock).mockResolvedValue({
        success: false,
        error: 'Failed to fetch configuration'
      })
      
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch configuration')).toBeInTheDocument()
      })
    })

    it('shows error on network failure', async () => {
      ;(api.getAdminConfig as Mock).mockRejectedValue(new Error('Network error'))
      
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to connect to server/i)).toBeInTheDocument()
      })
    })
  })

  describe('Editing Prices', () => {
    beforeEach(() => {
      ;(api.getAdminConfig as Mock).mockResolvedValue({
        success: true,
        data: mockConfig
      })
      ;(api.updateConfig as Mock).mockResolvedValue({
        success: true,
        data: { key: 'LLM_PRICE_PER_1K_INPUT_TOKENS', value: 0.0002 }
      })
    })

    it('has edit buttons for prices', async () => {
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Pricing Configuration')).toBeInTheDocument()
      })
      
      // Should have edit buttons
      const editButtons = screen.getAllByRole('button')
      expect(editButtons.length).toBeGreaterThan(0)
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
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
    })

    it('refetches data when Refresh is clicked', async () => {
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Refresh'))
      
      await waitFor(() => {
        expect(api.getAdminConfig).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Price Cards', () => {
    beforeEach(() => {
      ;(api.getAdminConfig as Mock).mockResolvedValue({
        success: true,
        data: mockConfig
      })
    })

    it('shows original price when available', async () => {
      render(<PricingPage />)
      
      // Wait for prices to fully render including original price
      await waitFor(() => {
        expect(screen.getByText('Pricing Configuration')).toBeInTheDocument()
        expect(screen.getByText(/STARTER_MONTHLY/i)).toBeInTheDocument()
        // Original price $14.99 displayed as strikethrough in planPrices section
        expect(screen.getByText(/\$14\.99/)).toBeInTheDocument()
      })
    })

    it('renders price cards for each config', async () => {
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Pricing Configuration')).toBeInTheDocument()
      })
      
      // Should have multiple cards
      const cards = document.querySelectorAll('[class*="card"]')
      expect(cards.length).toBeGreaterThan(0)
    })
  })

  describe('Limit Cards', () => {
    beforeEach(() => {
      ;(api.getAdminConfig as Mock).mockResolvedValue({
        success: true,
        data: mockConfig
      })
    })

    it('displays limit values', async () => {
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument() // FREE_MESSAGES_PER_MONTH
        expect(screen.getByText('50')).toBeInTheDocument() // MAX_PRODUCTS_FREE_TIER
      })
    })

    it('shows limit descriptions', async () => {
      render(<PricingPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/Free messages included per month/i)).toBeInTheDocument()
      })
    })
  })
})
