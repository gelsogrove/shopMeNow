import { Minus, Package, Plus, ShoppingCart, Trash2, Truck } from "lucide-react"
import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { api } from "@/services/api"
import { tokenApi } from "@/services/tokenApi"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Label } from "../components/ui/label"
import { getProductIcon, getServiceIcon } from "../utils/productIcons"
import { formatPrice } from "@/utils/format"

interface OrderItem {
  itemType: "PRODUCT" | "SERVICE"
  productId?: string
  serviceId?: string
  sku?: string
  serviceCode?: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface OrderSummaryData {
  customerId: string
  items: OrderItem[]
  totalAmount: number
  type: string
  conversationContext: string
}

const OrderSummaryPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orderData, setOrderData] = useState<OrderSummaryData | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [isConfirmed, setIsConfirmed] = useState(false)

  // Load order data from token
  useEffect(() => {
    const loadOrderData = async () => {
      try {
        setLoading(true)

        const response = await tokenApi.get(`/checkout/${token}`)
        const data = response.data
        setOrderData(data)
        setItems(data.items || [])
        setTotalAmount(data.totalAmount || 0)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error loading order"
        )
        toast.error("Error loading order")
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadOrderData()
    }
  }, [token])

  // Update total when items change
  useEffect(() => {
    const newTotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
    setTotalAmount(newTotal)
  }, [items])

  // Update item quantity
  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return

    const updatedItems = [...items]
    updatedItems[index] = {
      ...updatedItems[index],
      quantity: newQuantity,
      totalPrice: updatedItems[index].unitPrice * newQuantity,
    }
    setItems(updatedItems)
  }

  // Remove item
  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index)
    setItems(updatedItems)
    toast.success("Item removed from order")
  }

  // Add product from catalog
  const addProduct = async () => {
    try {
      // Open product catalog modal
      const product = await showProductCatalog()
      if (product) {
        const newItem: OrderItem = {
          itemType: "PRODUCT",
          productId: product.id,
          sku: product.code,
          name: product.name,
          quantity: 1,
          unitPrice: product.price,
          totalPrice: product.price,
        }
        setItems([...items, newItem])
        toast.success(`${product.name} added to order`)
      }
    } catch (err) {
      toast.error("Error adding product")
    }
  }

  // Add service from catalog
  const addService = async () => {
    try {
      // Open service catalog modal
      const service = await showServiceCatalog()
      if (service) {
        const newItem: OrderItem = {
          itemType: "SERVICE",
          serviceId: service.id,
          serviceCode: service.code,
          name: service.name,
          quantity: 1,
          unitPrice: service.price,
          totalPrice: service.price,
        }
        setItems([...items, newItem])
        toast.success(`${service.name} added to order`)
      }
    } catch (err) {
      toast.error("Error adding service")
    }
  }

  // Show product catalog modal
  const showProductCatalog = async (): Promise<any> => {
    // This would open a modal with product catalog
    // For now, return a mock product
    return new Promise((resolve) => {
      // Mock implementation - in real app this would be a modal
      resolve({
        id: "mock-product",
        code: "MOCK001",
        name: "Prodotto di Test",
        price: 10.0,
      })
    })
  }

  // Show service catalog modal
  const showServiceCatalog = async (): Promise<any> => {
    // This would open a modal with service catalog
    // For now, return a mock service
    return new Promise((resolve) => {
      // Mock implementation - in real app this would be a modal
      resolve({
        id: "mock-service",
        code: "SERV001",
        name: "Servizio di Test",
        price: 15.0,
      })
    })
  }

  // Confirm order
  const confirmOrder = async () => {
    try {
      setIsConfirmed(true)

      const response = await api.post("/internal/create-order", {
        workspaceId: orderData?.workspaceId,
        customerId: orderData?.customerId,
        status: "CONFIRMED",
        items: items.map((item) => ({
          itemType: item.itemType.toLowerCase(),
          id: item.itemType === "PRODUCT" ? item.productId : item.serviceId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: "Order confirmed via WhatsApp - OrderSummaryPage",
      })
      const result = response.data
      toast.success("Order confirmed successfully!")

      // Redirect to order confirmation
      navigate(`/orders/${result.orderCode}`)
    } catch (err) {
      setIsConfirmed(false)
      toast.error("Error confirming order")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento ordine...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Errore</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.history.back()}>
              Torna indietro
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              Riepilogo Ordine
            </CardTitle>
            <p className="text-gray-600">
              Verify the selected products and services before confirming the
              order
            </p>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Items */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Products and Services</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addProduct}
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Product
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addService}
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Service
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No products or services selected</p>
                    <p className="text-sm">
                      Add products or services from the catalog
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item, index) => {
                      const icon =
                        item.itemType === "PRODUCT"
                          ? getProductIcon(item.name, "")
                          : getServiceIcon(item.name)

                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{icon}</span>
                              {item.itemType === "PRODUCT" ? (
                                <Package className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Truck className="h-5 w-5 text-green-600" />
                              )}
                              <Badge
                                variant={
                                  item.itemType === "PRODUCT"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {item.itemType === "PRODUCT"
                                  ? "Product"
                                  : "Service"}
                              </Badge>
                            </div>
                            <div>
                              <h4 className="font-medium">{item.name}</h4>
                              <p className="text-sm text-gray-500">
                                Code:{" "}
                                {item.itemType === "PRODUCT"
                                  ? item.sku
                                  : item.serviceCode}
                              </p>
                              <p className="text-sm text-gray-600">
                                {formatPrice(item.unitPrice)} cad.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateQuantity(index, item.quantity - 1)
                                }
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Label className="w-12 text-center">
                                {item.quantity}
                              </Label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateQuantity(index, item.quantity + 1)
                                }
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="text-right">
                              <p className="font-medium">
                                {formatPrice(item.totalPrice)}
                              </p>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total ({items.length} items)</span>
                    <span className="font-bold text-lg">
                      {formatPrice(totalAmount)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      ⏰ Link valid for 1 hour
                    </p>
                    <p className="text-sm text-gray-600">🔐 Secure checkout</p>
                  </div>

                  <Button
                    onClick={confirmOrder}
                    disabled={items.length === 0 || isConfirmed}
                    className="w-full"
                    size="lg"
                  >
                    {isConfirmed ? "Confirming..." : "Confirm Order"}
                  </Button>

                  <p className="text-xs text-gray-500 text-center">
                    Once confirmed, the order cannot be modified
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrderSummaryPage
