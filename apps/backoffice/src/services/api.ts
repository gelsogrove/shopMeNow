/**
 * Backoffice API Service
 * 
 * Direct connection to database via fetch to backend API
 * Since we can't use Prisma directly in browser, we use the backend API
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

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
    console.log('🔐 [API] Setting token:', token.substring(0, 20) + '...')
    this.token = token
  }

  clearToken() {
    console.log('🔓 [API] Clearing token')
    this.token = null
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      console.log('📡 [API] Fetching:', `${API_BASE}${endpoint}`)
      console.log('🔑 [API] Token present:', !!this.token)
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers },
      })

      const data = await response.json()
      console.log('📦 [API] Response:', data)
      return data
    } catch (error) {
      console.error('❌ [API] Error:', error)
      return { success: false, error: 'Network error' }
    }
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
      ownedWorkspaces: Array<{
        id: string
        name: string
        slug: string
        creditBalance: number
        planType: string
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
     * Impersonate a user (login as user)
     * Returns a temporary token and sessionId to access the platform as that user
     */
    impersonate: async (userId: string): Promise<ApiResponse<{
      token: string
      sessionId: string
      user: { id: string; email: string; firstName: string | null; lastName: string | null }
      workspace: { id: string; name: string; slug: string }
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
    }
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

  logout() {
    this.clearToken()
  }
}

export const api = new BackofficeApi()
export type { PlatformConfig, ApiResponse }
