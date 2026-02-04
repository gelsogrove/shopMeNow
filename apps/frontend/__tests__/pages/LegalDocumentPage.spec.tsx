import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { LegalDocumentPage } from '@/pages/LegalDocumentPage'
import { publicApi } from '@/services/publicApi'

vi.mock('@/services/publicApi', () => ({
  publicApi: {
    get: vi.fn(),
  },
}))

const mockDoc = {
  type: 'PRIVACY_POLICY',
  title: 'Privacy Policy',
  content: '<p>Test Privacy Content</p>',
  isActive: true,
}

describe('LegalDocumentPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(publicApi.get).mockResolvedValue({ data: mockDoc })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads legal document using public API without auth redirects', async () => {
    localStorage.setItem('userLanguage', 'it')

    render(
      <BrowserRouter>
        <LegalDocumentPage docType="PRIVACY_POLICY" />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(publicApi.get).toHaveBeenCalledWith(
        '/legal-documents/PRIVACY_POLICY?lang=it'
      )
    })

    expect(await screen.findByText('Test Privacy Content')).toBeInTheDocument()
  })
})
