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
import { clientsApi } from "@/services/clientsApi"
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
import { Plus, Trash2 } from "lucide-react"
import React, { useEffect, useState } from "react"

interface OrderCrudSheetProps {
  order: Order | null
  open: boolean
  onClose: () => void
  onSave: (order: Order) => void
  mode?: "edit" | "create"
}

export function OrderCrudSheet({
  order,
  open,
  onClose,
  onSave,
  mode = "edit",
}: OrderCrudSheetProps) {
  const { workspace } = useWorkspace()
  const [isLoading, setIsLoading] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [selectedItemType, setSelectedItemType] = useState<
    "PRODUCT" | "SERVICE"
  >("PRODUCT")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedServiceId, setSelectedServiceId] = useState("")
  const [itemQuantity, setItemQuantity] = useState(1)
  const [formData, setFormData] = useState({
    orderCode: "",
    customerId: "",
    status: "PENDING" as OrderStatus,
    paymentMethod: null as PaymentMethod | null,
    totalAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    discountAmount: 0,
    notes: "",
    trackingNumber: "",
  })

  // Load customers, products, and services
  useEffect(() => {
    const loadData = async () => {
      if (!workspace?.id) return

      try {
        logger.info("🔄 OrderCrudSheet - Starting to load data...")

        const [customersResponse, productsResponse, servicesResponse] =
          await Promise.all([
            clientsApi.getAllForWorkspace(workspace.id),
            productsApi.getAllForWorkspace(workspace.id),
            servicesApi.getServices(workspace.id),
          ])

        logger.info("🔍 OrderCrudSheet - Raw API responses:")
        logger.info("  - customersResponse:", customersResponse)
        logger.info("  - customersResponse type:", typeof customersResponse)
        logger.info("  - customersResponse.length:", customersResponse?.length)
        logger.info("  - productsResponse:", productsResponse)
        logger.info("  - servicesResponse:", servicesResponse)

        // Handle different response formats for customers
        const customersArray = Array.isArray(customersResponse)
          ? customersResponse
          : (customersResponse as any)?.customers ||
            (customersResponse as any)?.data ||
            []

        setCustomers(customersArray)
        setProducts(productsResponse.products || [])
        setServices(servicesResponse || [])

        logger.info("✅ OrderCrudSheet - Data loaded successfully:")
        logger.info("  - Customers set:", customersArray.length, "items")
        logger.info(
          "  - Products set:",
          (productsResponse.products || []).length,
          "items"
        )
        logger.info(
          "  - Services set:",
          (servicesResponse || []).length,
          "items"
        )

        if (customersArray.length === 0) {
          logger.warn(
            "⚠️ No customers found - this might be why dropdown is empty"
          )
          toast.warning("No customers found. Please add customers first.")
        }
      } catch (error) {
        logger.error("❌ Error loading OrderCrudSheet data:", error)
        toast.error("Failed to load form data")
      }
    }

    if (open) {
      loadData()
    }
  }, [workspace?.id, open])

  // Set initial form data and order items when order changes
  useEffect(() => {
    if (order && mode === "edit") {
      setFormData({
        orderCode: order.orderCode,
        customerId: order.customerId,
        status: order.status,
        paymentMethod: order.paymentMethod,
        totalAmount: order.totalAmount,
        shippingAmount: order.shippingAmount || 0,
        taxAmount: order.taxAmount || 0,
        discountAmount: order.discountAmount || 0,
        notes: order.notes || "",
        trackingNumber: order.trackingNumber || "",
      })
      setOrderItems([...(order.items || [])])
    } else if (mode === "create") {
      setFormData({
        orderCode: "",
        customerId: "",
        status: "PENDING",
        paymentMethod: null,
        totalAmount: 0,
        shippingAmount: 0,
        taxAmount: 0,
        discountAmount: 0,
        notes: "",
        trackingNumber: "",
      })
      setOrderItems([])
    }
  }, [order, mode])

  // Calculate total amount based on items
  useEffect(() => {
    const itemsTotal = orderItems.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0
    )
    const total =
      itemsTotal +
      formData.shippingAmount +
      formData.taxAmount -
      formData.discountAmount
    setFormData((prev) => ({ ...prev, totalAmount: total }))
  }, [
    orderItems,
    formData.shippingAmount,
    formData.taxAmount,
    formData.discountAmount,
  ])

  const handleAddItem = () => {
    if (selectedItemType === "PRODUCT" && selectedProductId) {
      const product = products.find((p) => p.id === selectedProductId)
      if (!product) return

      const newItem = {
        id: `temp-${Date.now()}`,
        itemType: "PRODUCT" as ItemType,
        productId: selectedProductId,
        serviceId: null,
        quantity: itemQuantity,
        unitPrice: product.price,
        totalPrice: product.price * itemQuantity,
        product: product,
        service: null,
      }

      setOrderItems([...orderItems, newItem])
      setSelectedProductId("")
      setItemQuantity(1)
      setShowAddItemDialog(false)
      toast.success("Product added to order")
    } else if (selectedItemType === "SERVICE" && selectedServiceId) {
      const service = services.find((s) => s.id === selectedServiceId)
      if (!service) return

      const newItem = {
        id: `temp-${Date.now()}`,
        itemType: "SERVICE" as ItemType,
        productId: null,
        serviceId: selectedServiceId,
        quantity: 1, // Services always quantity 1
        unitPrice: service.price,
        totalPrice: service.price,
        product: null,
        service: service,
      }

      setOrderItems([...orderItems, newItem])
      setSelectedServiceId("")
      setShowAddItemDialog(false)
      toast.success("Service added to order")
    }
  }

  const handleRemoveItem = (itemId: string) => {
    setOrderItems(orderItems.filter((item) => item.id !== itemId))
    toast.success("Item removed from order")
  }

  const handleUpdateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    setOrderItems(
      orderItems.map((item) => {
        if (item.id === itemId) {
          // Determine item type if not explicitly set
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
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (formData.totalAmount <= 0) {
      toast.error("Total amount must be greater than 0")
      return
    }

    if (!formData.customerId) {
      toast.error("Customer is required")
      return
    }

    if (mode === "create" && orderItems.length === 0) {
      toast.error("Please add at least one product or service")
      return
    }

    if (!workspace?.id) return

    setIsLoading(true)
    try {
      let savedOrder

      // Prepare order data - exclude orderCode for create mode
      const baseOrderData = {
        customerId: formData.customerId,
        status: formData.status,
        paymentMethod: formData.paymentMethod,
        totalAmount: formData.totalAmount,
        shippingAmount: formData.shippingAmount,
        taxAmount: formData.taxAmount,
        discountAmount: formData.discountAmount,
        notes: formData.notes,
        trackingNumber: formData.trackingNumber,
        items: orderItems.map((item) => ({
          itemType: item.itemType,
          productId: item.productId,
          serviceId: item.serviceId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          productVariant: item.productVariant || null,
        })),
      }

      // Add orderCode only for edit mode
      const orderData =
        mode === "edit"
          ? { ...baseOrderData, orderCode: formData.orderCode }
          : baseOrderData

      if (mode === "create") {
        savedOrder = await ordersApi.create(workspace.id, orderData)
      } else if (order) {
        savedOrder = await ordersApi.update(order.id, workspace.id, orderData)
      }

      if (savedOrder) {
        onSave(savedOrder)
        onClose()
        toast.success(
          `Order ${mode === "create" ? "created" : "updated"} successfully`
        )
      }
    } catch (error) {
      logger.error("Error saving order:", error)
      toast.error(`Failed to ${mode} order. Please try again.`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-[70vw] max-w-none overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>
            {mode === "edit"
              ? `Order: ${order?.orderCode}`
              : "Create New Order"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {mode === "edit" && (
                  <div>
                    <Label htmlFor="orderCode">Order Code</Label>
                    <Input
                      id="orderCode"
                      value={formData.orderCode}
                      disabled
                      className="bg-gray-50 text-gray-700"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Order code is automatically generated
                    </p>
                  </div>
                )}
                <div>
                  <Label htmlFor="customer">Customer</Label>
                  {mode === "edit" ? (
                    <Input
                      value={(() => {
                        const customer = customers.find(
                          (c) => c.id === formData.customerId
                        )
                        if (customer?.name && customer?.email) {
                          return `${customer.name} (${customer.email})`
                        }
                        // Fallback: use order's customer data if available
                        if (order?.customer) {
                          return `${order.customer.name} (${order.customer.email})`
                        }
                        return `Customer ID: ${formData.customerId?.substring(
                          0,
                          8
                        )}...`
                      })()}
                      disabled
                      className="bg-gray-50 text-gray-700"
                    />
                  ) : (
                    <Select
                      value={formData.customerId}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, customerId: value }))
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} ({customer.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        status: value as OrderStatus,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                </div>
                <div>
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select
                    value={formData.paymentMethod || "NONE"}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        paymentMethod:
                          value === "NONE" ? null : (value as PaymentMethod),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="trackingNumber">Tracking Number</Label>
                  <Input
                    id="trackingNumber"
                    value={formData.trackingNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        trackingNumber: e.target.value,
                      }))
                    }
                    placeholder="1234567890"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Optional. Leave as default for demo.
                  </p>
                </div>
                <div>
                  <Label htmlFor="totalAmount">Total Amount *</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.totalAmount.toFixed(2)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      if (value > 0) {
                        setFormData((prev) => ({ ...prev, totalAmount: value }))
                      }
                    }}
                    placeholder="0.00"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Final price including all taxes and fees
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products & Services Management */}
          {(mode === "edit" || (mode === "create" && formData.customerId)) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Products & Services
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddItemDialog(true)
                    }}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                    disabled={
                      formData.status !== "PENDING" &&
                      formData.status !== "PROCESSING"
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Add Item Form - Show when dialog is open */}
                {showAddItemDialog && (
                  <div className="border-2 border-green-200 bg-green-50 p-4 rounded-lg mb-4">
                    <h4 className="font-medium mb-3 text-green-800">
                      Add New Item
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Item Type */}
                      <div>
                        <Label>Item Type</Label>
                        <Select
                          value={selectedItemType}
                          onValueChange={(value: "PRODUCT" | "SERVICE") =>
                            setSelectedItemType(value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRODUCT">Product</SelectItem>
                            <SelectItem value="SERVICE">Service</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Product/Service Selection */}
                      {selectedItemType === "PRODUCT" && (
                        <>
                          <div>
                            <Label>Product</Label>
                            <Select
                              value={selectedProductId}
                              onValueChange={setSelectedProductId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((product) => (
                                  <SelectItem
                                    key={product.id}
                                    value={product.id}
                                  >
                                    {product.name} -{" "}
                                    {formatPrice(
                                      product.price,
                                      workspace?.currency
                                    )}
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
                              value={itemQuantity}
                              onChange={(e) =>
                                setItemQuantity(parseInt(e.target.value) || 1)
                              }
                            />
                          </div>
                        </>
                      )}

                      {selectedItemType === "SERVICE" && (
                        <div>
                          <Label>Service</Label>
                          <Select
                            value={selectedServiceId}
                            onValueChange={setSelectedServiceId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a service" />
                            </SelectTrigger>
                            <SelectContent>
                              {services.map((service) => (
                                <SelectItem key={service.id} value={service.id}>
                                  {service.name} -{" "}
                                  {formatPrice(
                                    service.price,
                                    workspace?.currency
                                  )}
                                  {service.duration &&
                                    ` (${service.duration} min)`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setShowAddItemDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddItem}
                        disabled={
                          selectedItemType === "PRODUCT"
                            ? !selectedProductId
                            : !selectedServiceId
                        }
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Add Item
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {orderItems.map((item, index) => {
                    // Determine item type if not explicitly set
                    const itemType =
                      item.itemType || (item.serviceId ? "SERVICE" : "PRODUCT")

                    // Find service or product name
                    const serviceName =
                      itemType === "SERVICE" && item.serviceId
                        ? services.find((s) => s.id === item.serviceId)?.name
                        : null

                    const productName =
                      itemType === "PRODUCT" && item.productId
                        ? products.find((p) => p.id === item.productId)?.name ||
                          item.product?.name
                        : null

                    // Better fallback names
                    const itemName =
                      serviceName ||
                      productName ||
                      (itemType === "SERVICE"
                        ? item.serviceId
                          ? `Service ${item.serviceId}`
                          : "Unknown Service"
                        : item.productId
                        ? `Product ${item.productId}`
                        : "Unknown Product")

                    // Get icon
                    const icon =
                      itemType === "PRODUCT"
                        ? getProductIcon(
                            productName || item.product?.name || "",
                            item.product?.categoria
                          )
                        : getServiceIcon(
                            serviceName || item.service?.name || ""
                          )

                    return (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{icon}</span>
                            <Badge variant="outline" className="text-xs">
                              {itemType === "PRODUCT" ? "Product" : "Service"}
                            </Badge>
                            <p className="font-medium">{itemName}</p>
                          </div>
                          <p className="text-sm text-gray-500">
                            Quantity:{" "}
                            {itemType === "SERVICE"
                              ? "1 (service)"
                              : item.quantity}
                            {itemType === "SERVICE" &&
                              item.service?.duration &&
                              ` • Duration: ${item.service.duration} min`}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <p className="font-medium">
                              {formatPrice(item.unitPrice, workspace?.currency)}{" "}
                              each
                            </p>
                            <p className="text-sm text-gray-500">
                              Total:{" "}
                              {formatPrice(
                                item.totalPrice,
                                workspace?.currency
                              )}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {itemType === "PRODUCT" && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleUpdateItemQuantity(
                                      item.id,
                                      item.quantity - 1
                                    )
                                  }
                                  className="h-6 w-6 p-0 text-gray-600 hover:text-gray-800"
                                  disabled={
                                    item.quantity <= 1 ||
                                    (formData.status !== "PENDING" &&
                                      formData.status !== "PROCESSING")
                                  }
                                >
                                  -
                                </Button>
                                <span className="text-sm w-8 text-center">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleUpdateItemQuantity(
                                      item.id,
                                      item.quantity + 1
                                    )
                                  }
                                  className="h-6 w-6 p-0 text-gray-600 hover:text-gray-800"
                                  disabled={
                                    formData.status !== "PENDING" &&
                                    formData.status !== "PROCESSING"
                                  }
                                >
                                  +
                                </Button>
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(item.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              disabled={
                                formData.status !== "PENDING" &&
                                formData.status !== "PROCESSING"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shipping Address (multiline) */}
          {mode === "edit" && order?.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <strong>Address:</strong>{" "}
                    {order.shippingAddress.street ||
                      order.shippingAddress.address}
                  </div>
                  <div>
                    <strong>City:</strong> {order.shippingAddress.city}
                  </div>
                  <div>
                    <strong>Postal Code:</strong>{" "}
                    {order.shippingAddress.zipCode ||
                      order.shippingAddress.postalCode}
                  </div>
                  <div>
                    <strong>Country:</strong> {order.shippingAddress.country}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invoice Address (remove Phone field) */}
          {mode === "edit" && order?.customer && (
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800">
                  📧 Invoice Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.customer.invoiceAddress ? (
                  <div className="space-y-2">
                    <p>
                      <strong>Name:</strong>{" "}
                      {order.customer.invoiceAddress.firstName || ""}{" "}
                      {order.customer.invoiceAddress.lastName || ""}
                    </p>
                    {order.customer.invoiceAddress.company && (
                      <p>
                        <strong>Company:</strong>{" "}
                        {order.customer.invoiceAddress.company}
                      </p>
                    )}
                    <p>
                      <strong>Address:</strong>{" "}
                      {order.customer.invoiceAddress.address || "N/A"}
                    </p>
                    <p>
                      <strong>City:</strong>{" "}
                      {order.customer.invoiceAddress.city || "N/A"}
                    </p>
                    <p>
                      <strong>Postal Code:</strong>{" "}
                      {order.customer.invoiceAddress.postalCode || "N/A"}
                    </p>
                    <p>
                      <strong>Country:</strong>{" "}
                      {order.customer.invoiceAddress.country || "N/A"}
                    </p>
                    {order.customer.invoiceAddress.vatNumber && (
                      <p>
                        <strong>VAT Number:</strong>{" "}
                        {order.customer.invoiceAddress.vatNumber}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">
                    <p>No invoice address available for this customer.</p>
                    <p className="text-sm">
                      You can add one by editing the customer profile.
                    </p>
                  </div>
                )}
                {/* DEBUG INFO */}
                <div className="mt-4 p-2 bg-yellow-100 text-xs">
                  <p>
                    <strong>🔍 DEBUG:</strong>
                  </p>
                  <p>Customer ID: {order.customer.id}</p>
                  <p>Customer Name: {order.customer.name}</p>
                  <p>
                    Has Invoice Address:{" "}
                    {order.customer.invoiceAddress ? "YES" : "NO"}
                  </p>
                  {order.customer.invoiceAddress && (
                    <p>
                      Invoice Data:{" "}
                      {JSON.stringify(order.customer.invoiceAddress, null, 2)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Additional notes for this order..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading
                ? "Saving..."
                : mode === "create"
                ? "Create Order"
                : "Save Changes"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
