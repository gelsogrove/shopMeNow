import { useCallback, useState } from "react"
import { api } from "../services/api"

interface ValidationResult {
  exists: boolean
  customer: {
    id: string
    name: string
    email?: string
    phone?: string
  } | null
}

/**
 * Hook per validazione real-time di phone e email
 * Verifica se un numero di telefono o email già esiste nel workspace
 */
export const useCustomerValidation = (workspaceId: string) => {
  const [phoneValidation, setPhoneValidation] = useState<{
    loading: boolean
    error: string | null
    result: ValidationResult | null
  }>({
    loading: false,
    error: null,
    result: null,
  })

  const [emailValidation, setEmailValidation] = useState<{
    loading: boolean
    error: string | null
    result: ValidationResult | null
  }>({
    loading: false,
    error: null,
    result: null,
  })

  /**
   * Verifica se un numero di telefono esiste già
   */
  const checkPhone = useCallback(
    async (phone: string) => {
      if (!phone || phone.trim().length === 0) {
        setPhoneValidation({ loading: false, error: null, result: null })
        return
      }

      setPhoneValidation({ loading: true, error: null, result: null })

      try {
        const { data } = await api.get<ValidationResult>(
          `/workspaces/${workspaceId}/customers/check-phone`,
          {
            params: { phone: phone.trim() },
          }
        )

        setPhoneValidation({ loading: false, error: null, result: data })

        return data
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.error || "Errore durante la validazione"
        setPhoneValidation({
          loading: false,
          error: errorMessage,
          result: null,
        })
        return null
      }
    },
    [workspaceId]
  )

  /**
   * Verifica se un'email esiste già
   */
  const checkEmail = useCallback(
    async (email: string) => {
      if (!email || email.trim().length === 0) {
        setEmailValidation({ loading: false, error: null, result: null })
        return
      }

      setEmailValidation({ loading: true, error: null, result: null })

      try {
        const { data } = await api.get<ValidationResult>(
          `/workspaces/${workspaceId}/customers/check-email`,
          {
            params: { email: email.trim() },
          }
        )

        setEmailValidation({ loading: false, error: null, result: data })

        return data
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.error || "Errore durante la validazione"
        setEmailValidation({
          loading: false,
          error: errorMessage,
          result: null,
        })
        return null
      }
    },
    [workspaceId]
  )

  /**
   * Reset validazione phone
   */
  const resetPhoneValidation = useCallback(() => {
    setPhoneValidation({ loading: false, error: null, result: null })
  }, [])

  /**
   * Reset validazione email
   */
  const resetEmailValidation = useCallback(() => {
    setEmailValidation({ loading: false, error: null, result: null })
  }, [])

  return {
    // Phone validation
    checkPhone,
    phoneValidation,
    resetPhoneValidation,
    // Email validation
    checkEmail,
    emailValidation,
    resetEmailValidation,
  }
}
