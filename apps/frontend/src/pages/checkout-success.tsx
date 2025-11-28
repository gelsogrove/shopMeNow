import { logger } from "@/lib/logger"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTokenValidation } from "../hooks/useTokenValidation"
import { getPublicPageTexts } from "../utils/publicPageTranslations"

const CheckoutSuccessPage = () => {
  const [searchParams] = useSearchParams()
  const [texts, setTexts] = useState<any>(null)
  const [orderCode, setOrderCode] = useState<string | null>(null)
  const [customerLanguage, setCustomerLanguage] = useState<string>("IT")

  // Get token from URL params
  const token = searchParams.get("token") || null

  // 🔐 Token validation for secure access
  const {
    valid: tokenValid,
    loading: tokenLoading,
    error: tokenError,
    tokenData,
    payload,
  } = useTokenValidation({
    token,
    autoValidate: true,
  })

  useEffect(() => {
    const loadTexts = async () => {
      try {
        // Get language priority: URL param > token payload customer data > default IT
        const urlLang = searchParams.get("lang")
        let language = "IT"

        if (
          urlLang &&
          ["IT", "EN", "ES", "PT"].includes(urlLang.toUpperCase())
        ) {
          language = urlLang.toUpperCase()
        } else if (payload?.customer?.language) {
          language = payload.customer.language.toUpperCase()
        }

        setCustomerLanguage(language)

        const pageTexts = await getPublicPageTexts(
          language as "IT" | "EN" | "ES" | "PT"
        )
        setTexts(pageTexts)

        // Get order code from URL
        const code = searchParams.get("orderCode")
        setOrderCode(code)
      } catch (error) {
        logger.error("Error loading translations:", error)
        // Fallback to default texts if translation loading fails
        setTexts({
          orderConfirmed: "Order Confirmed!",
          orderReceived: "Your order has been received successfully.",
          contactSoon:
            "We will contact you as soon as possible for confirmation.",
          closePage: "You can close this page and return to WhatsApp chat.",
          orderCode: "Order Code",
          loading: "Loading...",
        })
      }
    }

    // Load texts when token is validated or when there's no token
    if (!token || (token && tokenValid)) {
      loadTexts()
    }
  }, [searchParams, payload, tokenValid, token])

  // Show loading if we have a token but it's still being validated
  if (token && tokenLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show error if token validation failed
  if (token && !tokenValid && !tokenLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Invalid Link
          </h2>
          <p className="text-gray-600 mb-4">
            The link you used is invalid or has expired.
          </p>
          <p className="text-sm text-gray-500">
            Please contact support if you need assistance.
          </p>
        </div>
      </div>
    )
  }

  if (!texts) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <div className="text-green-500 text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {texts.orderConfirmed}
        </h2>

        {orderCode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-700 font-medium">
              {texts.orderCode}: <span className="font-bold">{orderCode}</span>
            </p>
          </div>
        )}

        <p className="text-gray-600 mb-4">{texts.orderReceived}</p>
        <p className="text-gray-600 mb-6">{texts.contactSoon}</p>
        <p className="text-sm text-gray-500">{texts.closePage}</p>
      </div>
    </div>
  )
}

export default CheckoutSuccessPage
