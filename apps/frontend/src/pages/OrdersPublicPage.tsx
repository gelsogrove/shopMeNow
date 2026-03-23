import { logger } from "@/lib/logger"
import { Download, FileText, Package, ShoppingCart, Truck } from "lucide-react"
import React, { useEffect, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { StickyHeader } from "../components/public/StickyHeader"
import { TokenError } from "../components/ui/TokenError"
import UnifiedLoading from "../components/ui/UnifiedLoading"
import { useTokenValidation } from "../hooks/useTokenValidation"
import { tokenApi } from "../services/tokenApi"
import { getPublicPageTexts, SupportedLanguage } from "../utils/publicPageTranslations"

// ========================================
// 🌍 Normalize Language Code
// ========================================
// Converts various language formats to our standard 2-letter uppercase codes
const normalizeLanguage = (lang: string | null | undefined): SupportedLanguage => {
  if (!lang) return "IT"
  
  const normalized = lang.toUpperCase().trim()
  
  // Map 3-letter codes to 2-letter
  const languageMap: Record<string, SupportedLanguage> = {
    // Standard 2-letter
    "IT": "IT",
    "EN": "EN",
    "ES": "ES",
    "PT": "PT",
    // 3-letter variants
    "ITA": "IT",
    "ENG": "EN",
    "ESP": "ES",
    "PRT": "PT",
    "POR": "PT",
  }
  
  return languageMap[normalized] || "IT"
}

// ========================================
// 📦 Types
// ========================================
interface OrderItem {
  id: string
  itemType: string
  name: string
  code: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface OrderData {
  id: string
  orderCode: string
  date: string
  status: string
  paymentStatus: string
  paymentMethod: string
  paymentProvider: string | null
  shippingAmount: number
  taxAmount: number
  shippingAddress: string | null
  trackingNumber: string | null
  totalAmount: number
  items: OrderItem[]
  invoiceUrl: string | null
  ddtUrl: string | null
  creditNoteUrl: string | null
}

interface CustomerData {
  id: string
  name: string
  email: string
  phone: string
  language: string
}

interface WorkspaceData {
  id: string
  name: string
}

// ========================================
// 📋 Order Status Badge
// ========================================
const OrderStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
      case "DELIVERED":
        return "bg-green-100 text-green-800"
      case "PROCESSING":
      case "SHIPPED":
        return "bg-blue-100 text-blue-800"
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "CANCELLED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
        status
      )}`}
    >
      {status}
    </span>
  )
}

// ========================================
// 💰 Format Currency
// ========================================
const formatCurrency = (amount: number, currency = "EUR") => {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
  }).format(amount)
}

// ========================================
// 📅 Format Date
// ========================================
const formatDate = (dateString: string, language: string) => {
  const locale = language === "IT" ? "it-IT" : language === "ES" ? "es-ES" : "en-US"
  return new Date(dateString).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ========================================
// 📦 Order Detail Page
// ========================================
const OrdersPublicPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { orderCode } = useParams<{ orderCode: string }>()
  const token = searchParams.get("token")

  // 🔐 Token validation for secure access
  const {
    valid: tokenValid,
    loading: tokenLoading,
    error: tokenError,
    validateToken,
  } = useTokenValidation({
    token,
    autoValidate: true,
  })

  // 📋 Order data state
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [customerLanguage, setCustomerLanguage] = useState<string>("IT")

  // 📋 Fetch order data when token is validated
  useEffect(() => {
    const fetchOrder = async () => {
      if (!tokenValid || !token || !orderCode) return

      setLoadingOrder(true)
      setOrderError(null)

      try {
        logger.info(
          `[ORDERS-PUBLIC] 📋 Fetching order ${orderCode} with token: ${token.substring(
            0,
            12
          )}...`
        )

        const response = await tokenApi.get(
          `/orders-public/${orderCode}?token=${token}`
        )

        if (response.data.success) {
          const { customer, workspace, order } = response.data.data

          setCustomerData(customer)
          setWorkspaceData(workspace)
          setOrderData(order)
          
          // Normalize language from DB (handles ENG→EN, PRT→PT, ESP→ES, etc.)
          const normalizedLang = normalizeLanguage(customer?.language)
          setCustomerLanguage(normalizedLang)

          logger.info(
            `[ORDERS-PUBLIC] ✅ Order data loaded: ${order.orderCode} (customer: ${customer.name}, lang: ${customer?.language} → ${normalizedLang})`
          )
        } else {
          setOrderError(response.data.error || "Error loading order")
        }
      } catch (error: any) {
        logger.error("[ORDERS-PUBLIC] Error fetching order:", error)
        if (error.response?.status === 401) {
          setOrderError("Token expired, request a new link")
        } else if (error.response?.status === 404) {
          setOrderError("Order not found")
        } else {
          setOrderError("Error loading order")
        }
      } finally {
        setLoadingOrder(false)
      }
    }

    if (tokenValid && token && orderCode) {
      const startTime = Date.now()

      fetchOrder().finally(() => {
        const elapsedTime = Date.now() - startTime
        const remainingTime = Math.max(0, 1000 - elapsedTime)

        setTimeout(() => {
          setInitialLoading(false)
        }, remainingTime)
      })
    }
  }, [tokenValid, token, orderCode])

  // 🌐 Get localized text
  const texts = getPublicPageTexts(customerLanguage)

  // 🔄 Loading state
  if (tokenLoading || loadingOrder || initialLoading) {
    return (
      <UnifiedLoading title={texts.loading} message={texts.loadingMessage} />
    )
  }

  // ❌ Token error
  if (tokenError || !tokenValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <TokenError
          error={tokenError || "Invalid order token"}
          onRetry={validateToken}
          showRetry={true}
          className="max-w-md w-full"
        />
      </div>
    )
  }

  // ❌ Order error
  if (orderError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <TokenError
          error={orderError}
          onRetry={() => window.location.reload()}
          showRetry={true}
          className="max-w-md w-full"
        />
      </div>
    )
  }

  // ❌ No order data
  if (!orderData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <TokenError
          error="Order not found"
          onRetry={() => window.location.reload()}
          showRetry={true}
          className="max-w-md w-full"
        />
      </div>
    )
  }

  const orderIcon = <FileText className="h-8 w-8" />

  return (
    <div className="min-h-screen bg-gray-50">
      <StickyHeader
        title={`${texts.orderCode} ${orderData.orderCode}`}
        subtitle={workspaceData?.name || ""}
        customerLanguage={customerLanguage}
        token={token}
        currentPage="orders"
        icon={orderIcon}
      />

      <div className="pt-16">
        <div className="max-w-md mx-auto px-3 sm:max-w-2xl sm:px-4 lg:max-w-5xl lg:px-8 xl:max-w-6xl py-4 sm:py-6 lg:py-8">
          {/* Order Summary Card */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Package className="h-6 w-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {texts.orderDetails}
                </h2>
              </div>
              <OrderStatusBadge status={orderData.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">{texts.orderDate}:</span>
                <p className="font-medium">
                  {formatDate(orderData.date, customerLanguage)}
                </p>
              </div>
              <div>
                <span className="text-gray-500">{texts.paymentMethod}:</span>
                <p className="font-medium">{orderData.paymentMethod || "-"}</p>
              </div>
              {orderData.trackingNumber && (
                <div className="col-span-2">
                  <span className="text-gray-500 flex items-center">
                    <Truck className="h-4 w-4 mr-1" />
                    {texts.tracking}:
                  </span>
                  <p className="font-medium text-blue-600">
                    {orderData.trackingNumber}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4">
            <div className="flex items-center space-x-3 mb-4">
              <ShoppingCart className="h-6 w-6 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                {texts.products} ({orderData.items.length})
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {orderData.items.map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex justify-between items-start"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.code && (
                      <p className="text-xs text-gray-500">Cod: {item.code}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(item.totalPrice)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Order Totals */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {texts.orderSummary}
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{texts.subtotal}:</span>
                <span>
                  {formatCurrency(
                    orderData.totalAmount -
                      (orderData.taxAmount || 0) -
                      (orderData.shippingAmount || 0)
                  )}
                </span>
              </div>
              {orderData.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{texts.vat}:</span>
                  <span>{formatCurrency(orderData.taxAmount)}</span>
                </div>
              )}
              {orderData.shippingAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{texts.shipping}:</span>
                  <span>{formatCurrency(orderData.shippingAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold text-lg">
                <span>{texts.total}:</span>
                <span className="text-blue-600">
                  {formatCurrency(orderData.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          {customerData && (
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {texts.personalData}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">{texts.name}:</span>
                  <p className="font-medium">{customerData.name}</p>
                </div>
                <div>
                  <span className="text-gray-500">{texts.email}:</span>
                  <p className="font-medium">{customerData.email}</p>
                </div>
                <div>
                  <span className="text-gray-500">{texts.phone}:</span>
                  <p className="font-medium">{customerData.phone}</p>
                </div>
                {orderData.shippingAddress && (
                  <div className="col-span-2">
                    <span className="text-gray-500">{texts.shippingAddress}:</span>
                    <p className="font-medium">{orderData.shippingAddress}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documents Section - Always shown for demo */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mt-4">
            <div className="flex items-center space-x-3 mb-4">
              <FileText className="h-6 w-6 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                {texts.documentsTitle}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Invoice Button - Always enabled for demo */}
              <a
                href={orderData.invoiceUrl || "#"}
                onClick={(e) => {
                  if (!orderData.invoiceUrl) {
                    e.preventDefault()
                    alert(texts.documentBeingPrepared || "Documento in preparazione")
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors font-medium cursor-pointer"
              >
                <Download className="h-5 w-5" />
                {texts.downloadInvoice}
              </a>

              {/* DDT Button - Always enabled for demo */}
              <a
                href={orderData.ddtUrl || "#"}
                onClick={(e) => {
                  if (!orderData.ddtUrl) {
                    e.preventDefault()
                    alert(texts.documentBeingPrepared || "Documento in preparazione")
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors font-medium cursor-pointer"
              >
                <Download className="h-5 w-5" />
                {texts.downloadDdt}
              </a>

              {/* Credit Note Button - Always enabled for demo */}
              <a
                href={orderData.creditNoteUrl || "#"}
                onClick={(e) => {
                  if (!orderData.creditNoteUrl) {
                    e.preventDefault()
                    alert(texts.documentBeingPrepared || "Documento in preparazione")
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg transition-colors font-medium cursor-pointer"
              >
                <Download className="h-5 w-5" />
                {texts.downloadCreditNote}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrdersPublicPage
