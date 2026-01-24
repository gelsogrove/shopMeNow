/**
 * Backoffice API Service
 * 
 * Direct connection to database via fetch to backend API
 * Since we can't use Prisma directly in browser, we use the backend API
 */

// 🌐 ALWAYS use VITE_API_URL in production (backoffice is standalone app)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'

interface PlatformConfig {
  id: string
  type: 'PRICE' | 'FLAG' | 'LIMIT'
  key: string
  value: string
  originalValue: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

class BackofficeApi {
  private token: string | null = null

  setToken(token: string) {
    this.token = token
  }

  // Push Campaigns (WhatsApp only)
  pushCampaigns = {
    list: async (workspaceId: string): Promise<ApiResponse<any>> =>
      this.fetch(`/workspaces/${workspaceId}/push-campaigns`),
    get: async (workspaceId: string, id: string): Promise<ApiResponse<any>> =>
      this.fetch(`/workspaces/${workspaceId}/push-campaigns/${id}`),
    recipients: async (
      workspaceId: string,
      id: string,
      params: { skip?: number; take?: number; status?: string } = {}
    ): Promise<ApiResponse<any>> => {
      const query = new URLSearchParams()
      if (params.skip !== undefined) query.set('skip', String(params.skip))
      if (params.take !== undefined) query.set('take', String(params.take))
      if (params.status) query.set('status', params.status)
      return this.fetch(
        `/workspaces/${workspaceId}/push-campaigns/${id}/recipients?${query.toString()}`
      )
    },
    create: async (workspaceId: string, payload: any): Promise<ApiResponse<any>> =>
      this.fetch(`/workspaces/${workspaceId}/push-campaigns`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    schedule: async (workspaceId: string, id: string, sendAt?: string): Promise<ApiResponse<any>> =>
      this.fetch(`/workspaces/${workspaceId}/push-campaigns/${id}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ sendAt }),
      }),
    runNow: async (workspaceId: string, id: string): Promise<ApiResponse<any>> =>
      this.fetch(`/workspaces/${workspaceId}/push-campaigns/${id}/run-now`, {
        method: 'POST',
      }),
    pause: async (workspaceId: string, id: string): Promise<ApiResponse<any>> =>
      this.fetch(`/workspaces/${workspaceId}/push-campaigns/${id}/pause`, {
        method: 'POST',
      }),
    resume: async (workspaceId: string, id: string): Promise<ApiResponse<any>> =>
      this.fetch(`/workspaces/${workspaceId}/push-campaigns/${id}/resume`, {
        method: 'POST',
      }),
    cancel: async (workspaceId: string, id: string): Promise<ApiResponse<any>> =>
      this.fetch(`/workspaces/${workspaceId}/push-campaigns/${id}/cancel`, {
        method: 'POST',
      }),
  }

  clearToken() {
    this.token = null
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers },
      })

      const data = await response.json()
      
      // If response already has success property, return as-is
      // Otherwise wrap it in { success: true, data: ... }
      if ('success' in data) {
        return data
      }
      
      // Check if it's an error response
      if (!response.ok || data.error) {
        return { success: false, error: data.error || data.message || 'Request failed' }
      }
      
      return { success: true, data }
    } catch (error) {
      console.error('❌ [API] Error:', error)
      return { success: false, error: 'Network error' }
    }
  }

  // Generic HTTP methods for direct use
  async get(endpoint: string) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers,
    })

    return response
  }

  async post(endpoint: string, body: any) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    return response
  }

  async put(endpoint: string, body: any) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    })

    return response
  }

  // Platform Config - Public endpoints (no auth needed)
  async getPlatformConfig(): Promise<ApiResponse<{
    prices: Record<string, { current: number; original: number | null }>
    flags: Record<string, boolean>
    limits: Record<string, number>
  }>> {
    return this.fetch('/platform-config')
  }

  // Platform Config - Admin endpoints
  async getAdminConfig(): Promise<ApiResponse<{
    prices: Array<{ key: string; current: number; original: number | null; description: string | null }>
    flags: Array<{ key: string; value: boolean; description: string | null }>
    limits: Array<{ key: string; value: number; description: string | null }>
  }>> {
    return this.fetch('/platform-config/admin')
  }

  async updateConfig(key: string, value: string, originalValue?: string): Promise<ApiResponse<PlatformConfig>> {
    return this.fetch(`/platform-config/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value, originalValue }),
    })
  }

  async toggleFlag(key: string): Promise<ApiResponse<{ key: string; value: boolean }>> {
    return this.fetch(`/platform-config/flags/${key}/toggle`, {
      method: 'POST',
    })
  }

  async invalidateCache(): Promise<ApiResponse<{ message: string }>> {
    return this.fetch('/platform-config/cache/invalidate', {
      method: 'POST',
    })
  }

  async getWidgetCode(): Promise<ApiResponse<{ code: string | null }>> {
    return this.fetch('/platform-config/widget-code')
  }

  async saveWidgetCode(code: string): Promise<ApiResponse<{ message: string }>> {
    return this.fetch('/platform-config/widget-code', {
      method: 'PUT',
      body: JSON.stringify({ code }),
    })
  }

  // Auth - Real authentication via Backend API
  auth = {
    /**
     * Login via backend API
     * Returns JWT token if user is platform admin
     */
    login: async (email: string, password: string): Promise<ApiResponse<{
      token: string
      user: {
        id: string
        email: string
        firstName?: string
        lastName?: string
        isPlatformAdmin: boolean
      }
    }>> => {
      try {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        })

        const data = await response.json()

        if (!response.ok) {
          return { success: false, error: data.error || 'Login failed' }
        }

        // Check if user is platform admin
        if (!data.user?.isPlatformAdmin) {
          return { success: false, error: 'Platform admin access required' }
        }

        // Set token for future requests
        this.setToken(data.token)

        return { 
          success: true, 
          data: {
            token: data.token,
            user: data.user,
          }
        }
      } catch (error) {
        console.error('Login error:', error)
        return { success: false, error: 'Network error' }
      }
    },

    /**
     * Verify current token is valid
     */
    verifyToken: async (): Promise<ApiResponse<{ valid: boolean }>> => {
      return this.fetch('/auth/me')
    }
  }

  // Users - Admin endpoints for managing user permissions
  users = {
    /**
     * Get all users with their permissions and workspace stats
     */
    getAll: async (): Promise<ApiResponse<Array<{
      id: string
      email: string
      firstName: string | null
      lastName: string | null
      isPlatformAdmin: boolean
      isDeveloperUser: boolean
      twoFactorEnabled: boolean
      requires2FA: boolean
      status: string
      createdAt: string
      lastLogin: string | null
      companyName: string | null
      phoneNumber: string | null
      profilePicture: string | null
      authProvider: string
      isOwner: boolean
      // Feature 198: Owner-level billing (primary source of truth)
      planType: string
      subscriptionStatus: string
      creditBalance: number
      planStartedAt: string | null
      pendingPlanType: string | null
      pendingPlanEffectiveDate: string | null
      pausedAt: string | null
      pauseRequestedAt: string | null
      // Legacy: workspaces data
      ownedWorkspaces: Array<{
        id: string
        name: string
        slug: string
        creditBalance: number
        planType: string
        subscriptionStatus: string // Legacy, deprecated
        planStartedAt: string
        language: string
        isActive: boolean
        whatsappPhoneNumber: string | null
        channelStatus: boolean
        numCustomers: number
        numProducts: number
      }>
      totalCredit: number
      totalCustomers: number
      totalProducts: number
    }>>> => {
      return this.fetch('/users/admin/list')
    },

    /**
     * Get all WhatsApp/widget queue messages (admin)
     */
    getQueue: async (): Promise<ApiResponse<any[]>> => {
      return this.fetch('/users/admin/whatsapp-queue')
    },

    /**
     * Update user permissions (isPlatformAdmin, isDeveloperUser)
     */
    updatePermissions: async (
      userId: string, 
      permissions: { isPlatformAdmin?: boolean; isDeveloperUser?: boolean }
    ): Promise<ApiResponse<{ success: boolean }>> => {
      return this.fetch(`/users/admin/${userId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify(permissions),
      })
    },

    /**
     * Update user status (ACTIVE/DISABLED)
     */
    updateStatus: async (
      userId: string,
      status: 'ACTIVE' | 'DISABLED'
    ): Promise<ApiResponse<{ id: string; email: string; status: string }>> => {
      return this.fetch(`/users/admin/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
    },

    /**
     * Update subscription status (ACTIVE/PAUSED/PAYMENT_FAILED)
     */
    updateSubscriptionStatus: async (
      userId: string,
      payload: { subscriptionStatus: 'ACTIVE' | 'PAUSED' | 'PAYMENT_FAILED'; adminNotes?: string }
    ): Promise<ApiResponse<{
      subscriptionStatus: string
      paymentFailureCount: number
      lastPaymentFailedAt: string | null
      pausedAt: string | null
      pauseRequestedAt: string | null
    }>> => {
      return this.fetch(`/users/admin/${userId}/subscription-status`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    },

    /**
     * Get current month invoices for all owners
     */
    getCurrentInvoices: async (): Promise<ApiResponse<Array<{
      owner: {
        id: string
        email: string
        firstName: string | null
        lastName: string | null
        companyName: string | null
        planType: string
        subscriptionStatus: string
        creditBalance: number
        paymentFailureCount: number
        lastPaymentFailedAt: string | null
      }
      invoice: {
        id: string
        invoiceNumber?: string | null
        periodMonth: number
        periodYear: number
        totalAmount: number
        status: string
        paidAt: string | null
        adminNotes: string | null
        adminMarkedById: string | null
        adminMarkedAt: string | null
      }
    }>>> => {
      return this.fetch('/users/admin/invoices/current')
    },

    /**
     * Get invoice history for all owners (optional month/year filter)
     */
    getInvoiceHistory: async (params: {
      periodMonth?: number
      periodYear?: number
      page?: number
      pageSize?: number
    }): Promise<ApiResponse<Array<{
      owner: {
        id: string
        email: string
        firstName: string | null
        lastName: string | null
        companyName: string | null
        planType: string
        subscriptionStatus: string
        creditBalance: number
        paymentFailureCount: number
        lastPaymentFailedAt: string | null
      }
      invoice: {
        id: string
        invoiceNumber?: string | null
        periodMonth: number
        periodYear: number
        totalAmount: number
        subtotalAmount?: number
        taxAmount?: number
        creditNotesTotal?: number
        status: string
        paidAt: string | null
        adminNotes: string | null
        adminMarkedById: string | null
        adminMarkedAt: string | null
        creditNotes?: Array<{ id: string; amount: number; reason: string | null; createdAt: string }>
      }
    }>>> => {
      const searchParams = new URLSearchParams()
      if (params.periodMonth) searchParams.set('periodMonth', String(params.periodMonth))
      if (params.periodYear) searchParams.set('periodYear', String(params.periodYear))
      if (params.page) searchParams.set('page', String(params.page))
      if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))

      const query = searchParams.toString()
      return this.fetch(`/users/admin/invoices/history${query ? `?${query}` : ''}`)
    },

    /**
     * Get unpaid invoices (previous months only)
     */
    getUnpaidInvoices: async (): Promise<ApiResponse<Array<{
      owner: {
        id: string
        email: string
        firstName: string | null
        lastName: string | null
        companyName: string | null
        planType: string
        subscriptionStatus: string
        creditBalance: number
        paymentFailureCount: number
        lastPaymentFailedAt: string | null
      }
      invoice: {
        id: string
        invoiceNumber?: string | null
        periodMonth: number
        periodYear: number
        totalAmount: number
        subtotalAmount?: number
        taxAmount?: number
        creditNotesTotal?: number
        status: string
        paidAt: string | null
        adminNotes: string | null
        adminMarkedById: string | null
        adminMarkedAt: string | null
      }
    }>>> => {
      return this.fetch('/users/admin/invoices/unpaid')
    },

    /**
     * Get failed invoices (previous months only)
     */
    getFailedInvoices: async (): Promise<ApiResponse<Array<{
      owner: {
        id: string
        email: string
        firstName: string | null
        lastName: string | null
        companyName: string | null
        planType: string
        subscriptionStatus: string
        creditBalance: number
        paymentFailureCount: number
        lastPaymentFailedAt: string | null
      }
      invoice: {
        id: string
        invoiceNumber?: string | null
        periodMonth: number
        periodYear: number
        totalAmount: number
        subtotalAmount?: number
        taxAmount?: number
        creditNotesTotal?: number
        status: string
        paidAt: string | null
        adminNotes: string | null
        adminMarkedById: string | null
        adminMarkedAt: string | null
      }
    }>>> => {
      return this.fetch('/users/admin/invoices/failed')
    },

    /**
     * Get monthly invoice summary for analytics
     */
    getInvoiceSummary: async (months: number = 12): Promise<ApiResponse<Array<{
      periodYear: number
      periodMonth: number
      totalAmount: number
      invoiceCount: number
      userCount: number
    }>>> => {
      const query = new URLSearchParams({ months: String(months) })
      return this.fetch(`/users/admin/invoices/summary?${query.toString()}`)
    },

    /**
     * Get complete revenue and usage statistics for analytics dashboard
     */
    getRevenueStats: async (months: number = 12): Promise<ApiResponse<{
      monthSeries: Array<{
        periodYear: number
        periodMonth: number
        revenue: number
        userCount: number
        whatsappMessages: number
        widgetMessages: number
        totalMessages: number
        pushCampaigns: number
        pushRecipients: number
      }>
      totals: {
        revenue: number
        whatsappMessages: number
        widgetMessages: number
        totalMessages: number
        pushCampaigns: number
        pushRecipients: number
      }
    }>> => {
      const query = new URLSearchParams({ months: String(months) })
      return this.fetch(`/users/admin/analytics/revenue-stats?${query.toString()}`)
    },

    /**
     * Record a payment failure for a user (increments failure count)
     */
    recordPaymentFailure: async (
      userId: string,
      adminNotes?: string
    ): Promise<ApiResponse<{
      paymentFailureCount: number
      subscriptionStatus: string
      lastPaymentFailedAt: string
      blocked: boolean
    }>> => {
      return this.fetch(`/users/admin/${userId}/payment-failure`, {
        method: 'POST',
        body: JSON.stringify({ adminNotes }),
      })
    },

    /**
     * Reset payment failure status for a user
     */
    resetPaymentFailure: async (
      userId: string,
      adminNotes?: string
    ): Promise<ApiResponse<{
      paymentFailureCount: number
      subscriptionStatus: string
    }>> => {
      return this.fetch(`/users/admin/${userId}/payment-reset`, {
        method: 'POST',
        body: JSON.stringify({ adminNotes }),
      })
    },

    /**
     * Update invoice status/notes (admin)
     */
    updateInvoice: async (
      invoiceId: string,
      payload: { status: string; adminNotes?: string }
    ): Promise<ApiResponse<{
      id: string
      status: string
      adminNotes: string | null
      adminMarkedById: string | null
      adminMarkedAt: string | null
      paidAt: string | null
    }>> => {
      return this.fetch(`/users/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    },

    /**
     * Get invoice details (admin)
     */
    getInvoiceDetails: async (
      invoiceId: string
    ): Promise<ApiResponse<{
      id: string
      periodMonth: number
      periodYear: number
      status: string
      planType: string
      subscriptionAmount: number
      creditUsage: number
      creditDebt: number
      rechargesTotal: number
      adjustmentsTotal: number
      creditNotesTotal: number
      subtotalAmount: number
      taxRate: number
      taxAmount: number
      totalAmount: number
      adminNotes: string | null
    }>> => {
      return this.fetch(`/users/admin/invoices/${invoiceId}`)
    },

    /**
     * Download invoice PDF (admin)
     */
    downloadInvoicePdf: async (invoiceId: string): Promise<Blob> => {
      const headers: HeadersInit = {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      }
      const response = await fetch(`${API_BASE}/users/admin/invoices/${invoiceId}/pdf`, {
        headers,
      })

      if (!response.ok) {
        throw new Error('Failed to download invoice PDF')
      }

      return response.blob()
    },

    /**
     * Download credit note PDF (admin)
     */
    downloadCreditNotePdf: async (invoiceId: string, noteId: string): Promise<Blob> => {
      const headers: HeadersInit = {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      }
      const response = await fetch(
        `${API_BASE}/users/admin/invoices/${invoiceId}/credit-notes/${noteId}/pdf`,
        { headers }
      )

      if (!response.ok) {
        throw new Error('Failed to download credit note PDF')
      }

      return response.blob()
    },

    /**
     * Create credit note for invoice (admin)
     */
    createCreditNote: async (
      invoiceId: string,
      payload: { amount: number; reason?: string }
    ): Promise<ApiResponse<{ id: string; amount: number; reason: string | null; createdAt: string }>> => {
      return this.fetch(`/users/admin/invoices/${invoiceId}/credit-notes`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },

    /**
     * Get credit notes for invoice (admin)
     */
    getCreditNotes: async (
      invoiceId: string
    ): Promise<ApiResponse<Array<{ id: string; amount: number; reason: string | null; createdAt: string }>>> => {
      return this.fetch(`/users/admin/invoices/${invoiceId}/credit-notes`)
    },

    /**
     * Get adjustments for invoice (admin)
     */
    getInvoiceAdjustments: async (
      invoiceId: string
    ): Promise<ApiResponse<Array<{ id: string; amount: number; reason: string | null; createdAt: string }>>> => {
      return this.fetch(`/users/admin/invoices/${invoiceId}/adjustments`)
    },

    /**
     * Create adjustment for invoice (admin)
     */
    createInvoiceAdjustment: async (
      invoiceId: string,
      payload: { amount: number; reason?: string }
    ): Promise<ApiResponse<{ id: string; amount: number; reason: string | null; createdAt: string }>> => {
      return this.fetch(`/users/admin/invoices/${invoiceId}/adjustments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },

    /**
     * Update adjustment for invoice (admin)
     */
    updateInvoiceAdjustment: async (
      invoiceId: string,
      adjustmentId: string,
      payload: { amount?: number; reason?: string }
    ): Promise<ApiResponse<{ id: string; amount: number; reason: string | null; createdAt: string }>> => {
      return this.fetch(`/users/admin/invoices/${invoiceId}/adjustments/${adjustmentId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    },

    /**
     * Delete adjustment for invoice (admin)
     */
    deleteInvoiceAdjustment: async (
      invoiceId: string,
      adjustmentId: string
    ): Promise<ApiResponse<{ success: boolean }>> => {
      return this.fetch(`/users/admin/invoices/${invoiceId}/adjustments/${adjustmentId}`, {
        method: 'DELETE',
      })
    },

    /**
     * Update credit note (admin)
     */
    updateCreditNote: async (
      invoiceId: string,
      noteId: string,
      payload: { amount: number; reason?: string }
    ): Promise<ApiResponse<{ id: string; amount: number; reason: string | null; createdAt: string }>> => {
      return this.fetch(`/users/admin/invoices/${invoiceId}/credit-notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    },

    /**
     * Delete credit note (admin)
     */
    deleteCreditNote: async (invoiceId: string, noteId: string): Promise<ApiResponse<{ success: boolean }>> => {
      return this.fetch(`/users/admin/invoices/${invoiceId}/credit-notes/${noteId}`, {
        method: 'DELETE',
      })
    },

    /**
     * Get PayPal config + transactions for owner
     */
    getPayPalInfo: async (userId: string): Promise<ApiResponse<{
      owner: {
        id: string
        email: string
        paypalStatus: string
        isPaymentConnected: boolean
        paypalClientId: string | null
        paypalMerchantId: string | null
        paypalEmail: string | null
        paypalEnvironment: string | null
        paypalConnectedAt: string | null
      }
      transactions: Array<{
        id: string
        invoiceId: string | null
        invoicePeriod: string | null
        invoiceStatus: string | null
        amount: number
        currency: string
        status: string
        notes: string | null
        createdAt: string
      }>
    }>> => {
      return this.fetch(`/users/admin/${userId}/paypal`)
    },

    /**
     * Update PayPal config for owner (admin)
     */
    updatePayPalInfo: async (
      userId: string,
      payload: {
        paypalStatus?: string | null
        isPaymentConnected?: boolean
        paypalClientId?: string | null
        paypalMerchantId?: string | null
        paypalEmail?: string | null
        paypalEnvironment?: string | null
        paypalConnectedAt?: string | null
      }
    ): Promise<ApiResponse<{
      id: string
      email: string
      paypalStatus: string
      isPaymentConnected: boolean
      paypalClientId: string | null
      paypalMerchantId: string | null
      paypalEmail: string | null
      paypalEnvironment: string | null
      paypalConnectedAt: string | null
    }>> => {
      return this.fetch(`/users/admin/${userId}/paypal`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    },

    /**
     * Mock PayPal monthly payment for invoice
     */
    mockPayPalPayment: async (
      invoiceId: string,
      notes?: string
    ): Promise<ApiResponse<{ success: boolean; transactionId: string; status: string }>> => {
      return this.fetch(`/users/admin/invoices/${invoiceId}/paypal/mock-payment`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      })
    },

    /**
     * Get all PayPal transactions (for admin Transactions tab)
     */
    getPayPalTransactions: async (
      status?: 'SUCCESS' | 'FAILED',
      limit?: number
    ): Promise<ApiResponse<Array<{
      id: string
      userId: string
      userEmail: string | null
      userName: string | null
      invoiceId: string | null
      invoicePeriod: string | null
      invoiceStatus: string | null
      amount: number
      currency: string
      status: 'SUCCESS' | 'FAILED'
      notes: string | null
      adminUserId: string | null
      createdAt: string
    }>>> => {
      const params = new URLSearchParams()
      if (status) params.append('status', status)
      if (limit) params.append('limit', String(limit))
      const query = params.toString() ? `?${params.toString()}` : ''
      return this.fetch(`/users/admin/paypal/transactions${query}`)
    },

    /**
     * Impersonate a user (login as user)
     * Returns a temporary token and sessionId to access the platform as that user
     */
    impersonate: async (userId: string): Promise<ApiResponse<{
      token: string
      sessionId: string
      redirectUrl: string
      targetUser: { id: string; email: string; firstName: string | null; lastName: string | null }
    }>> => {
      return this.fetch(`/users/admin/${userId}/impersonate`, {
        method: 'POST',
      })
    },

    /**
     * Add bonus credits to a workspace (not invoiced)
     */
    addBonus: async (
      workspaceId: string,
      amount: number,
      reason: string
    ): Promise<ApiResponse<{
      workspaceId: string
      workspaceName: string
      ownerEmail: string
      bonusAmount: number
      previousBalance: number
      newBalance: number
      reason: string
      transactionId: string
    }>> => {
      return this.fetch(`/users/admin/${workspaceId}/bonus`, {
        method: 'POST',
        body: JSON.stringify({ amount, reason }),
      })
    },

    /**
     * Reset 2FA for a user (Feature 189)
     * Immediately disables their 2FA and sends reset email
     */
    reset2FA: async (
      userId: string
    ): Promise<ApiResponse<{
      success: boolean
      message: string
      expiresAt: string
    }>> => {
      return this.fetch(`/users/admin/${userId}/reset-2fa`, {
        method: 'POST',
      })
    },
    
    /**
     * Enable 2FA for a user (Feature 189)
     * Sends email with link to set up 2FA for users who don't have it
     */
    enable2FA: async (
      userId: string
    ): Promise<ApiResponse<{
      success: boolean
      message: string
      expiresAt: string
    }>> => {
      return this.fetch(`/users/admin/${userId}/enable-2fa`, {
        method: 'POST',
      })
    },

    /**
     * Extend trial period for a workspace
     * Only works for FREE_TRIAL workspaces
     */
    extendTrial: async (
      workspaceId: string,
      days: number,
      reason?: string
    ): Promise<ApiResponse<{
      workspaceId: string
      workspaceName: string
      ownerEmail: string
      previousStartDate: string
      newStartDate: string
      trialEndDate: string
      daysExtended: number
      daysRemaining: number
      reason: string | null
    }>> => {
      return this.fetch(`/users/admin/${workspaceId}/extend-trial`, {
        method: 'POST',
        body: JSON.stringify({ days, reason }),
      })
    },
    

  }

  // Scheduler Jobs - Admin endpoints for managing cron jobs
  schedulers = {
    /**
     * Get all scheduler jobs with their status
     */
    getAll: async (): Promise<ApiResponse<Array<{
      id: string
      jobName: string
      isActive: boolean
      lastRunAt: string | null
      lastStatus: string
      lastError: string | null
      lastDuration: number | null
      nextRunAt: string | null
      createdAt: string
      updatedAt: string
    }>>> => {
      return this.fetch('/schedulers')
    },

    /**
     * Update a scheduler job (toggle isActive)
     */
    update: async (
      jobName: string, 
      data: { isActive: boolean }
    ): Promise<ApiResponse<{
      id: string
      jobName: string
      isActive: boolean
    }>> => {
      return this.fetch(`/schedulers/${jobName}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
    }
  }

  // Trash Management - Admin endpoints for soft-deleted items (Feature 196)
  trash = {
    /**
     * Soft-delete a user (sends to trash with 90-day recovery window)
     */
    deleteUser: async (userId: string, data: { reason: string }): Promise<ApiResponse<{
      success: boolean
      message: string
      deletedAt: string
      recoveryWindowDays: number
    }>> => {
      return this.fetch(`/admin/users/${userId}/unsubscribe`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    /**
     * Get soft-deleted users (platform users/admins)
     */
    getUsers: async (page: number = 1, limit: number = 50): Promise<ApiResponse<{
      items: Array<{
        id: string
        email: string
        firstName: string
        lastName: string
        name: string
        role: string
        deletedAt: string
        daysUntilPermanentDelete: number
        workspaces: Array<{ id: string; name: string; role: string }>
      }>
      pagination: { page: number; limit: number; total: number; pages: number }
    }>> => {
      return this.fetch(`/admin/trash/users?page=${page}&limit=${limit}`)
    },

    /**
     * Get soft-deleted workspaces
     */
    getWorkspaces: async (page: number = 1, limit: number = 50): Promise<ApiResponse<{
      items: Array<{
        id: string
        name: string
        ownerEmail: string
        deletedAt: string
        daysUntilPermanentDelete: number
        customerCount: number
      }>
      pagination: { page: number; limit: number; total: number }
    }>> => {
      return this.fetch(`/admin/trash/workspaces?page=${page}&limit=${limit}`)
    },

    /**
     * Restore a soft-deleted item
     */
    restore: async (id: string, type: string): Promise<ApiResponse<{
      success: boolean
      message: string
      restoredAt: string
    }>> => {
      return this.fetch(`/admin/trash/${id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ entityType: type.toUpperCase() }),
      })
    },

    /**
     * Permanently delete an item (requires confirmation text)
     */
    permanentlyDelete: async (
      id: string, 
      type: string, 
      confirmationText: string
    ): Promise<ApiResponse<{
      success: boolean
      message: string
      deletedRecordCount: number
    }>> => {
      return this.fetch(`/admin/trash/${id}/permanently-delete`, {
        method: 'POST',
        body: JSON.stringify({ 
          entityType: type.toUpperCase(),
          confirmationText 
        }),
      })
    },

    /**
     * Get audit log of permanent deletions
     */
    getAuditLog: async (days: number = 30): Promise<ApiResponse<{
      logs: Array<{
        id: string
        entityType: string
        deletedIds: string[]
        recordCount: number
        reason: string
        deletedByUser: string
        deletedAt: string
      }>
    }>> => {
      return this.fetch(`/admin/trash/audit-log?days=${days}`)
    }
  }

  logout() {
    this.clearToken()
  }
}

export const api = new BackofficeApi()
export type { PlatformConfig, ApiResponse }
