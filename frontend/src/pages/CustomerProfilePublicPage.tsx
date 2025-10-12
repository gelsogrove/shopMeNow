import { logger } from "@/lib/logger"
import { User } from "lucide-react"
import React, { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { PublicPageLayout } from "../components/layout/PublicPageLayout"
import { ProfileForm } from "../components/profile/ProfileForm"
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
  createdAt: string
  updatedAt: string
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
  const [initialLoading, setInitialLoading] = useState(true)
  const [customerLanguage, setCustomerLanguage] = useState<string>("IT") // Default to IT until loaded

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
          setCustomerLanguage(profileData.language || "IT")

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
    }
  }, [tokenValid, token])

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

  // 🔗 Navigate to orders
  // 📋 Handle view orders - Use same token (TOKEN-ONLY system)
  const handleViewOrders = () => {
    logger.info("[PROFILE] View Orders clicked, using current token:", token)

    // Use current token and redirect to orders page (TOKEN-ONLY)
    // No need to generate new token - same token works for all pages
    const ordersUrl = `/orders-public?token=${token}`
    logger.info("[PROFILE] Redirecting to orders:", ordersUrl)
    window.location.href = ordersUrl
  }

  // 🛒 Navigate to cart
  // 📋 Handle view cart - Use same token (TOKEN-ONLY system)
  const handleViewCart = () => {
    logger.info("[PROFILE] View Cart clicked, using current token:", token)

    // Use current token and redirect to cart page (TOKEN-ONLY)
    const cartUrl = `/checkout?token=${token}`
    logger.info("[PROFILE] Redirecting to cart:", cartUrl)
    window.location.href = cartUrl
  }

  // 🌐 Get localized text based on customer language using centralized system
  const texts = getPublicPageTexts(customerLanguage)

  if (tokenLoading || loadingProfile || initialLoading) {
    return (
      <UnifiedLoading title={texts.loading} message={texts.loadingMessage} />
    )
  }

  // Show error if token is invalid
  if (tokenError || !tokenValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <TokenError
          error={tokenError || "Invalid profile token"}
          onRetry={validateToken}
          showRetry={true}
          className="max-w-md w-full"
        />
      </div>
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
    <PublicPageLayout
      title={texts.personalData}
      subtitle={texts.contactInfo}
      customerLanguage={customerLanguage}
      token={token}
      currentPage="profile"
      icon={profileIcon}
    >
      {/* Profile Form */}
      {profileData && (
        <div className="p-6">
          <ProfileForm
            profileData={profileData}
            onSave={handleSaveProfile}
            saving={saving}
          />
        </div>
      )}
    </PublicPageLayout>
  )
}

export default CustomerProfilePublicPage
