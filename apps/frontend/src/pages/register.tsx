import { GDPRDialog } from "@/components/ui/gdpr-dialog"
import { logger } from "@/lib/logger"
import { getPublicPageTexts } from "@/utils/publicPageTranslations"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams, useParams } from "react-router-dom"
import { useTokenValidation } from "../hooks/useTokenValidation"
import { tokenApi } from "../services/tokenApi"

const RegisterPage = () => {
  const [searchParams] = useSearchParams()
  const { workspaceId: workspaceIdParam } = useParams<{ workspaceId?: string }>()
  const navigate = useNavigate()
  const phone = searchParams.get("phone") || ""
  const workspaceId = searchParams.get("workspace") || workspaceIdParam || ""
  const token = searchParams.get("token") || ""
  const langParam = searchParams.get("lang") || "en"

  // Get translations based on lang parameter
  const texts = getPublicPageTexts(langParam)

  const [workspaceName, setWorkspaceName] = useState("")
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)

  // 🔐 Use new token validation hook
  const {
    valid: tokenValid,
    loading: validatingToken,
    error: tokenError,
    tokenData,
  } = useTokenValidation({
    token,
    type: "registration",
    workspaceId,
    autoValidate: true,
  })

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    language: "ENG", // Default, will be updated based on lang parameter
    currency: "USD", // Always USD by default
    gdprConsent: false,
    pushNotificationsConsent: false,
  })

  // Set initial language based on lang parameter
  useEffect(() => {
    const langMapping: Record<string, string> = {
      it: "it", // Italy
      en: "en", // English
      es: "es", // Spain
      pt: "pt", // Portugal
    }

    const language = langMapping[langParam] || "en"

    setFormData((prev) => ({
      ...prev,
      language,
      // Always use USD as currency regardless of language
      currency: "USD",
    }))

    logger.info(
      "[Register] Language set from URL parameter:",
      langParam,
      "->",
      language
    )
  }, [langParam])

  const [formErrors, setFormErrors] = useState({
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    gdprConsent: "",
  })

  const [submitStatus, setSubmitStatus] = useState({
    loading: false,
    success: false,
    error: "",
  })

  const hasToken = token.trim().length > 0

  // Array of available languages
  const languages = [
    { code: "IT", name: "Italiano" },
    { code: "ESP", name: "Español" },
    { code: "ENG", name: "English" },
    { code: "PRT", name: "Português" },
  ]

  // Array of available currencies (kept for reference)
  const currencies = [
    { code: "USD", name: "US Dollar ($)" },
    { code: "EUR", name: "Euro (€)" },
    { code: "GBP", name: "British Pound (£)" },
  ]

  // 🔐 Enhanced token validation with workspace info
  useEffect(() => {
    const fetchWorkspaceInfo = async (resolvedWorkspaceId: string) => {
      if (!resolvedWorkspaceId) return
      try {
        logger.info(
          `[Register] Fetching workspace info for id: ${resolvedWorkspaceId}`
        )
        // TODO: This should be a token-based endpoint, not backoffice
        const workspaceResponse = await tokenApi.get(
          `/workspaces/${resolvedWorkspaceId}`
        )
        logger.info(
          "[Register] Workspace API response:",
          workspaceResponse.data
        )
        if (workspaceResponse.data?.name) {
          setWorkspaceName(workspaceResponse.data.name)
        }
      } catch (error) {
        logger.error("[Register] Error fetching workspace info:", error)
        // Non-fatal error, continue with registration
      }
    }

    if (tokenValid) {
      const resolvedWorkspaceId = workspaceId || tokenData?.workspaceId || ""
      // Minimum 1000ms loading + wait for endpoint to finish
      const startTime = Date.now()

      fetchWorkspaceInfo(resolvedWorkspaceId).finally(() => {
        const elapsedTime = Date.now() - startTime
        const remainingTime = Math.max(0, 1000 - elapsedTime)

        setTimeout(() => {
          setLoading(false)
          setInitialLoading(false)
        }, remainingTime)
      })
    }
  }, [tokenValid, workspaceId, tokenData])

  // Stop initial loading if token is missing or invalid
  useEffect(() => {
    if (!hasToken || (!tokenValid && tokenError)) {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [hasToken, tokenValid, tokenError])

  // Handle form input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Clear error when field is updated
    if (name in formErrors) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }))
    }
  }

  // Handle checkbox changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }))

    // Clear error when checkbox is checked
    if (name in formErrors) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }))
    }
  }

  // Validate form
  const validateForm = () => {
    const errors = {
      firstName: "",
      lastName: "",
      company: "",
      email: "",
      gdprConsent: "",
    }

    let isValid = true

    if (!formData.firstName.trim()) {
      errors.firstName = "First name is required"
      isValid = false
    }

    if (!formData.lastName.trim()) {
      errors.lastName = "Last name is required"
      isValid = false
    }

    if (!formData.company.trim()) {
      errors.company = "Company name is required"
      isValid = false
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required"
      isValid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address"
      isValid = false
    }

    if (!formData.gdprConsent) {
      errors.gdprConsent = "You must agree to the privacy policy"
      isValid = false
    }

    setFormErrors(errors)
    return isValid
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSubmitStatus({
      loading: true,
      success: false,
      error: "",
    })

    try {
      // Use phone and workspaceId from tokenData (not query params)
      const phoneFromToken = tokenData?.phoneNumber || phone
      const workspaceIdFromToken = tokenData?.workspaceId || workspaceId

      const response = await tokenApi.post("/registration/register", {
        token,
        first_name: formData.firstName,
        last_name: formData.lastName,
        company: formData.company,
        email: formData.email,
        phone: phoneFromToken,
        workspace_id: workspaceIdFromToken,
        language: formData.language,
        currency: formData.currency,
        gdpr_consent: formData.gdprConsent,
        push_notifications_consent: formData.pushNotificationsConsent,
      })

      if (response.data?.success) {
        setSubmitStatus({
          loading: false,
          success: true,
          error: "",
        })

        // Redirect to success page or back to WhatsApp
        setTimeout(() => {
          navigate("/registration-success")
        }, 3000)
      } else {
        throw new Error("Registration failed")
      }
    } catch (error: any) {
      logger.error("Registration error:", error)
      setSubmitStatus({
        loading: false,
        success: false,
        error:
          error.response?.data?.error ||
          "Registration failed. Please try again.",
      })
    }
  }

  // Loading state
  if (loading || validatingToken || initialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
          <div className="animate-pulse space-y-6">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
          <p className="text-center mt-4 text-gray-500">
            {texts.validatingLink}
          </p>
        </div>
      </div>
    )
  }

  // Token error state
  if (!tokenValid || tokenError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-red-500 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-xl font-bold mt-4">
              {texts.registrationErrorTitle}
            </h2>
          </div>
          <p className="text-gray-700 text-center">{tokenError}</p>
          <div className="mt-6">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              {texts.tryAgain}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (submitStatus.success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-green-500 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <h2 className="text-xl font-bold mt-4">
              {texts.registrationSuccessTitle}
            </h2>
          </div>
          <p className="text-gray-700 text-center">
            {texts.registrationSuccessMessage}
          </p>
          <div className="mt-6">
            <button
              onClick={() =>
                (window.location.href = `whatsapp://send?phone=${phone.replace(
                  /[^0-9]/g,
                  ""
                )}`)
              }
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            >
              {texts.returnToWhatsApp}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Registration form
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-8 text-white">
          <h1 className="text-lg font-bold text-center">
            {texts.registerTitle.replace(
              "{workspaceName}",
              workspaceName || "Our Service"
            )}
          </h1>
          <p className="mt-2 text-center text-white text-opacity-80">
            {texts.registerSubtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-8 space-y-6">
          {submitStatus.error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-md">
              {submitStatus.error}
            </div>
          )}

          {/* First name */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="firstName"
            >
              {texts.firstName}
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              value={formData.firstName}
              onChange={handleInputChange}
              required
              className={`mt-1 block w-full px-3 py-2 border ${
                formErrors.firstName ? "border-red-500" : "border-gray-300"
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
            />
            {formErrors.firstName && (
              <p className="mt-1 text-sm text-red-600">
                {formErrors.firstName}
              </p>
            )}
          </div>

          {/* Last name */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="lastName"
            >
              {texts.lastName}
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              value={formData.lastName}
              onChange={handleInputChange}
              required
              className={`mt-1 block w-full px-3 py-2 border ${
                formErrors.lastName ? "border-red-500" : "border-gray-300"
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
            />
            {formErrors.lastName && (
              <p className="mt-1 text-sm text-red-600">{formErrors.lastName}</p>
            )}
          </div>

          {/* Company */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="company"
            >
              {texts.company} *
            </label>
            <input
              id="company"
              name="company"
              type="text"
              value={formData.company}
              onChange={handleInputChange}
              required
              className={`mt-1 block w-full px-3 py-2 border ${
                formErrors.company ? "border-red-500" : "border-gray-300"
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
            />
            {formErrors.company && (
              <p className="mt-1 text-sm text-red-600">{formErrors.company}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="email"
            >
              {texts.email} *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className={`mt-1 block w-full px-3 py-2 border ${
                formErrors.email ? "border-red-500" : "border-gray-300"
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
            />
            {formErrors.email && (
              <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
            )}
          </div>

          {/* Language */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="language"
            >
              {texts.preferredLanguage}
            </label>
            <select
              id="language"
              name="language"
              value={formData.language}
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Currency is now hardcoded to USD */}
          <input type="hidden" name="currency" value="USD" />

          {/* Push notifications */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="pushNotificationsConsent"
                name="pushNotificationsConsent"
                type="checkbox"
                checked={formData.pushNotificationsConsent}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3 text-sm">
              <label
                htmlFor="pushNotificationsConsent"
                className="font-medium text-gray-700"
              >
                {texts.pushNotifications}
              </label>
              <p className="text-gray-500">
                You will be able to unsubscribe whenever you want
              </p>
            </div>
          </div>

          {/* GDPR consent */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="gdprConsent"
                name="gdprConsent"
                type="checkbox"
                checked={formData.gdprConsent}
                onChange={handleCheckboxChange}
                className={`h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${
                  formErrors.gdprConsent ? "border-red-500" : ""
                }`}
              />
            </div>
            <div className="ml-3 text-sm">
              <label
                htmlFor="gdprConsent"
                className={`font-medium ${
                  formErrors.gdprConsent ? "text-red-700" : "text-gray-700"
                }`}
              >
                {texts.gdprConsent}
              </label>
              <p className="text-gray-500">
                By checking this box, you agree to our{" "}
                <GDPRDialog>
                  <span className="text-blue-600 hover:underline cursor-pointer">
                    Privacy Policy
                  </span>
                </GDPRDialog>
              </p>
              {formErrors.gdprConsent && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.gdprConsent}
                </p>
              )}
            </div>
          </div>

          {/* Submit button */}
          <div>
            <button
              type="submit"
              disabled={submitStatus.loading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                submitStatus.loading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              }`}
            >
              {submitStatus.loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </>
              ) : (
                texts.registerButton
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4">* Required fields</p>
        </form>
      </div>
    </div>
  )
}

export default RegisterPage
