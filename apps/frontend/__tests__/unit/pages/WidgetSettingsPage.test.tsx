/**
 * @file WidgetSettingsPage.test.tsx
 * @description Unit tests for Widget Settings Page - configuration persistence and logo separation
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import WidgetSettingsPage from '../../../src/pages/WidgetSettingsPage'
import { WorkspaceProvider } from '../../../src/contexts/WorkspaceContext'
import { LanguageProvider } from '../../../src/contexts/LanguageContext'
import * as workspaceApi from '../../../src/services/workspaceApi'
import { api } from '../../../src/services/api'
import { toast } from '../../../src/lib/toast'

// Mock API services
vi.mock('../../../src/services/workspaceApi')
vi.mock('../../../src/services/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}))
vi.mock('../../../src/hooks/useGlobalNewMessageNotifier', () => ({
  useGlobalNewMessageNotifier: vi.fn(),
}))
vi.mock('../../../src/components/shared/ImageCropUpload', () => ({
  ImageCropUpload: ({ onImageSelected }: { onImageSelected: (file: File) => void }) => (
    <button
      type="button"
      data-testid="image-upload-trigger"
      onClick={() =>
        onImageSelected(new File(['logo'], 'logo.png', { type: 'image/png' }))
      }
    >
      Upload
    </button>
  ),
}))

// Mock toast
vi.mock('../../../src/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockWorkspace = {
  id: 'test-workspace-id',
  name: 'Test Workspace',
  logoUrl: '/uploads/channels/channel-logo.png', // Channel logo (admin UI)
  widgetLogoUrl: '/uploads/users/widget-logo.png', // Legacy field (no longer used)
  widgetTitle: 'Customer Support',
  widgetLanguage: 'it',
  widgetPrimaryColor: '#22c55e',
  widgetIcon: 'chat',
}

const renderWithProviders = (
  component: React.ReactElement,
  workspace = mockWorkspace
) => {
  return render(
    <BrowserRouter>
      <LanguageProvider>
        <WorkspaceProvider initialWorkspace={workspace as any}>
          {component}
        </WorkspaceProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}

describe('WidgetSettingsPage - Configuration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(api.get as any).mockResolvedValue({ data: mockWorkspace })
    ;(api.put as any).mockResolvedValue({ data: mockWorkspace })
    ;(api.post as any).mockResolvedValue({ data: { logoUrl: '/uploads/users/new-logo.png' } })
  })

  describe('Initial Load - useEffect', () => {
    it('should load logoUrl, widgetTitle, widgetLanguage, widgetPrimaryColor on mount', async () => {
      renderWithProviders(<WidgetSettingsPage />)

      await waitFor(() => {
        const titleInput = screen.getByLabelText(/Widget Title/i)
        expect(titleInput).toHaveValue('Customer Support')
      })
    })

    it('should load default values if widget config is null', async () => {
      const workspaceWithoutWidget = {
        ...mockWorkspace,
        widgetLogoUrl: null,
        widgetTitle: null,
        widgetLanguage: 'it',
        widgetPrimaryColor: '#22c55e',
      }

      ;(api.get as any).mockResolvedValue({ data: workspaceWithoutWidget })

      renderWithProviders(<WidgetSettingsPage />, workspaceWithoutWidget)

      await waitFor(() => {
        const titleInput = screen.getByLabelText(/Widget Title/i)
        expect(titleInput).toHaveValue('Test Workspace')
      })
    })

    it('should NOT use widgetLogoUrl when logoUrl is provided', async () => {
      const workspace = {
        ...mockWorkspace,
        logoUrl: '/uploads/channels/admin-logo.png', // Different from widget
        widgetLogoUrl: '/uploads/users/customer-widget-logo.png',
      }

      ;(api.get as any).mockResolvedValue({ data: workspace })

      renderWithProviders(<WidgetSettingsPage />, workspace)

      await waitFor(() => {
        // Embed code should use logoUrl, not widgetLogoUrl
        const embedCodeElement = screen.getByText(/window.eChatbotConfig/i)
        expect(embedCodeElement.textContent).toContain('admin-logo.png')
        expect(embedCodeElement.textContent).not.toContain('customer-widget-logo.png')
      })
    })
  })

  describe('Configuration Save - handleSaveConfig', () => {
    it('should save widgetTitle, widgetLanguage, widgetPrimaryColor via PUT', async () => {
      renderWithProviders(<WidgetSettingsPage />)

      // Change title
      const titleInput = screen.getByLabelText(/Widget Title/i)
      fireEvent.change(titleInput, { target: { value: 'New Support Chat' } })

      // Click Save Configuration button
      const saveButton = screen.getByText(/Save Configuration/i)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith(
          `/workspaces/${mockWorkspace.id}`,
          expect.objectContaining({
            widgetTitle: 'New Support Chat',
            widgetLanguage: 'it',
            widgetPrimaryColor: expect.any(String),
            widgetIcon: 'chat',
          })
        )
      })
    })

    it('should update workspace context after successful save', async () => {
      const updatedWorkspace = {
        ...mockWorkspace,
        widgetTitle: 'Updated Chat Title',
      }

      ;(api.put as any).mockResolvedValue({ data: updatedWorkspace })

      renderWithProviders(<WidgetSettingsPage />)

      const titleInput = screen.getByLabelText(/Widget Title/i)
      fireEvent.change(titleInput, { target: { value: 'Updated Chat Title' } })

      const saveButton = screen.getByText(/Save Configuration/i)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Widget configuration saved!')
      })
    })

    it('should handle save errors gracefully', async () => {
      ;(api.put as any).mockRejectedValue({
        response: { status: 500, data: { error: 'Database error' } },
      })

      renderWithProviders(<WidgetSettingsPage />)

      const saveButton = screen.getByText(/Save Configuration/i)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to save configuration')
      })
    })
  })

  describe('Logo Upload - handleLogoUpload', () => {
    it('should upload logo and save as logoUrl', async () => {
      const newLogoUrl = '/uploads/users/new-widget-logo_123.png'
      ;(api.post as any).mockResolvedValue({ data: { logoUrl: newLogoUrl } })
      ;(api.put as any).mockResolvedValue({ data: { ...mockWorkspace, logoUrl: newLogoUrl } })

      renderWithProviders(<WidgetSettingsPage />)

      fireEvent.click(screen.getByTestId('image-upload-trigger'))

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          `/workspaces/${mockWorkspace.id}/logo`,
          expect.any(FormData),
          expect.objectContaining({
            headers: { "Content-Type": "multipart/form-data" },
          })
        )
      })
    })

    it('should show error when upload is forbidden', async () => {
      ;(api.post as any).mockRejectedValue({
        response: { status: 403, data: { error: 'Permission denied' } },
      })

      renderWithProviders(<WidgetSettingsPage />)

      fireEvent.click(screen.getByTestId('image-upload-trigger'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Permission denied. Only workspace owners can upload logos.'
        )
      })
    })
  })

  describe('Data Persistence - Page Refresh', () => {
    it('should persist configuration after page reload', async () => {
      // First render - user configures widget
      const { unmount } = renderWithProviders(<WidgetSettingsPage />)

      const titleInput = screen.getByLabelText(/Widget Title/i)
      fireEvent.change(titleInput, { target: { value: 'Persistent Chat' } })

      const saveButton = screen.getByText(/Save Configuration/i)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(api.put).toHaveBeenCalled()
      })

      // Simulate page reload
      unmount()

      const updatedWorkspace = {
        ...mockWorkspace,
        widgetTitle: 'Persistent Chat',
      }
      ;(api.get as any).mockResolvedValue({ data: updatedWorkspace })

      // Re-render (simulating page refresh)
      renderWithProviders(<WidgetSettingsPage />, updatedWorkspace)

      await waitFor(() => {
        const titleInputAfterRefresh = screen.getByLabelText(/Widget Title/i)
        expect(titleInputAfterRefresh).toHaveValue('Persistent Chat')
      })
    })

    it('should show saved logoUrl in preview after refresh', async () => {
      const savedLogoUrl = '/uploads/users/saved-widget-logo.png'
      const workspaceAfterRefresh = {
        ...mockWorkspace,
        logoUrl: savedLogoUrl,
      }

      ;(api.get as any).mockResolvedValue({ data: workspaceAfterRefresh })

      renderWithProviders(<WidgetSettingsPage />, workspaceAfterRefresh)

      await waitFor(() => {
        const logoImg = screen.getByAltText('Chat')
        expect(logoImg.getAttribute('src')).toContain(savedLogoUrl)
      })
    })
  })

  describe('Embed Code Generation', () => {
    it('should generate embed code with logoUrl', async () => {
      renderWithProviders(<WidgetSettingsPage />)

      await waitFor(() => {
        const embedCode = screen.getByText(/window.eChatbotConfig/i)
        const codeText = embedCode.textContent || ''

        // Should contain logoUrl (single source of truth)
        expect(codeText).toContain(mockWorkspace.logoUrl)
      })
    })

    it('should include all widget config in embed code', async () => {
      renderWithProviders(<WidgetSettingsPage />)

      await waitFor(() => {
        const embedCode = screen.getByText(/window.eChatbotConfig/i)
        const codeText = embedCode.textContent || ''

        expect(codeText).toContain(mockWorkspace.widgetTitle)
        expect(codeText).toContain(mockWorkspace.widgetLanguage)
        expect(codeText).toContain(mockWorkspace.widgetPrimaryColor)
      })
    })
  })

  describe('Live Preview', () => {
    it('should show logoUrl in preview header', async () => {
      renderWithProviders(<WidgetSettingsPage />)

      await waitFor(() => {
        const logoImg = screen.getByAltText('Chat')
        expect(logoImg.getAttribute('src')).toContain('channel-logo.png')
      })
    })

    it('should update preview when color is changed', async () => {
      renderWithProviders(<WidgetSettingsPage />)

      // Change primary color
      const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement
      expect(colorInput).toBeTruthy()
      fireEvent.change(colorInput, { target: { value: '#ff5722' } })

      const previewButton = document.querySelector('button[data-widget-button]') as HTMLButtonElement
      expect(previewButton).toBeTruthy()

      fireEvent.click(previewButton)

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: mockWorkspace.widgetTitle })
        const header = heading.parentElement?.parentElement as HTMLElement | null
        expect(header).toBeTruthy()
        expect(header?.style.backgroundColor).toBe('rgb(255, 87, 34)')
      })
    })
  })
})
