import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WidgetLoader } from '@/components/WidgetLoader'

vi.mock('@/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ workspace: null }),
}))

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}))

describe('WidgetLoader', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    ;(global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            showWidgetChatbot: false,
            config: {
              workspaceId: 'ws-123',
              title: 'Widget',
              primaryColor: '#22c55e',
            },
          },
        }),
    })
    delete (window as any).eChatbotConfig
  })

  afterEach(() => {
    vi.clearAllMocks()
    ;(global as any).fetch = originalFetch
    delete (window as any).eChatbotConfig
  })

  it('does not inject widget config when flag showWidgetChatbot is false', async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <WidgetLoader />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect((window as any).eChatbotConfig).toBeUndefined()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/platform-config/widget-config')
    )
  })
})
