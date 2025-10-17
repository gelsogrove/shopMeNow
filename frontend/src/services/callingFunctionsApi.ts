/**
 * Calling Functions API Service
 *
 * Provides client-side methods to call backend LLM-callable functions:
 * - addProduct() - Add product to cart
 * - repeatOrder() - Repeat previous order
 */

import { api } from "./api"

/**
 * Add product to cart
 */
export const callingFunctionsApi = {
  async addProductToCart(params: {
    productCode: string
    quantity: number
    notes?: string
    workspaceId: string
  }) {
    try {
      const { data } = await api.post(
        `/workspaces/${params.workspaceId}/calling-functions/addProduct`,
        {
          productCode: params.productCode,
          quantity: params.quantity,
          notes: params.notes,
        }
      )
      return data
    } catch (error) {
      console.error("❌ Error calling addProduct:", error)
      throw error
    }
  },

  /**
   * Repeat last or specific order
   */
  async repeatOrder(params: { orderCode?: string; workspaceId: string }) {
    try {
      const { data } = await api.post(
        `/workspaces/${params.workspaceId}/calling-functions/repeatOrder`,
        {
          orderCode: params.orderCode,
        }
      )
      return data
    } catch (error) {
      console.error("❌ Error calling repeatOrder:", error)
      throw error
    }
  },
}
