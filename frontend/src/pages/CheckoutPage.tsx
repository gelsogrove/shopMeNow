import { logger } from "@/lib/logger"
import React, { useEffect, useState } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import {
  ProgressSteps,
  Step1Products,
  Step2Addresses,
  Step3Confirm,
  Step4Payment,
} from "../components/checkout"
import { StickyHeader } from "../components/public/StickyHeader"
import { SearchBar, useProductSearch } from "../components/ui/SearchBar"
import { TokenError } from "../components/ui/TokenError"
import UnifiedLoading from "../components/ui/UnifiedLoading"
import { useCheckoutTokenValidation } from "../hooks/useTokenValidation"
import { tokenApi } from "../services/tokenApi"
import { getPublicPageTexts } from "../utils/publicPageTranslations"

// 🖼️ Helper to get full image URL
const getImageUrl = (
  imageUrl: string | string[] | undefined
): string | null => {
  if (!imageUrl) return null
  const url = Array.isArray(imageUrl) ? imageUrl[0] : imageUrl
  if (!url) return null
  // If URL already starts with http, return as-is
  if (url.startsWith("http")) return url
  // Otherwise, prepend backend URL
  return `http://localhost:3001${url}`
}

interface Product {
  id: string // Cart item ID
  productId?: string // Product ID (optional for services)
  serviceId?: string // Service ID (optional for products)
  itemType?: "PRODUCT" | "SERVICE" // Type of item
  codice: string
  descrizione: string
  formato?: string // 🧀 Include formato field (products only)
  qty: number
  quantita?: number // Alias for qty
  prezzo: number
  prezzoOriginale?: number
  prezzoScontato?: number // Discounted price
  scontoApplicato?: number
  fonteSconto?: string
  nomeSconto?: string
  duration?: number // Service duration in minutes
  notes?: string // Service notes
  imageUrl?: string[] // 🖼️ Product/Service images
}

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address?: any
  invoiceAddress?: any
  company?: string
  language?: string
}

interface Address {
  name: string
  street: string
  city: string
  postalCode: string
  province?: string
  country?: string
  phone?: string
  company?: string
}

interface FormData {
  shippingAddress: Address
  billingAddress: Address
  sameAsBilling: boolean
  notes: string
}

// 🌐 Use centralized localization system

const CheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const token = searchParams.get("token")

  // 🌐 Use centralized localization system

  // 🔐 Validate checkout token (TOKEN-ONLY)
  const {
    valid,
    loading,
    error,
    errorType,
    expiresAt,
    tokenData,
    payload,
    validateToken,
  } = useCheckoutTokenValidation(token)

  // State management
  const [currentStep, setCurrentStep] = useState(1)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [prodotti, setProdotti] = useState<Product[]>([])
  const [formData, setFormData] = useState<FormData>({
    shippingAddress: {
      name: "",
      street: "",
      city: "",
      postalCode: "",
      province: "",
      country: "Italia",
      phone: "",
      company: "",
    },
    billingAddress: {
      name: "",
      street: "",
      city: "",
      postalCode: "",
      province: "",
      country: "Italia",
      phone: "",
      company: "",
    },
    sameAsBilling: true,
    notes: "",
  })
  const [submitStatus, setSubmitStatus] = useState({
    loading: false,
    success: false,
    error: "",
  })
  const [showAddProducts, setShowAddProducts] = useState(false)
  const [showAddServices, setShowAddServices] = useState(false)
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [availableServices, setAvailableServices] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingServices, setLoadingServices] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [productToDelete, setProductToDelete] = useState<{
    index: number
    name: string
    itemType: "PRODUCT" | "SERVICE"
    itemId: string // productId or serviceId
  } | null>(null)

  // 🔍 Search states for products
  const [searchTerm, setSearchTerm] = useState("")

  // 🔍 Filter products based on search
  const filteredProducts = useProductSearch(prodotti, searchTerm, [
    "descrizione",
    "codice",
    "formato",
  ])

  // Load data from token when validated
  useEffect(() => {
    if (valid && tokenData) {
      // Minimum 1000ms loading + process data
      const startTime = Date.now()

      const processData = async () => {
        setCustomer(tokenData.customer)

        // � Instead of using static data from token, always refresh from backend to get current cart state

        await refreshCartFromBackend()

        // 🔧 ALWAYS pre-fill basic customer data (name, phone, company) from token
        setFormData((prev) => ({
          ...prev,
          shippingAddress: {
            ...prev.shippingAddress,
            name: tokenData.customer.name || "",
            phone: tokenData.customer.phone || "",
            company: tokenData.customer.company || "",
          },
          billingAddress: {
            ...prev.billingAddress,
            name: tokenData.customer.name || "",
            phone: tokenData.customer.phone || "",
            company: tokenData.customer.company || "",
          },
        }))

        // Pre-fill addresses if available (will override basic data if present)
        if (tokenData.customer.address) {
          const address =
            typeof tokenData.customer.address === "string"
              ? JSON.parse(tokenData.customer.address)
              : tokenData.customer.address
          setFormData((prev) => ({
            ...prev,
            shippingAddress: {
              name: address.name || tokenData.customer.name || "",
              street: address.street || "",
              city: address.city || "",
              postalCode: address.postalCode || address.zipCode || "",
              province: address.province || "",
              country: address.country || "Italia",
              phone: address.phone || tokenData.customer.phone || "",
              company: address.company || tokenData.customer.company || "",
            },
          }))
        }

        // Pre-fill billing address if available
        if (tokenData.customer.invoiceAddress) {
          const invoiceAddress =
            typeof tokenData.customer.invoiceAddress === "string"
              ? JSON.parse(tokenData.customer.invoiceAddress)
              : tokenData.customer.invoiceAddress
          setFormData((prev) => ({
            ...prev,
            billingAddress: {
              name:
                `${invoiceAddress.firstName || ""} ${
                  invoiceAddress.lastName || ""
                }`.trim() ||
                tokenData.customer.name ||
                "",
              street: invoiceAddress.address || "",
              city: invoiceAddress.city || "",
              postalCode: invoiceAddress.postalCode || "",
              province: invoiceAddress.province || "",
              country: invoiceAddress.country || "Italia",
              phone: invoiceAddress.phone || tokenData.customer.phone || "",
              company:
                invoiceAddress.company || tokenData.customer.company || "",
            },
            sameAsBilling: true, // 🎯 DEFAULT: Sempre true di default
          }))
        } else {
          // If no invoice address, use shipping address as billing
          setFormData((prev) => ({
            ...prev,
            sameAsBilling: true,
          }))
        }

        // 🎯 TASK: Auto-copy billing address after data is loaded
        setTimeout(() => {
          checkAndAutoCopyBillingAddress()
        }, 100)
      }

      processData().finally(() => {
        const elapsedTime = Date.now() - startTime
        const remainingTime = Math.max(0, 1000 - elapsedTime)

        setTimeout(() => {
          setInitialLoading(false)
        }, remainingTime)
      })
    }
  }, [valid, tokenData])

  // Calculate total using discounted prices (only for products, not services)
  const calculateTotal = () => {
    return prodotti.reduce((sum, prodotto) => {
      const isService = prodotto.itemType === "SERVICE"
      // Services always use base price, products can use discounted price
      const finalPrice = isService
        ? prodotto.prezzo
        : prodotto.prezzoScontato || prodotto.prezzo
      const quantity = prodotto.qty || prodotto.quantita || 1
      return sum + finalPrice * quantity
    }, 0)
  }

  // Handle quantity change
  const handleQuantityChange = async (index: number, newQuantity: number) => {
    if (newQuantity < 1) return
    if (!token) {
      // toast.error("Token non valido per aggiornare la quantità")
      return
    }

    try {
      const product = prodotti[index]
      if (!product.productId) {
        // toast.error("ID prodotto non valido")
        return
      }

      // 🎯 OPTIMISTIC UPDATE: Update UI immediately for better UX
      const oldQuantity = product.qty
      setProdotti((prevProdotti) =>
        prevProdotti.map((p, i) =>
          i === index ? { ...p, qty: newQuantity, quantita: newQuantity } : p
        )
      )

      // 🚀 Call backend API to update quantity
      const response = await tokenApi.put(
        `/cart/${token}/items/${product.productId}`,
        { quantity: newQuantity }
      )

      const result = response.data

      if (!result.success) {
        // 🔄 Revert on error
        setProdotti((prevProdotti) =>
          prevProdotti.map((p, i) =>
            i === index ? { ...p, qty: oldQuantity, quantita: oldQuantity } : p
          )
        )
        throw new Error(result.error || "Failed to update quantity")
      }

      // ✅ Success - UI is already updated, no need to refresh
    } catch (error) {
      logger.error("Error updating quantity:", error)
      // toast.error("Errore nell'aggiornare la quantità")
    }
  }

  // Show delete confirmation
  const showDeleteConfirmation = (
    index: number,
    itemName: string,
    itemType: "PRODUCT" | "SERVICE",
    itemId: string
  ) => {
    setProductToDelete({ index, name: itemName, itemType, itemId })
    setShowDeleteConfirm(true)
  }

  // Remove product after confirmation
  const removeProduct = async () => {
    if (!productToDelete) return
    if (!token) {
      // toast.error("Token non valido per rimuovere l'elemento")
      return
    }

    try {
      const { itemId, itemType, name } = productToDelete

      if (!itemId) {
        // toast.error("ID elemento non valido")
        return
      }

      logger.info(`🗑️ Removing ${itemType}: ${itemId}`)

      // 🚀 Call backend API to remove item (product or service)
      const response = await tokenApi.delete(`/cart/${token}/items/${itemId}`, {
        data: {
          itemType: itemType, // 🎯 CRITICAL: Send itemType to backend
        },
      })

      if (!response.data.success) {
        throw new Error(
          response.data.error || `Failed to remove ${itemType.toLowerCase()}`
        )
      }

      logger.info(`✅ ${itemType} removed successfully`)

      // 🔄 Refresh cart data from backend
      await refreshCartFromBackend()

      // Close confirmation dialog
      setShowDeleteConfirm(false)
      setProductToDelete(null)

      // Show success message
      // toast.success(`${name} rimosso dal carrello`)
    } catch (error) {
      logger.error("Error removing item:", error)
      // toast.error("Errore nel rimuovere l'elemento")
    }
  }

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setProductToDelete(null)
  }

  // Refresh cart data from backend
  const refreshCartFromBackend = async () => {
    if (!token) return

    try {
      const response = await tokenApi.get(`/cart/${token}`)
      const result = response.data

      logger.info("🔍 Backend response:", result)
      logger.info("🔍 result.data:", result.data)
      logger.info("🔍 result.data.items:", result.data?.items)
      logger.info("🔍 result.prodotti:", result.prodotti)

      if (result.success && result.data) {
        // Convert backend cart items to frontend format
        const updatedProdotti = result.data.items.map((item: any) => {
          // 🎯 Handle both PRODUCT and SERVICE items
          if (item.itemType === "SERVICE") {
            return {
              id: item.id,
              serviceId: item.serviceId,
              itemType: "SERVICE",
              codice: item.serviceCode || "N/A",
              descrizione: item.name || "Servizio senza nome",
              formato: null,
              prezzo: item.originalPrice || 0,
              prezzoOriginale: item.originalPrice || 0,
              prezzoScontato: undefined, // Services are NEVER discounted
              scontoApplicato: 0, // Services have NO discount
              fonteSconto: null,
              nomeSconto: null,
              qty: 1, // Services always have quantity 1
              quantita: 1,
              duration: item.duration || null,
              notes: item.notes || null,
              imageUrl: item.imageUrl || [], // 🖼️ Service images
            }
          } else {
            return {
              id: item.id,
              productId: item.productId,
              itemType: "PRODUCT",
              codice: item.productCode || "Non disponibile",
              descrizione: item.name || "Prodotto senza nome",
              formato: item.formato || null,
              prezzo: item.originalPrice || 0,
              prezzoOriginale: item.originalPrice || 0,
              prezzoScontato: item.finalPrice || item.originalPrice || 0,
              scontoApplicato: item.appliedDiscount || 0,
              fonteSconto: null,
              nomeSconto: null,
              qty: item.quantity,
              quantita: item.quantity,
              imageUrl: item.imageUrl || [], // 🖼️ Product images
            }
          }
        })

        // 🔧 Sort: PRODUCTS first, SERVICES after
        const sortedProdotti = updatedProdotti.sort((a, b) => {
          if (a.itemType === "PRODUCT" && b.itemType === "SERVICE") return -1
          if (a.itemType === "SERVICE" && b.itemType === "PRODUCT") return 1
          return 0
        })

        setProdotti(sortedProdotti)
        logger.info(`🔄 Cart refreshed: ${sortedProdotti.length} items`)
      }
    } catch (error) {
      logger.error("Error refreshing cart from backend:", error)
    }
  }

  // Load available products
  const loadAvailableProducts = async () => {
    // 🔧 FIX: Get workspaceId from tokenData.data (correct path)
    const workspaceId = tokenData?.data?.workspaceId || tokenData?.workspaceId
    if (!workspaceId) {
      logger.error("No workspaceId found in tokenData:", tokenData)
      return
    }

    setLoadingProducts(true)
    try {
      const response = await fetch("/api/internal/get-all-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspaceId,
          customerId: customer?.id,
        }),
      })

      const result = await response.json()
      if (result.success) {
        // 🔍 DEBUG: Log products data to understand the structure

        // 🔧 Clean up any products with missing names
        const cleanedProducts = (result.data.products || []).map((product) => ({
          ...product,
          name: product.name || "Prodotto senza nome",
        }))

        setAvailableProducts(cleanedProducts)
      }
    } catch (error) {
      logger.error("Error loading products:", error)
    } finally {
      setLoadingProducts(false)
    }
  }

  // Load available services for adding to cart
  const loadAvailableServices = async () => {
    const workspaceId = tokenData?.workspaceId
    logger.info("🔍 LoadAvailableServices called, workspaceId:", workspaceId)
    logger.info("🔍 Full tokenData:", tokenData)

    if (!workspaceId) {
      logger.error("❌ No workspaceId found in tokenData:", tokenData)
      // toast.error("Workspace ID non trovato")
      return
    }

    setLoadingServices(true)
    try {
      const url = "/api/services/public"
      logger.info(`🌐 Fetching services from: ${url}`)
      logger.info(`🌐 With workspace ID: ${workspaceId}`)

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
      })

      logger.info(`📡 Response status: ${response.status}`)
      const result = await response.json()
      logger.info(`📦 Response data:`, result)

      if (result.success) {
        const cleanedServices = (result.data || []).map((service: any) => ({
          ...service,
          name: service.name || "Servizio senza nome",
        }))

        logger.info(
          `✅ Setting ${cleanedServices.length} services:`,
          cleanedServices
        )
        setAvailableServices(cleanedServices)
        // toast.success(`${cleanedServices.length} servizi caricati`)
      } else {
        logger.error("❌ API returned success: false", result)
        // toast.error("Errore nel caricamento dei servizi")
      }
    } catch (error) {
      logger.error("❌ Error loading services:", error)
      // toast.error("Errore di rete nel caricamento servizi")
    } finally {
      setLoadingServices(false)
    }
  }

  // Group products by category
  const groupProductsByCategory = (products: any[]) => {
    const grouped = products.reduce((acc, product) => {
      const category = product.categoria || product.category || "Varie"
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(product)
      return acc
    }, {} as Record<string, any[]>)

    // Sort categories and products within categories
    const sortedCategories = Object.keys(grouped).sort()
    const result: Record<string, any[]> = {}

    sortedCategories.forEach((category) => {
      result[category] = grouped[category].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      )
    })

    return result
  }

  // Add product to cart
  const addProductToCart = async (product: any) => {
    if (!token) {
      // toast.error("Token non valido per aggiungere prodotti al carrello")
      return
    }

    try {
      // 🔍 DEBUG: Log product data to understand the structure

      // 🚀 Call backend API to add product to cart
      const response = await tokenApi.post(`/cart/${token}/items`, {
        productId: product.id,
        quantity: 1,
        notes: `Added from checkout page - ${product.name}`,
      })

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to add product to cart")
      }

      // 🔄 Refresh cart data from backend
      await refreshCartFromBackend()

      // Close popup and show updated cart
      setShowAddProducts(false)

      // Show success message
      // toast.success(`${product.name || "Prodotto"} aggiunto al carrello!`)
    } catch (error) {
      logger.error("❌ Error adding product to cart:", error)
      // toast.error("Errore nell'aggiungere il prodotto al carrello")
    }
  }

  // Add service to cart (treated as a special product)
  const addServiceToCart = async (service: any) => {
    if (!token) {
      // toast.error("Token non valido per aggiungere servizi al carrello")
      return
    }

    try {
      logger.info("🛒 Adding service to cart:", service)

      // 🚀 Call backend API to add service to cart
      const response = await tokenApi.post(`/cart/${token}/items`, {
        serviceId: service.id,
        itemType: "SERVICE",
        quantity: 1,
        notes: service.description || null,
      })

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to add service")
      }

      logger.info("✅ Service added successfully")

      // 🔄 Refresh cart data from backend
      await refreshCartFromBackend()

      // Close popup
      setShowAddServices(false)

      // Show success message
      // toast.success(`${service.name || "Servizio"} aggiunto al carrello!`)
    } catch (error) {
      logger.error("❌ Error adding service to cart:", error)
      // toast.error("Errore nell'aggiungere il servizio al carrello")
    }
  }

  // Handle form input changes
  const handleInputChange = (
    section: "shippingAddress" | "billingAddress",
    field: string,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }))

    // 🎯 TASK: Auto-copy billing address if shipping address is being updated
    if (section === "shippingAddress") {
      // Use setTimeout to ensure state is updated before checking
      setTimeout(() => {
        checkAndAutoCopyBillingAddress()
      }, 0)
    }
  }

  // Handle same as billing checkbox
  const handleSameAsBillingChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      sameAsBilling: checked,
      billingAddress: checked ? prev.shippingAddress : prev.billingAddress,
    }))
  }

  // 🎯 TASK: Auto-copy billing address from shipping when billing is empty
  const checkAndAutoCopyBillingAddress = () => {
    setFormData((prev) => {
      // Check if billing address is empty (all fields empty or just whitespace)
      const isBillingEmpty =
        !prev.billingAddress.name?.trim() &&
        !prev.billingAddress.street?.trim() &&
        !prev.billingAddress.city?.trim() &&
        !prev.billingAddress.postalCode?.trim()

      // Check if shipping address has data
      const hasShippingData =
        prev.shippingAddress.name?.trim() ||
        prev.shippingAddress.street?.trim() ||
        prev.shippingAddress.city?.trim() ||
        prev.shippingAddress.postalCode?.trim()

      // Auto-copy if billing is empty and shipping has data
      if (isBillingEmpty && hasShippingData && !prev.sameAsBilling) {
        return {
          ...prev,
          sameAsBilling: true,
          billingAddress: prev.shippingAddress,
        }
      }

      return prev
    })
  }

  // Validate step 2 form data
  const validateStep2 = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    // Validate shipping address (name, phone, company are hidden fields and pre-filled)
    if (!formData.shippingAddress.street?.trim()) {
      errors.push("Indirizzo per spedizione è obbligatorio")
    }
    if (!formData.shippingAddress.city?.trim()) {
      errors.push("Città per spedizione è obbligatoria")
    }
    if (!formData.shippingAddress.postalCode?.trim()) {
      errors.push("CAP per spedizione è obbligatorio")
    }
    if (!formData.shippingAddress.country?.trim()) {
      errors.push("Paese per spedizione è obbligatorio")
    }

    // Validate billing address if not same as shipping (name, phone, company are auto-filled)
    if (!formData.sameAsBilling) {
      if (!formData.billingAddress.street?.trim()) {
        errors.push("Indirizzo per fatturazione è obbligatorio")
      }
      if (!formData.billingAddress.city?.trim()) {
        errors.push("Città per fatturazione è obbligatoria")
      }
      if (!formData.billingAddress.postalCode?.trim()) {
        errors.push("CAP per fatturazione è obbligatorio")
      }
      if (!formData.billingAddress.country?.trim()) {
        errors.push("Paese per fatturazione è obbligatorio")
      }
    }

    return { valid: errors.length === 0, errors }
  }

  // Handle step progression with validation
  const handleNextStep = () => {
    if (currentStep === 2) {
      const validation = validateStep2()
      if (!validation.valid) {
        // toast.error("Compila tutti i campi obbligatori:")
        // validation.errors.forEach((error) => toast.error(`• ${error}`))
        return
      }
    }

    // Auto-copy billing address before going to step 3
    checkAndAutoCopyBillingAddress()
    setCurrentStep(currentStep + 1)
  }

  // Submit order
  const handleSubmit = async () => {
    if (prodotti.length === 0) return

    // Final validation before submit
    const validation = validateStep2()
    if (!validation.valid) {
      // toast.error("Errore nella validazione dei dati:")
      // validation.errors.forEach((error) => toast.error(`• ${error}`))
      return
    }

    setSubmitStatus({ loading: true, success: false, error: "" })

    try {
      const response = await tokenApi.post("/checkout/submit", {
        token,
        prodotti,
        shippingAddress: formData.shippingAddress,
        billingAddress: formData.billingAddress,
        notes: formData.notes,
      })

      const result = response.data

      if (result.success) {
        setSubmitStatus({ loading: false, success: true, error: "" })
        // Redirect to success page after 2 seconds with token and customer language
        setTimeout(() => {
          const params = new URLSearchParams({
            orderCode: result.orderCode,
          })

          // Add token if available
          if (token) {
            params.append("token", token)
          }

          // Add customer language if available
          if (customer?.language) {
            params.append("lang", customer.language)
          }

          window.location.href = `/checkout-success?${params.toString()}`
        }, 2000)
      } else {
        setSubmitStatus({
          loading: false,
          success: false,
          error: result.error || "Errore durante la creazione dell'ordine",
        })
      }
    } catch (error) {
      setSubmitStatus({
        loading: false,
        success: false,
        error: "Errore di connessione",
      })
    }
  }

  // Show loading state during token validation - use centralized localization
  const texts = getPublicPageTexts(customer?.language)

  if (loading || (valid && initialLoading)) {
    return (
      <UnifiedLoading title={texts.loading} message={texts.loadingMessage} />
    )
  }

  // Show error if token is invalid
  if (error || !valid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <TokenError
          error={error || "Token checkout non valido"}
          errorType={errorType}
          expiresAt={expiresAt}
          onRetry={validateToken}
          showRetry={true}
          className="max-w-md w-full"
        />
      </div>
    )
  }

  // Render checkout page content when token is valid
  const checkoutIcon = (
    <svg
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )

  // Define steps array for ProgressSteps component
  const stepsArray = [
    { num: 1, label: texts.steps.products },
    { num: 2, label: texts.steps.addresses },
    { num: 3, label: texts.steps.confirm },
    { num: 4, label: "Pagamento" },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header with integrated menu */}
      <StickyHeader
        title={texts.finalizeOrder}
        subtitle={texts.greeting.replace("{name}", customer?.name || "")}
        icon={checkoutIcon}
        showMenu={true}
        token={token}
        currentPage="cart"
        customerLanguage={customer?.language}
      />

      {/* Main Content */}
      <div className="pt-[60px] -mt-10">
        {" "}
        {/* Exact header height: 60px - PULL UP with negative margin */}
        <div className="max-w-3xl mx-auto px-3 sm:px-4">
          {/* Progress Steps - New Modular Component - NO top margin */}
          <div className="mb-3">
            <ProgressSteps
              currentStep={currentStep}
              steps={stepsArray}
              onStepClick={(stepNum) => setCurrentStep(stepNum)}
            />
          </div>

          {/* Step 1: Products - New Modular Component */}
          {currentStep === 1 && (
            <div className="mb-3">
              <Step1Products
                products={prodotti}
                texts={texts}
                onAddProducts={() => {
                  setShowAddProducts(true)
                  loadAvailableProducts()
                }}
                onAddServices={() => {
                  setShowAddServices(true)
                  loadAvailableServices()
                }}
                onQuantityChange={handleQuantityChange}
                onDeleteProduct={(index, name, itemType, itemId) =>
                  showDeleteConfirmation(index, name, itemType, itemId)
                }
                onNext={() => setCurrentStep(2)}
              />
            </div>
          )}

          {/* Step 2: Addresses - New Modular Component */}
          {currentStep === 2 && (
            <div className="mb-3">
              <Step2Addresses
                shippingAddress={formData.shippingAddress}
                billingAddress={formData.billingAddress}
                sameAsBilling={formData.sameAsBilling}
                texts={texts}
                onShippingChange={(field, value) =>
                  handleInputChange("shippingAddress", field, value)
                }
                onBillingChange={(field, value) =>
                  handleInputChange("billingAddress", field, value)
                }
                onSameAsBillingChange={handleSameAsBillingChange}
                onNext={handleNextStep}
              />
            </div>
          )}

          {/* Step 3: Confirmation - New Modular Component */}
          {currentStep === 3 && (
            <div className="mb-3">
              <Step3Confirm
                products={prodotti}
                shippingAddress={formData.shippingAddress}
                billingAddress={formData.billingAddress}
                sameAsBilling={formData.sameAsBilling}
                notes={formData.notes}
                texts={texts}
                onNotesChange={(value) =>
                  setFormData((prev) => ({ ...prev, notes: value }))
                }
                onNext={() => setCurrentStep(4)}
              />
            </div>
          )}

          {/* Step 4: Payment - New Modular Component */}
          {currentStep === 4 && (
            <div className="mb-3">
              <Step4Payment
                total={calculateTotal()}
                texts={texts}
                onConfirm={handleSubmit}
                loading={submitStatus.loading}
              />
            </div>
          )}
        </div>
        {/* Add Products Modal */}
        {showAddProducts && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-4 max-w-4xl w-full mx-4 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold">{texts.selectProducts}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddProducts(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-4">
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder={texts.searchProductsPlaceholder}
                  className="w-full"
                />
              </div>

              {loadingProducts ? (
                <div className="text-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">{texts.loadingProducts}</p>
                </div>
              ) : (
                (() => {
                  // Filter products based on search term
                  const filteredAvailableProducts = availableProducts.filter(
                    (product) =>
                      product.name
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                      (product.codice &&
                        product.codice
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase())) ||
                      (product.formato &&
                        product.formato
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase())) ||
                      (product.categoria &&
                        product.categoria
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()))
                  )

                  // Group filtered products by category
                  const groupedProducts = groupProductsByCategory(
                    filteredAvailableProducts
                  )

                  return Object.keys(groupedProducts).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(groupedProducts).map(
                        ([category, categoryProducts]) => (
                          <div
                            key={category}
                            className="border-b pb-3 last:border-b-0"
                          >
                            {/* Solo mostra il titolo della categoria se non è "Varie" e se ci sono più categorie */}
                            {category !== "Varie" &&
                              Object.keys(groupedProducts).length > 1 && (
                                <h4 className="text-md font-medium text-gray-700 mb-2 border-l-3 border-blue-500 pl-2">
                                  {category}
                                </h4>
                              )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {categoryProducts.map((product) => (
                                <div
                                  key={product.id}
                                  className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-white"
                                >
                                  {/* 🖼️ Product Image - ALWAYS SHOW */}
                                  <div className="w-full h-40 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                                    {getImageUrl(product.imageUrl) ? (
                                      <img
                                        src={getImageUrl(product.imageUrl)!}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 flex items-center justify-center">
                                        <span className="text-6xl opacity-30">
                                          📦
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Product Info */}
                                  <div className="p-3">
                                    <h5 className="font-semibold text-sm mb-1">
                                      {product.name}
                                    </h5>
                                    {product.formato && (
                                      <div className="text-xs text-blue-600 mb-1 font-medium">
                                        Formato: {product.formato}
                                      </div>
                                    )}
                                    <p className="text-xs text-gray-600 mb-2">
                                      Codice:{" "}
                                      {product.ProductCode ||
                                        product.sku ||
                                        "Non disponibile"}
                                    </p>
                                    <div className="mb-2">
                                      {product.finalPrice &&
                                      product.finalPrice < product.price ? (
                                        <div className="flex flex-col">
                                          <p className="text-lg font-bold text-green-600">
                                            €{product.finalPrice.toFixed(2)}
                                          </p>
                                          <div className="flex items-center space-x-2">
                                            <p className="text-sm text-gray-500 line-through">
                                              €{product.price.toFixed(2)}
                                            </p>
                                            {product.appliedDiscount &&
                                              product.appliedDiscount > 0 && (
                                                <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                                                  -{product.appliedDiscount}%
                                                </span>
                                              )}
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-lg font-bold text-green-600">
                                          €{product.price.toFixed(2)}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex justify-center">
                                      <button
                                        onClick={() =>
                                          addProductToCart(product)
                                        }
                                        className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded text-sm transition-colors flex items-center gap-2 min-w-[120px] justify-center"
                                      >
                                        <span className="text-xl font-bold">
                                          +
                                        </span>
                                        {texts.addToCart}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">
                        {searchTerm
                          ? "Nessun prodotto trovato per la ricerca"
                          : "Nessun prodotto disponibile"}
                      </p>
                    </div>
                  )
                })()
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowAddProducts(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
                >
                  {texts.close}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Add Services Popup */}
        {showAddServices && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold">🛠️ Seleziona Servizi</h3>
                <button
                  onClick={() => setShowAddServices(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                {loadingServices ? (
                  <div className="text-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Caricamento servizi...</p>
                  </div>
                ) : availableServices.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableServices.map((service) => (
                      <div
                        key={service.id}
                        className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-white"
                      >
                        {/* 🖼️ Service Image */}
                        <div className="w-full h-40 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                          {getImageUrl(service.imageUrl) ? (
                            <img
                              src={getImageUrl(service.imageUrl)!}
                              alt={service.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 flex items-center justify-center">
                              <span className="text-6xl opacity-30">🛠️</span>
                            </div>
                          )}
                        </div>

                        {/* Service Info */}
                        <div className="p-4">
                          <h5 className="font-semibold text-sm mb-3">
                            {service.name}
                          </h5>
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-bold text-blue-600">
                              €{(service.price || 0).toFixed(2)}
                            </p>
                            <button
                              onClick={() => addServiceToCart(service)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              {texts.addToCart}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Nessun servizio disponibile</p>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowAddServices(false)}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
                  >
                    {texts.close}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && productToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">⚠️</span>
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {texts.confirmDelete}
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  {texts.confirmDeleteMessage.replace(
                    "{name}",
                    productToDelete.name
                  )}
                </p>

                <div className="flex space-x-3 justify-center">
                  <button
                    onClick={cancelDelete}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                  >
                    {texts.cancel}
                  </button>
                  <button
                    onClick={removeProduct}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    {texts.remove}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CheckoutPage
