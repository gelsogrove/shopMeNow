import { api } from "./api"
import { logger } from "@/lib/logger"

export interface UserProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  companyName?: string
  vatNumber?: string
  website?: string
  billingPhone?: string
  billingAddress?: string
  authProvider?: string  // 'email' | 'google' | 'multi' etc. (Feature 189)
  hasPassword?: boolean  // True if user has a password set (Feature 189)
}

export interface UpdateProfileData {
  firstName?: string
  lastName?: string
  email?: string
  companyName?: string
  vatNumber?: string
  website?: string
  billingPhone?: string
  billingAddress?: string
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

// Update user profile
export const updateUserProfile = async (data: UpdateProfileData): Promise<UserProfile> => {
  try {
    const response = await api.put("/users/profile", data)
    return response.data
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