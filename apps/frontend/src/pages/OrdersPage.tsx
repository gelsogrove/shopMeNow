import { PageLayout } from "@/components/layout/PageLayout"
import { CartItemEditSheet } from "@/components/orders/CartItemEditSheet"
import { CreditNoteDialog } from "@/components/orders/CreditNoteDialog"
import { OrderCrudSheet } from "@/components/orders/OrderCrudSheet"
import {
  getStatusBadgeClass,
  getStatusBadgeVariant,
} from "@/components/orders/orderUtils"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { CrudPageContent } from "@/components/shared/CrudPageContent"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { clientsApi } from "@/services/clientsApi"
import { ordersApi, type Order, type OrderStatus } from "@/services/ordersApi"
import { commonStyles } from "@/styles/common"
import { formatPrice } from "@/utils/format"
import { Pencil, Receipt, ShoppingCart, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "../lib/toast"

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

// Customer interface is imported from ordersApi.ts

// Main Orders Page Component
export default function OrdersPage() {
  const { workspace } = useWorkspace()
  const location = useLocation()
  // Leggi il parametro search dalla query string
  const initialSearch = (() => {
    const params = new URLSearchParams(location.search)
    return params.get("search") || ""
  })()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all")
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("last_year") // Default: show orders from last year
  // Initialize date filters with last year
  const [dateFromFilter, setDateFromFilter] = useState<Date | undefined>(
    () => {
      const today = new Date()
      return new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
    }
  )
  const [dateToFilter, setDateToFilter] = useState<Date | undefined>(() => new Date())
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isCartEditOpen, setIsCartEditOpen] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isCreditNoteOpen, setIsCreditNoteOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const navigate = useNavigate()

  // Load orders
  useEffect(() => {
    const loadData = async () => {
      if (!workspace?.id) return

      try {
        setIsLoading(true)

        // Fetch orders and customers in parallel
        const [ordersResponse, customersResponse] = await Promise.all([
          ordersApi.getAllForWorkspace(workspace.id),
          clientsApi.getAllForWorkspace(workspace.id),
        ])

        logger.info("🔍 DEBUG - Raw responses:")
        logger.info("Orders response:", ordersResponse)
        logger.info("Customers response:", customersResponse)

        // Create a map of customers for quick lookup
        const customersMap = new Map()
        if (Array.isArray(customersResponse)) {
          customersResponse.forEach((customer) => {
            customersMap.set(customer.id, customer)
          })
        } else if (customersResponse && (customersResponse as any)?.clients) {
          ;(customersResponse as any).clients.forEach((customer) => {
            customersMap.set(customer.id, customer)
          })
        }

        logger.info("🔍 DEBUG - Customers map:", customersMap)

        // Enrich orders with customer data
        const enrichedOrders = (ordersResponse.orders || []).map((order) => {
          const customerFromMap = customersMap.get(order.customerId)
          const finalCustomer = customerFromMap || order.customer || null

          logger.info(`🔍 DEBUG - Order ${order.orderCode}:`)
          logger.info("  - customerId:", order.customerId)
          logger.info("  - customerFromMap:", customerFromMap)
          logger.info("  - order.customer:", order.customer)
          logger.info("  - finalCustomer:", finalCustomer)

          return {
            ...order,
            customer: finalCustomer,
          }
        })

        logger.info("🔍 DEBUG - Final enriched orders:", enrichedOrders)

        // Sort orders by date descending (newest first)
        const sortedOrders = enrichedOrders.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

        setOrders(sortedOrders)
      } catch (error) {
        logger.error("Error loading data:", error)
        toast.error("Failed to load data")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [workspace?.id])

  // Event handlers
  const handleAdd = () => {
    setSelectedOrder(null) // Clear selected order for create mode
    setIsAddOpen(true)
  }

  const handleEdit = (order: Order) => {
    setSelectedOrder(order)
    setIsEditOpen(true)
  }

  const handleCartEdit = (order: Order) => {
    setSelectedOrder(order)
    setIsCartEditOpen(true)
  }

  const handleDelete = (order: Order) => {
    setSelectedOrder(order)
    setShowDeleteDialog(true)
  }

  const handleCreditNote = (order: Order) => {
    setSelectedOrder(order)
    setIsCreditNoteOpen(true)
  }

  const handleCustomerEdit = (customer: any) => {
    // Open customer edit popup - this should integrate with existing customer edit functionality
    // For now, we'll show a placeholder
    toast.info(`Edit customer: ${customer.name} (Feature coming soon)`)
  }

  const handleCustomerNavigation = (customer: any) => {
    if (!customer?.id) {
      toast.error("Customer information not available")
      return
    }
    navigate(`/clients?edit=${customer.id}`)
    toast.info(`Opening customer edit form: ${customer.name}`)
  }

  const handleDownloadInvoice = async (order: Order) => {
    try {
      const response = await fetch(`/api/orders/${order.orderCode}/invoice`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${storage.getToken()}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to download invoice")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `invoice-${order.orderCode}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Invoice downloaded successfully")
    } catch (error) {
      logger.error("Error downloading invoice:", error)
      toast.error("Failed to download invoice")
    }
  }

  const handleDownloadDdt = async (order: Order) => {
    try {
      const response = await fetch(`/api/orders/${order.orderCode}/ddt`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${storage.getToken()}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to download delivery note")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `delivery-note-${order.orderCode}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Delivery note downloaded successfully")
    } catch (error) {
      logger.error("Error downloading delivery note:", error)
      toast.error("Failed to download delivery note")
    }
  }

  const handleDateRangeChange = (range: string) => {
    setDateRangeFilter(range)

    const today = new Date()
    let from: Date | undefined = undefined
    let to: Date | undefined = undefined

    switch (range) {
      case "last_week":
        from = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - 7
        )
        to = today
        break
      case "last_month":
        from = new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          today.getDate()
        )
        to = today
        break
      case "last_3_months":
        from = new Date(
          today.getFullYear(),
          today.getMonth() - 3,
          today.getDate()
        )
        to = today
        break
      case "last_6_months":
        from = new Date(
          today.getFullYear(),
          today.getMonth() - 6,
          today.getDate()
        )
        to = today
        break
      case "last_year":
        from = new Date(
          today.getFullYear() - 1,
          today.getMonth(),
          today.getDate()
        )
        to = today
        break
      default: // 'all'
        from = undefined
        to = undefined
    }

    setDateFromFilter(from)
    setDateToFilter(to)
  }

  // Define columns for the table
  const columns = [
    {
      header: "Num.",
      accessorKey: "orderCode" as keyof Order,
      size: 180,
      cell: ({ row }: { row: { original: Order } }) => (
        <span className="font-mono font-medium">{row.original.orderCode}</span>
      ),
    },
    {
      header: "Customer",
      accessorKey: "customer",
      size: 300,
      cell: ({ row }: { row: { original: Order } }) => {
        const customerName = row.original.customer?.name || "Unknown Customer"
        const companyName = row.original.customer?.company || ""
        const displayText = companyName
          ? `${customerName} (${companyName})`
          : customerName

        return (
          <span
            className="font-medium cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => handleCustomerNavigation(row.original.customer)}
            title="Click to view customer details"
          >
            {displayText}
          </span>
        )
      },
    },
    {
      header: "Status",
      accessorKey: "status" as keyof Order,
      size: 120,
      cell: ({ row }: { row: { original: Order } }) => (
        <Badge
          variant={getStatusBadgeVariant(row.original.status)}
          className={getStatusBadgeClass(row.original.status)}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      header: "Total",
      accessorKey: "totalAmount" as keyof Order,
      size: 120,
      cell: ({ row }: { row: { original: Order } }) => (
        <span className="font-medium">
          {formatPrice(row.original.totalAmount, workspace?.currency)}
        </span>
      ),
    },
    {
      header: "Date",
      accessorKey: "createdAt" as keyof Order,
      size: 160,
      cell: ({ row }: { row: { original: Order } }) => {
        const date = new Date(row.original.createdAt)
        return (
          <span>
            {date.toLocaleDateString()}{" "}
            {date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )
      },
    },
  ]

  // Simple and effective filtering logic
  const filteredOrders = orders
    .filter((order) => {
      // 1. Search filter - search in customer name, order code, and company
      if (searchTerm.trim()) {
        const searchValue = searchTerm.toLowerCase().trim()

        // Search in customer name (most important)
        const customerName = order.customer?.name?.toLowerCase() || ""
        if (customerName.includes(searchValue)) {
          return true
        }

        // Search in order code
        const orderCode = order.orderCode?.toLowerCase() || ""
        if (orderCode.includes(searchValue)) {
          return true
        }

        // Search in company name
        const companyName = order.customer?.company?.toLowerCase() || ""
        if (companyName.includes(searchValue)) {
          return true
        }

        // Search in status
        const status = order.status?.toLowerCase() || ""
        if (status.includes(searchValue)) {
          return true
        }

        // If not found in any searchable field, exclude this order
        return false
      }

      return true // No search term, include all orders for other filters
    })
    .filter((order) => {
      // 2. Status filter
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false
      }

      // 3. Date range filter
      if (dateFromFilter || dateToFilter) {
        const orderDate = new Date(order.createdAt)

        if (dateFromFilter) {
          const fromDate = new Date(dateFromFilter)
          fromDate.setHours(0, 0, 0, 0)
          if (orderDate < fromDate) {
            return false
          }
        }

        if (dateToFilter) {
          const toDate = new Date(dateToFilter)
          toDate.setHours(23, 59, 59, 999)
          if (orderDate > toDate) {
            return false
          }
        }
      }

      return true
    })

  // Always sort filteredOrders by date descending
  const sortedOrders = [...filteredOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Debug final results
  logger.info("🔍 FINAL DEBUG:")
  logger.info("- searchTerm:", searchTerm)
  logger.info("- orders.length:", orders.length)
  logger.info("- filteredOrders.length:", filteredOrders.length)
  logger.info("- sortedOrders.length:", sortedOrders.length)
  logger.info("- sortedOrders:", sortedOrders)

  const handleDeleteConfirm = async () => {
    if (!selectedOrder || !workspace?.id) return

    logger.info(`[DELETE ORDER] Attempting to delete order:`, {
      orderId: selectedOrder.id,
      orderCode: selectedOrder.orderCode,
      workspaceId: workspace.id,
    })

    try {
      await ordersApi.delete(selectedOrder.id, workspace.id)
      setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id))
      setShowDeleteDialog(false)
      setSelectedOrder(null)
      toast.success("Order deleted successfully")
    } catch (error) {
      logger.error("Error deleting order:", error)
      toast.error(
        "Failed to delete order. " + (error as any)?.response?.data?.message ||
          "Please try again."
      )
    }
  }

  const handleOrderSave = async (savedOrder: Order) => {
    // Update local state immediately for instant feedback
    setOrders((prev) => {
      const index = prev.findIndex((o) => o.id === savedOrder.id)
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = savedOrder
        return updated.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      } else {
        const newOrders = [savedOrder, ...prev]
        return newOrders.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      }
    })

    // Show success message based on whether it's create or edit
    const isNewOrder = !orders.find((o) => o.id === savedOrder.id)
    toast.success(
      isNewOrder ? "Order created successfully" : "Order updated successfully"
    )

    // Close the sheets
    setIsEditOpen(false)
    setIsCartEditOpen(false)
    setIsAddOpen(false)
    setSelectedOrder(null)

    // Verify with server in background
    if (workspace?.id) {
      try {
        const response = await ordersApi.getAllForWorkspace(workspace.id, {})
        setOrders(response.orders)
      } catch (error) {
        logger.error("Background sync failed:", error)
      }
    }
  }

  // Custom actions for orders - Edit, Credit Note, and Delete
  const renderOrderActions = (order: Order) => (
    <div className="flex gap-1 justify-end">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleCartEdit(order)}
        title="Edit Order Items"
        className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-700"
      >
        <Pencil
          className={`${commonStyles.actionIcon} ${commonStyles.primary}`}
        />
      </Button>
      {(order.status === "DELIVERED" || order.status === "CONFIRMED") && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleCreditNote(order)}
          title="Emetti Nota di Credito"
          className="h-8 w-8 p-0 hover:bg-orange-50 hover:text-orange-700"
        >
          <Receipt className={`${commonStyles.actionIcon} text-orange-500`} />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleDelete(order)}
        title="Delete Order"
        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className={`${commonStyles.actionIcon} text-red-500`} />
      </Button>
    </div>
  )

  return (
    <PageLayout>
      <CrudPageContent
        title="Orders"
        titleIcon={<ShoppingCart className={commonStyles.headerIcon} />}
        searchValue={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search orders..."
        onAdd={handleAdd}
        addButtonText="Add"
        data={sortedOrders}
        columns={columns}
        isLoading={isLoading}
        renderActions={renderOrderActions}
        extraButtons={
          <div className="flex justify-end gap-3">
            <Select
              value={statusFilter}
              onValueChange={(value: OrderStatus | "all") =>
                setStatusFilter(value)
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="SHIPPED">Shipped</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>

                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={dateRangeFilter}
              onValueChange={handleDateRangeChange}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">-</SelectItem>
                <SelectItem value="last_week">Last week</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="last_3_months">Last 3 months</SelectItem>
                <SelectItem value="last_6_months">Last 6 months</SelectItem>
                <SelectItem value="last_year">Last year</SelectItem>
              </SelectContent>
            </Select>
            {/* Removed page size dropdown */}
          </div>
        }
      />

      {/* Order Add Sheet */}
      <OrderCrudSheet
        order={null}
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSave={handleOrderSave}
        mode="create"
      />

      {/* Order Edit Sheet */}
      <OrderCrudSheet
        order={selectedOrder}
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleOrderSave}
        mode="edit"
      />
      {/* Cart Edit Sheet */}
      <CartItemEditSheet
        order={selectedOrder}
        open={isCartEditOpen}
        onClose={() => setIsCartEditOpen(false)}
        onSave={handleOrderSave}
      />

      {/* Credit Note Dialog */}
      <CreditNoteDialog
        order={selectedOrder}
        open={isCreditNoteOpen}
        onOpenChange={setIsCreditNoteOpen}
        onSuccess={() => {
          // Optionally refresh orders or update local state
          setIsCreditNoteOpen(false)
          setSelectedOrder(null)
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteConfirm}
        title="Delete Order"
        description={`Are you sure you want to delete order ${selectedOrder?.orderCode}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
      />
    </PageLayout>
  )
}
