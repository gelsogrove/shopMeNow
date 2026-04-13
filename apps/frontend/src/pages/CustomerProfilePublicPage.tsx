import { logger } from "@/lib/logger"
import { Trash2, User } from "lucide-react"
import React, { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog"
import { ProfileForm } from "../components/profile/ProfileForm"
import { StickyHeader } from "../components/public/StickyHeader"
import { PublicMobileShell } from "@/components/public/PublicMobileShell"
import { TokenError } from "../components/ui/TokenError"
import UnifiedLoading from "../components/ui/UnifiedLoading"
import { useTokenValidation } from "../hooks/useTokenValidation"
import { tokenApi } from "../services/tokenApi"
import { getPublicPageTexts } from "../utils/publicPageTranslations"

interface CustomerProfile {
  id: string
  name: string
  email: string
  phone: string
  company: string
  address: string
  language: string
  currency: string
  discount: number
  invoiceAddress: any
  push_notifications_consent: boolean
  push_notifications_consent_at: string | null
  createdAt: string
  updatedAt: string
  workspace?: {
    id: string
    name: string
    logoUrl?: string | null
    channelMode?: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'
  }
}

const CustomerProfilePublicPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token")

  // 🔐 Token validation for secure access
  const {
    valid: tokenValid,
    loading: tokenLoading,
    error: tokenError,
    tokenData,
    validateToken,
  } = useTokenValidation({
    token,
    // No type specified - token should work for any page (TOKEN-ONLY system)
    autoValidate: true,
  })

  // 📋 Profile data state
  const [profileData, setProfileData] = useState<CustomerProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [customerLanguage, setCustomerLanguage] = useState<string>("it") // Default to it until loaded

  // 📋 Fetch profile data when token is validated
  useEffect(() => {
    const fetchProfile = async () => {
      if (!tokenValid || !token) return

      setLoadingProfile(true)
      setProfileError(null)

      try {
        logger.info(
          `[PROFILE] 📋 Fetching profile with token: ${token.substring(
            0,
            12
          )}...`
        )

        const response = await tokenApi.get(`/customer-profile/${token}`)

        if (response.data.success) {
          const profileData = response.data.data

          // Debug: Log the invoiceAddress type and content
          logger.info(
            `[PROFILE] DEBUG - invoiceAddress type: ${typeof profileData.invoiceAddress}`
          )
          logger.info(
            `[PROFILE] DEBUG - invoiceAddress content:`,
            profileData.invoiceAddress
          )

          // Parse invoiceAddress if it's a JSON string
          if (
            profileData.invoiceAddress &&
            typeof profileData.invoiceAddress === "string"
          ) {
            try {
              profileData.invoiceAddress = JSON.parse(
                profileData.invoiceAddress
              )
              logger.info(
                `[PROFILE] DEBUG - Parsed invoiceAddress:`,
                profileData.invoiceAddress
              )
            } catch (error) {
              logger.warn(
                "[PROFILE] Failed to parse invoiceAddress JSON:",
                error
              )
              profileData.invoiceAddress = null
            }
          }

          // Parse address if it's a JSON string
          if (profileData.address && typeof profileData.address === "string") {
            try {
              profileData.address = JSON.parse(profileData.address)
              logger.info(
                `[PROFILE] DEBUG - Parsed address:`,
                profileData.address
              )
            } catch (error) {
              logger.warn("[PROFILE] Failed to parse address JSON:", error)
              profileData.address = null
            }
          }

          // 🌐 Set customer language immediately for correct translations
          setCustomerLanguage(profileData.language || "it")

          setProfileData(profileData)
          logger.info(
            `[PROFILE] ✅ Profile data loaded for customer ${profileData.name} (language: ${profileData.language})`
          )
        } else {
          setProfileError(response.data.error || "Error loading profile")
        }
      } catch (error: any) {
        logger.error("[PROFILE] Error fetching profile:", error)
        if (error.response?.status === 401) {
          setProfileError("Token expired, request a new link")
        } else if (error.response?.status === 404) {
          setProfileError("Customer not found")
        } else {
          setProfileError("Error loading profile")
        }
      } finally {
        setLoadingProfile(false)
      }
    }

    if (tokenValid && token) {
      // Minimum 1000ms loading + wait for endpoint to finish
      const startTime = Date.now()

      fetchProfile().finally(() => {
        const elapsedTime = Date.now() - startTime
        const remainingTime = Math.max(0, 1000 - elapsedTime)

        setTimeout(() => {
          setInitialLoading(false)
        }, remainingTime)
      })
    } else if (!tokenLoading && (tokenError || !tokenValid)) {
      // Token validation failed - stop loading immediately
      setInitialLoading(false)
    }
  }, [tokenValid, token, tokenLoading, tokenError])

  // 💾 Handle profile save
  const handleSaveProfile = async (updatedData: Partial<CustomerProfile>) => {
    if (!token) return

    setSaving(true)

    try {
      logger.info(`[PROFILE] 💾 Saving profile updates...`)

      const response = await tokenApi.put(
        `/customer-profile/${token}`,
        updatedData
      )

      if (response.data.success) {
        const profileData = response.data.data

        // Parse invoiceAddress if it's a JSON string
        if (
          profileData.invoiceAddress &&
          typeof profileData.invoiceAddress === "string"
        ) {
          try {
            profileData.invoiceAddress = JSON.parse(profileData.invoiceAddress)
          } catch (error) {
            logger.warn(
              "[PROFILE] Failed to parse invoiceAddress JSON after save:",
              error
            )
            profileData.invoiceAddress = null
          }
        }

        setProfileData(profileData)
        toast.success("Profile updated successfully!")
        logger.info(`[PROFILE] ✅ Profile updated successfully`)
      } else {
        toast.error(response.data.error || "Error saving")
      }
    } catch (error: any) {
      logger.error("[PROFILE] Error saving profile:", error)
      if (error.response?.status === 401) {
        toast.error("Token expired, request a new link")
      } else {
        toast.error("Error saving profile")
      }
    } finally {
      setSaving(false)
    }
  }

  // �️ Handle account deletion (hard delete with cascade)
  const handleDeleteAccount = async () => {
    if (!token) return

    setDeleting(true)

    try {
      logger.info("[PROFILE] 🗑️ Requesting account deletion...")

      const response = await tokenApi.delete(`/customer-profile/${token}`)

      if (response.data.success) {
        toast.success(texts.deleteAccountSuccess)
        logger.info("[PROFILE] ✅ Account deleted successfully")
        // Redirect to a simple goodbye page after short delay
        setTimeout(() => {
          window.location.href = "about:blank"
        }, 2000)
      } else {
        toast.error(response.data.error || texts.deleteAccountError)
      }
    } catch (error: any) {
      logger.error("[PROFILE] Error deleting account:", error)
      if (error.response?.status === 401) {
        toast.error("Token expired, request a new link")
      } else {
        toast.error(texts.deleteAccountError)
      }
    } finally {
      setDeleting(false)
    }
  }

  // �🛒 Navigate to cart
  // 📋 Handle view cart - Use same token (TOKEN-ONLY system)
  const handleViewCart = () => {
    logger.info("[PROFILE] View Cart clicked, using current token")

    // Use current token and redirect to cart page (TOKEN-ONLY)
    const cartUrl = `/checkout?token=${token}`
    logger.info("[PROFILE] Redirecting to cart:", cartUrl)
    window.location.href = cartUrl
  }

  // 🌐 Get localized text based on customer language using centralized system
  const texts = getPublicPageTexts(customerLanguage)

  // Show error FIRST if token is invalid (don't show loading)
  if (tokenError || (!tokenLoading && !tokenValid)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <TokenError
          error={tokenError || "Invalid or expired token"}
          onRetry={validateToken}
          showRetry={true}
          className="max-w-md w-full"
        />
      </div>
    )
  }

  // Show loading only if token is being validated or profile is loading
  if (tokenLoading || loadingProfile || initialLoading) {
    return (
      <UnifiedLoading title={texts.loading} message={texts.loadingMessage} />
    )
  }

  // Show loading state during profile fetch

  // Show error if profile couldn't be loaded
  if (profileError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <TokenError
          error={profileError}
          onRetry={() => window.location.reload()}
          showRetry={true}
          className="max-w-md w-full"
        />
      </div>
    )
  }

  // Show profile form - use centralized localization system
  const localizedText = texts

  const profileIcon = <User className="h-8 w-8" />

  return (
    <PublicMobileShell accentColor="#0ea5e9" tone="slate" maxWidth="wide">
      <StickyHeader
        title={profileData?.workspace?.name || texts.personalData}
        subtitle={texts.contactInfo}
        customerLanguage={customerLanguage}
        token={token}
        currentPage="profile"
        logoUrl={profileData?.workspace?.logoUrl}
        icon={profileIcon}
        isEcommerce={profileData?.workspace?.channelMode === 'ECOMMERCE'}
      />

      <div className="pt-16">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-100 px-3 sm:px-6 lg:px-8 py-5 sm:py-7">
          {/* Profile Form */}
          {profileData && (
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 lg:p-6 border border-gray-100">
              <ProfileForm
                profileData={profileData}
                onSave={handleSaveProfile}
                saving={saving}
                isEcommerce={profileData.workspace?.channelMode === 'ECOMMERCE'}
              />
            </div>
          )}

          {/* 🗑️ Delete Account - Danger Zone */}
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-red-200 p-3 sm:p-4 lg:p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-700">
                  {texts.deleteAccountTitle}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {texts.deleteAccountDescription}
                </p>

                <div className="mt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                        disabled={deleting}
                      >
                        {deleting ? texts.deleteAccountDeleting : texts.deleteAccountButton}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-700">
                          {texts.deleteAccountConfirmTitle}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {texts.deleteAccountConfirmMessage}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{texts.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {texts.deleteAccountConfirmButton}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicMobileShell>
  )
}

export default CustomerProfilePublicPage
