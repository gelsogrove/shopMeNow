import { api } from "./api"
import { logger } from "@/lib/logger"

export interface UserProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string  // Optional personal phone number
  language?: string     // User's preferred language (ENG, ITA, ESP, POR, FRA, DEU)
  companyName?: string
  vatNumber?: string
  website?: string
  billingPhone?: string
  billingAddress?: string
  authProvider?: string  // 'email' | 'google' | 'multi' etc. (Feature 189)
  hasPassword?: boolean  // True if user has a password set (Feature 189)
  logo?: string          // Company logo URL
  twoFactorEnabled?: boolean // True if 2FA is enabled
}

export interface UpdateProfileData {
  firstName?: string
  lastName?: string
  email?: string
  phoneNumber?: string  // Optional personal phone number
  language?: string     // User's preferred language (ENG, ITA, ESP, POR, FRA, DEU)
  companyName?: string
  vatNumber?: string
  website?: string
  billingPhone?: string
  billingAddress?: string
  logo?: File           // Company logo file
  removeLogo?: boolean  // Flag to remove existing logo
}

export interface ChangePasswordData {
  currentPassword: string
  newPassword: string
}

// Get current user profile
export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    const response = await api.get("/auth/me")
    return response.data.user
  } catch (error) {
    logger.error("Error getting user profile:", error)
    throw error
  }
}

// Update user profile (supports logo upload via FormData)
export const updateUserProfile = async (data: UpdateProfileData): Promise<UserProfile> => {
  try {
    // Check if we have a logo file to upload
    const hasLogo = data.logo instanceof File
    const hasRemoveLogo = data.removeLogo
    
    logger.info("📤 updateUserProfile called:", { 
      hasLogo, 
      hasRemoveLogo, 
      logoType: data.logo ? typeof data.logo : 'undefined',
      logoIsFile: data.logo instanceof File
    })
    
    if (hasLogo || hasRemoveLogo) {
      // Use FormData for file upload
      const formData = new FormData()
      
      // Add all non-file fields
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'logo' && value instanceof File) {
          formData.append('logo', value)
        } else if (key === 'removeLogo' && value) {
          formData.append('removeLogo', 'true')
        } else if (value !== undefined && value !== null && key !== 'logo') {
          formData.append(key, String(value))
        }
      })
      
      const response = await api.put("/users/profile", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    } else {
      // Regular JSON request
      const response = await api.put("/users/profile", data)
      return response.data
    }
  } catch (error) {
    logger.error("Error updating user profile:", error)
    throw error
  }
}

// Change user password
export const changePassword = async (data: ChangePasswordData): Promise<void> => {
  try {
    await api.post("/users/change-password", data)
  } catch (error) {
    logger.error("Error changing password:", error)
    throw error
  }
}

// Set password for OAuth user (Feature 189)
// Allows OAuth users (Google, etc.) to add password auth
export const setPassword = async (password: string): Promise<void> => {
  try {
    await api.post("/auth/set-password", { password })
  } catch (error) {
    logger.error("Error setting password:", error)
    throw error
  }
}

// Delete user account (soft-delete with 90-day retention)
// Feature 196 - Soft Delete System
export interface DeleteAccountResult {
  success: boolean
  message: string
  cascadeType: "OWNER_CASCADE" | "AGENT_ISOLATED"
  affectedRecords: {
    workspaces?: number
    customers?: number
    orders?: number
    messages?: number
  }
  deletionDate: string
  permanentDeleteDate: string
}

export const deleteMyAccount = async (reason: string = "User requested deletion"): Promise<DeleteAccountResult> => {
  try {
    const response = await api.post("/users/me/delete", { reason })
    return response.data
  } catch (error) {
    logger.error("Error deleting account:", error)
    throw error
  }
} 
