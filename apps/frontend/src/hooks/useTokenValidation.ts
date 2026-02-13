import { useEffect, useState } from "react"
import { logger } from "../lib/logger"
import { tokenApi } from "../services/tokenApi"

interface TokenValidationResult {
  valid: boolean
  loading: boolean
  error: string | null
  errorType?: string
  expiresAt?: string
  tokenData: {
    tokenId?: string
    type?: string
    workspaceId?: string
    userId?: string
    phoneNumber?: string
    expiresAt?: string
    createdAt?: string
    workspace?: any
  } | null
  payload: any | null
}

interface UseTokenValidationOptions {
  token: string | null
  type?: string
  workspaceId?: string
  autoValidate?: boolean
}

/**
 * 🔐 Custom hook for validating secure tokens in public pages
 * Used for checkout, invoice, cart, and other public links
 */
export const useTokenValidation = ({
  token,
  type,
  workspaceId,
  autoValidate = true,
}: UseTokenValidationOptions): TokenValidationResult & {
  validateToken: () => Promise<void>
} => {
  const [valid, setValid] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<string | undefined>(undefined)
  const [expiresAt, setExpiresAt] = useState<string | undefined>(undefined)
  const [tokenData, setTokenData] = useState<any>(null)
  const [payload, setPayload] = useState<any>(null)

  const validateToken = async () => {
    if (!token) {
      setError("Token mancante nel link")
      setValid(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setErrorType(undefined)
    setExpiresAt(undefined)

    try {
      logger.info(
        `[TOKEN-VALIDATION] Validating token for type: ${type || "any"}`
      )

      // TOKEN-ONLY system: Don't send type to allow universal token usage
      const requestBody: any = { token }
      if (workspaceId) requestBody.workspaceId = workspaceId
      // Explicitly don't send 'type' to allow any valid token type

      const response = await tokenApi.post(
        "/validate-secure-token",
        requestBody
      )

      if (response.data.valid) {
        setValid(true)
        setTokenData({
          ...response.data.data,
          workspace: response.data.workspace,
        })
        setPayload(response.data.payload)
        logger.info("[TOKEN-VALIDATION] ✅ Token validated successfully")
      } else {
        setValid(false)
        setError(response.data.error || "Token non valido")
        setErrorType(response.data.errorType)
        setExpiresAt(response.data.expiresAt)
        logger.warn(
          "[TOKEN-VALIDATION] ❌ Token validation failed:",
          response.data.error
        )
      }
    } catch (err: any) {
      logger.error("[TOKEN-VALIDATION] Error validating token:", err)

      if (err.response?.status === 401) {
        setError("Link expired or invalid")
      } else if (err.response?.status === 403) {
        setError("Link not authorized for this workspace")
      } else {
        setError("Error during link validation")
      }
      setValid(false)
    } finally {
      setLoading(false)
    }
  }

  // Auto-validate on mount if enabled
  useEffect(() => {
    if (autoValidate && token) {
      validateToken()
    }
  }, [token, type, workspaceId, autoValidate])

  return {
    valid,
    loading,
    error,
    errorType,
    expiresAt,
    tokenData,
    payload,
    validateToken,
  }
}

/**
 * 🛒 Specialized hook for checkout/cart token validation (TOKEN-ONLY)
 * Validates tokens for checkout page (cart-public removed)
 */
export const useCheckoutTokenValidation = (token: string | null) => {
  const [valid, setValid] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<string | undefined>(undefined)
  const [expiresAt, setExpiresAt] = useState<string | undefined>(undefined)
  const [tokenData, setTokenData] = useState<any>(null)
  const [payload, setPayload] = useState<any>(null)

  const validateToken = async () => {
    if (!token) {
      setError("Token missing in link")
      setValid(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setErrorType(undefined)
    setExpiresAt(undefined)

    // 🎯 Always use checkout endpoint since cart-public is removed
    const endpoint = `/checkout/token?token=${token}`

    try {
      logger.info(
        `[CHECKOUT-TOKEN-VALIDATION] Validating token for CHECKOUT page`
      )

      const response = await tokenApi.get(endpoint)

      // 🎯 Check for valid response from checkout endpoint
      const isValidResponse = response.data.valid

      if (isValidResponse) {
        setValid(true)
        setTokenData(response.data)
        setPayload(response.data.prodotti)
        logger.info(
          `[CHECKOUT-TOKEN-VALIDATION] ✅ Token validated successfully for CHECKOUT`
        )
      } else {
        setValid(false)
        setError(response.data.error || "Invalid token")
        setErrorType(response.data.errorType)
        setExpiresAt(response.data.expiresAt)
        logger.warn(
          `[CHECKOUT-TOKEN-VALIDATION] ❌ Token validation failed for CHECKOUT:`,
          response.data.error
        )
      }
    } catch (err: any) {
      logger.error("[CHECKOUT-TOKEN-VALIDATION] Error validating token:", err)

      if (err.response?.status === 400) {
        setError(err.response.data.error || "Link expired or invalid")
        setErrorType(err.response.data.errorType)
        setExpiresAt(err.response.data.expiresAt)
      } else if (err.response?.status === 403) {
        setError("Link not authorized for this workspace")
      } else {
        setError("Error during link validation")
      }
      setValid(false)
    } finally {
      setLoading(false)
    }
  }

  // Auto-validate on mount
  useEffect(() => {
    if (token) {
      validateToken()
    }
  }, [token])

  return {
    valid,
    loading,
    error,
    errorType,
    expiresAt,
    tokenData,
    payload,
    validateToken,
  }
}

/**
 * 🧾 Specialized hook for invoice token validation
 */
export const useInvoiceTokenValidation = (
  token: string | null,
  workspaceId?: string
) => {
  return useTokenValidation({
    token,
    type: "invoice",
    workspaceId,
    autoValidate: true,
  })
}

/**
 * 🛍️ Specialized hook for cart token validation
 */
export const useCartTokenValidation = (
  token: string | null,
  workspaceId?: string
) => {
  return useTokenValidation({
    token,
    type: "cart",
    workspaceId,
    autoValidate: true,
  })
}
