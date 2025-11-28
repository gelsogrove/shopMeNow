import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import {
  ordersApi,
  type ItemType,
  type Order,
  type OrderStatus,
  type PaymentMethod,
} from "@/services/ordersApi"
import { productsApi } from "@/services/productsApi"
import { servicesApi } from "@/services/servicesApi"
import { formatPrice } from "@/utils/format"
import { getProductIcon, getServiceIcon } from "@/utils/productIcons"
import {
  FileText,
  Package,
  ShoppingCart,
  Trash2,
  Truck,
  Wrench,
} from "lucide-react"
import { useEffect, useState } from "react"
import { getStatusBadgeClass, getStatusBadgeVariant } from "./orderUtils"

interface Product {
  id: string
  name: string
  price: number
  categoryId: string
}

interface Service {
  id: string
  name: string
  price: number
  duration?: number
}

interface CartItemEditSheetProps {
  order: Order | null
  open: boolean
  onClose: () => void
  onSave: (order: Order) => void
}

export function CartItemEditSheet({
  order,
  open,
  onClose,
  onSave,
}: CartItemEditSheetProps) {
  const { workspace } = useWorkspace()
  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [productsWithPrices, setProductsWithPrices] = useState<any[]>([])
  const [editingItems, setEditingItems] = useState<any[]>([])
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showAddService, setShowAddService] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedServiceId, setSelectedServiceId] = useState("")
  const [productQuantity, setProductQuantity] = useState(1)

  // Add state for editable order fields
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(
    order?.status || "PENDING"
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    order?.paymentMethod || null
  )
  const [trackingNumber, setTrackingNumber] = useState<string>(
    order?.trackingNumber || ""
  )
  const [notes, setNotes] = useState<string>(order?.notes || "")

  useEffect(() => {
    if (open && order) {
      // Load initial cart items
      setEditingItems([...order.items])

      // Set initial order status and payment method
      setOrderStatus(order.status)
      setPaymentMethod(order.paymentMethod)
      setTrackingNumber(order.trackingNumber || "")
      setNotes(order.notes || "")

      // Load products and services
      const loadData = async () => {
        if (!workspace?.id) return

        try {
          const [productsRes, servicesRes] = await Promise.all([
            productsApi.getAllForWorkspace(workspace.id),
            servicesApi.getServices(workspace.id),
          ])

          const loadedProducts = productsRes?.products || []
          setProducts(loadedProducts)
          setServices(servicesRes || [])

          // Calculate discounted prices for each product (with customer discount if available)
          const productsWithDiscountedPrices = await Promise.all(
            loadedProducts.map(async (product: any) => {
              try {
                const response = await api.post(
                  `/workspaces/${workspace.id}/cart/calculate-price`,
                  {
                    productId: product.id,
                    quantity: 1,
                    customerId: order?.customerId || null,
                  }
                )
                return {
                  ...product,
                  discountedPrice: response.data.unitPrice,
                  originalPrice: response.data.originalPrice,
                  discountApplied: response.data.discountApplied,
                }
              } catch (error) {
                // If calculation fails, use base price
                return {
                  ...product,
                  discountedPrice: product.price,
                  originalPrice: product.price,
                  discountApplied: null,
                }
              }
            })
          )
          setProductsWithPrices(productsWithDiscountedPrices)
        } catch (error) {
          logger.error("Error loading data:", error)
          toast.error("Failed to load products and services")
        }
      }

      loadData()
    }
  }, [open, order, workspace?.id])

  // Function to handle status change with immediate save
  const handleStatusChange = (newStatus: OrderStatus) => {
    setOrderStatus(newStatus)
  }

  // Function to handle payment method change with immediate save
  const handlePaymentMethodChange = (
    newPaymentMethod: PaymentMethod | null
  ) => {
    setPaymentMethod(newPaymentMethod)
  }

  const handleAddProduct = async () => {
    if (!selectedProductId || !workspace?.id) return

    const product = products.find((p) => p.id === selectedProductId)
    if (!product) return

    try {
      // Call backend to calculate discounted price with active offers and customer discount
      const response = await api.post(
        `/workspaces/${workspace.id}/cart/calculate-price`,
        {
          productId: selectedProductId,
          quantity: productQuantity,
          customerId: order?.customerId || null,
        }
      )

      const { unitPrice, totalPrice, originalPrice, discountApplied } =
        response.data

      const newItem = {
        id: `temp-${Date.now()}`,
        itemType: "PRODUCT" as ItemType,
        productId: selectedProductId,
        product: product,
        serviceId: null,
        service: null,
        quantity: productQuantity,
        unitPrice: unitPrice, // Prezzo scontato per unità
        totalPrice: totalPrice, // Totale scontato
        originalPrice: originalPrice, // Prezzo originale per riferimento
        discountApplied: discountApplied, // Info sullo sconto applicato
      }

      setEditingItems([...editingItems, newItem])
      setSelectedProductId("")
      setProductQuantity(1)
      setShowAddProduct(false)

      if (discountApplied) {
        toast.success(`Discount applied: ${discountApplied}`)
      }
    } catch (error) {
      logger.error("Error calculating price:", error)
      // Fallback to base price if calculation fails
      const newItem = {
        id: `temp-${Date.now()}`,
        itemType: "PRODUCT" as ItemType,
        productId: selectedProductId,
        product: product,
        serviceId: null,
        service: null,
        quantity: productQuantity,
        unitPrice: product.price,
        totalPrice: product.price * productQuantity,
      }
      setEditingItems([...editingItems, newItem])
      setSelectedProductId("")
      setProductQuantity(1)
      setShowAddProduct(false)
    }
  }

  const handleAddService = () => {
    if (!selectedServiceId) return

    const service = services.find((s) => s.id === selectedServiceId)
    if (!service) return

    const newItem = {
      id: `temp-${Date.now()}`,
      itemType: "SERVICE" as ItemType,
      productId: null,
      product: null,
      serviceId: selectedServiceId,
      service: service,
      quantity: 1, // Services always quantity 1
      unitPrice: service.price,
      totalPrice: service.price,
    }

    setEditingItems([...editingItems, newItem])
    setSelectedServiceId("")
    setShowAddService(false)
  }

  const handleRemoveItem = (itemId: string) => {
    setEditingItems(editingItems.filter((item) => item.id !== itemId))
  }

  const handleUpdateProductQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    // Calculate the new items array
    const newItems = editingItems.map((item) => {
      if (item.id === itemId) {
        // Determine item type more robustly
        const itemType =
          item.itemType || (item.serviceId ? "SERVICE" : "PRODUCT")

        // Only update quantity for products
        if (itemType === "PRODUCT") {
          return {
            ...item,
            quantity: newQuantity,
            totalPrice: item.unitPrice * newQuantity,
          }
        }
      }
      return item
    })

    // Update local state only - no auto-save
    setEditingItems(newItems)
  }

  const handleSave = async () => {
    if (!order || !workspace?.id || isSaving) return

    setIsSaving(true)
    try {
      // Calculate new total amount
      const newTotalAmount = editingItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      )

      // Validate we have items and total
      if (editingItems.length === 0) {
        toast.error("Cannot save an empty cart")
        setIsSaving(false)
        return
      }

      if (newTotalAmount <= 0) {
        toast.error("Cart total must be greater than zero")
        setIsSaving(false)
        return
      }

      // Prepare the updated order data for API
      const updateData = {
        totalAmount: newTotalAmount,
        status: orderStatus,
        paymentMethod: paymentMethod,
        trackingNumber: trackingNumber,
        notes: notes,
        items: editingItems.map((item) => ({
          itemType: item.itemType || (item.serviceId ? "SERVICE" : "PRODUCT"),
          productId: item.productId,
          serviceId: item.serviceId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          productVariant: item.productVariant || null,
        })),
      }

      // Save via API
      const updatedOrder = await ordersApi.update(
        order.id,
        workspace.id,
        updateData
      )

      // Update parent component data but DON'T close the slide
      onSave(updatedOrder)

      // Update local order data to reflect changes
      order.totalAmount = newTotalAmount

      // Note: success message will be shown by handleOrderSave
    } catch (error) {
      logger.error("Error saving cart:", error)

      // Parse the error more carefully
      let errorMessage = "Please try again."
      if (error && typeof error === "object") {
        if (
          "response" in error &&
          error.response &&
          typeof error.response === "object"
        ) {
          if (
            "data" in error.response &&
            error.response.data &&
            typeof error.response.data === "object"
          ) {
            if (
              "message" in error.response.data &&
              typeof error.response.data.message === "string"
            ) {
              errorMessage = error.response.data.message
            }
          }
        } else if ("message" in error && typeof error.message === "string") {
          errorMessage = error.message
        }
      }

      toast.error("Failed to update cart: " + errorMessage)
      // DON'T close the slide on error - let user try again
    } finally {
      setIsSaving(false)
    }
  }

  if (!order) return null

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        // Only close if explicitly requested, not on outside click
        if (!isOpen) {
          onClose()
        }
      }}
    >
      <SheetContent
        side="right"
        className="max-w-[90%] overflow-y-auto"
        onInteractOutside={(e) => {
          // Prevent closing on outside click
          e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          // Allow escape to close
          onClose()
        }}
      >
        <SheetHeader className="border-b pb-3 mb-4">
          <SheetTitle className="text-xl font-bold text-gray-900">
            Edit Order {order.orderCode}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Order Header Card */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold text-gray-900">
                    Order {order.orderCode}
                  </CardTitle>
                  <p className="text-gray-600 text-sm">
                    {order.customer?.name || "Unknown Customer"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Amount</p>
                  <p className="text-xl font-bold text-gray-900">
                    €{order.totalAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status and Payment in one clean row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700">
                    Status
                  </Label>
                  <div className="flex items-center gap-3">
                    <Select
                      value={orderStatus}
                      onValueChange={handleStatusChange}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                        <SelectItem value="PROCESSING">Processing</SelectItem>
                        <SelectItem value="SHIPPED">Shipped</SelectItem>
                        <SelectItem value="DELIVERED">Delivered</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge
                      variant={getStatusBadgeVariant(orderStatus)}
                      className={getStatusBadgeClass(orderStatus)}
                    >
                      {orderStatus}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700">
                    Payment Method
                  </Label>
                  <div className="flex items-center gap-3">
                    <Select
                      value={paymentMethod || "NONE"}
                      onValueChange={(value) =>
                        handlePaymentMethodChange(
                          value === "NONE" ? null : (value as PaymentMethod)
                        )
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">None</SelectItem>
                        <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                        <SelectItem value="DEBIT_CARD">Debit Card</SelectItem>
                        <SelectItem value="PAYPAL">PayPal</SelectItem>
                        <SelectItem value="BANK_TRANSFER">
                          Bank Transfer
                        </SelectItem>
                        <SelectItem value="CASH_ON_DELIVERY">
                          Cash on Delivery
                        </SelectItem>
                        <SelectItem value="CRYPTO">Cryptocurrency</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge
                      variant="outline"
                      className="bg-gray-50 text-gray-700 border-gray-300"
                    >
                      {paymentMethod
                        ? paymentMethod.replace(/_/g, " ")
                        : "None"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Tracking Number field */}
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Tracking Number
                </Label>
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="1234567890"
                  className="max-w-md"
                />
                <p className="text-sm text-gray-500">
                  Optional. Leave blank if not available.
                </p>
              </div>

              {/* Notes field */}
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Notes
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes for this order..."
                  rows={2}
                  className="max-w-md"
                />
                <p className="text-sm text-gray-500">
                  Optional. Add any additional information about this order.
                </p>
              </div>

              <div className="text-sm text-gray-500">
                Order created on{" "}
                {new Date(order.createdAt).toLocaleDateString("en-GB")} at{" "}
                {new Date(order.createdAt).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </CardContent>
          </Card>

          {/* Addresses Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Shipping Address */}
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <Truck className="h-4 w-4 text-green-600" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-gray-700 leading-relaxed">
                  {order.shippingAddress ? (
                    <div className="space-y-1">
                      {(order.shippingAddress.street ||
                        order.shippingAddress.address) && (
                        <div>
                          {order.shippingAddress.street ||
                            order.shippingAddress.address}
                        </div>
                      )}
                      {order.shippingAddress.city && (
                        <div>{order.shippingAddress.city}</div>
                      )}
                      {(order.shippingAddress.zipCode ||
                        order.shippingAddress.postalCode) && (
                        <div>
                          {order.shippingAddress.zipCode ||
                            order.shippingAddress.postalCode}
                        </div>
                      )}
                      {order.shippingAddress.country && (
                        <div>{order.shippingAddress.country}</div>
                      )}
                      {order.shippingAddress.phone && (
                        <div className="text-sm text-gray-600">
                          📞 {order.shippingAddress.phone}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500 italic">Not specified</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Invoice Address */}
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Invoice Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.customer?.invoiceAddress ? (
                  <div className="space-y-2 text-gray-700">
                    <div className="font-medium">
                      {order.customer.invoiceAddress.firstName}{" "}
                      {order.customer.invoiceAddress.lastName}
                    </div>
                    {order.customer.invoiceAddress.company && (
                      <div className="text-sm text-gray-600">
                        {order.customer.invoiceAddress.company}
                      </div>
                    )}
                    <div className="text-sm">
                      {order.customer.invoiceAddress.address}
                      <br />
                      {order.customer.invoiceAddress.city}{" "}
                      {order.customer.invoiceAddress.postalCode}
                      <br />
                      {order.customer.invoiceAddress.country}
                    </div>
                    {order.customer.invoiceAddress.vatNumber && (
                      <div className="text-sm text-gray-600">
                        VAT: {order.customer.invoiceAddress.vatNumber}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">
                    No invoice address available for this customer.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cart Items */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                  Cart Items ({editingItems.length})
                </CardTitle>
                <div className="flex items-center gap-4">
                  <div className="text-lg font-bold text-gray-900">
                    Total:{" "}
                    {formatPrice(
                      editingItems.reduce(
                        (sum, item) => sum + item.totalPrice,
                        0
                      ),
                      workspace?.currency
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddProduct(true)}
                      disabled={
                        orderStatus !== "PENDING" &&
                        orderStatus !== "PROCESSING"
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:bg-gray-400"
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddService(true)}
                      disabled={
                        orderStatus !== "PENDING" &&
                        orderStatus !== "PROCESSING"
                      }
                      className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:bg-gray-400"
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Add Service
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {editingItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No items in cart</p>
                  <p className="text-sm">
                    Add products or services to get started
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {editingItems.map((item) => {
                    // Determine item type more robustly for display
                    const itemType =
                      item.itemType || (item.serviceId ? "SERVICE" : "PRODUCT")
                    const itemName =
                      itemType === "PRODUCT"
                        ? item.product?.name ||
                          (item.productId
                            ? `Product ${item.productId}`
                            : "Unknown Product")
                        : item.service?.name ||
                          (item.serviceId
                            ? `Service ${item.serviceId}`
                            : "Unknown Service")

                    // Get icon
                    const icon =
                      itemType === "PRODUCT"
                        ? getProductIcon(itemName, item.product?.categoria)
                        : getServiceIcon(itemName)

                    // Get image URL
                    const imageUrl =
                      itemType === "PRODUCT"
                        ? item.product?.imageUrl &&
                          Array.isArray(item.product.imageUrl) &&
                          item.product.imageUrl.length > 0
                          ? item.product.imageUrl[0]
                          : null
                        : item.service?.imageUrl &&
                          Array.isArray(item.service.imageUrl) &&
                          item.service.imageUrl.length > 0
                        ? item.service.imageUrl[0]
                        : null

                    return (
                      <div
                        key={item.id}
                        className="p-6 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            {/* Product/Service Image */}
                            <div className="flex-shrink-0">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={itemName}
                                  className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                                  onError={(e) => {
                                    // Fallback to icon if image fails to load
                                    ;(
                                      e.target as HTMLImageElement
                                    ).style.display = "none"
                                  }}
                                />
                              ) : (
                                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                                  {itemType === "PRODUCT" ? (
                                    <Package className="h-8 w-8 text-gray-400" />
                                  ) : (
                                    <Wrench className="h-8 w-8 text-gray-400" />
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900">
                                  {itemName}
                                </h3>
                                <Badge
                                  variant="outline"
                                  className="text-xs font-medium"
                                >
                                  {itemType}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600">
                                {formatPrice(
                                  item.unitPrice,
                                  workspace?.currency
                                )}{" "}
                                per unit
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            {/* Quantity controls */}
                            {itemType === "PRODUCT" ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleUpdateProductQuantity(
                                      item.id,
                                      item.quantity - 1
                                    )
                                  }}
                                  disabled={
                                    item.quantity <= 1 ||
                                    (orderStatus !== "PENDING" &&
                                      orderStatus !== "PROCESSING")
                                  }
                                  className="h-8 w-8 p-0"
                                >
                                  -
                                </Button>
                                <span className="w-8 text-center text-sm font-medium">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleUpdateProductQuantity(
                                      item.id,
                                      item.quantity + 1
                                    )
                                  }}
                                  disabled={
                                    orderStatus !== "PENDING" &&
                                    orderStatus !== "PROCESSING"
                                  }
                                  className="h-8 w-8 p-0"
                                >
                                  +
                                </Button>
                              </div>
                            ) : (
                              <div className="w-20 text-center">
                                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                                  Qty: 1
                                </span>
                              </div>
                            )}

                            <div className="text-right min-w-[100px]">
                              <p className="text-lg font-bold text-gray-900">
                                {formatPrice(
                                  item.totalPrice,
                                  workspace?.currency
                                )}
                              </p>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleRemoveItem(item.id)
                              }}
                              disabled={
                                orderStatus !== "PENDING" &&
                                orderStatus !== "PROCESSING"
                              }
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add Product Form */}
              {showAddProduct && (
                <div className="p-6 bg-blue-50 border-t border-blue-200">
                  <h4 className="font-semibold mb-4 text-blue-900">
                    Add Product
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Label>Product</Label>
                      <Select
                        value={selectedProductId}
                        onValueChange={setSelectedProductId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {productsWithPrices.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              <span>
                                {product.name} -
                                {product.discountApplied ? (
                                  <>
                                    <span className="line-through text-gray-400 ml-1">
                                      €{product.originalPrice.toFixed(2)}
                                    </span>
                                    <span className="text-green-600 font-semibold ml-1">
                                      €{product.discountedPrice.toFixed(2)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="ml-1">
                                    €{product.price.toFixed(2)}
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={productQuantity}
                        onChange={(e) =>
                          setProductQuantity(parseInt(e.target.value) || 1)
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={handleAddProduct}
                      disabled={!selectedProductId}
                    >
                      Add
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddProduct(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Add Service Form */}
              {showAddService && (
                <div className="p-6 bg-purple-50 border-t border-purple-200">
                  <h4 className="font-semibold mb-4 text-purple-900">
                    Add Service
                  </h4>
                  <div>
                    <Label>Service</Label>
                    <Select
                      value={selectedServiceId}
                      onValueChange={setSelectedServiceId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} - €{service.price}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={handleAddService}
                      disabled={!selectedServiceId}
                    >
                      Add
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddService(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
            {editingItems.length > 0 && (
              <div className="border-t border-gray-100 p-6 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {editingItems.length} item
                    {editingItems.length !== 1 ? "s" : ""} in cart
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={isSaving}
                      size="default"
                      className="px-8"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      size="default"
                      className="bg-green-600 hover:bg-green-700 text-white px-8 disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}
