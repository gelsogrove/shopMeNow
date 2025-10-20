import type { OrderStatus } from "@/services/ordersApi"

export function getStatusBadgeVariant(
  status: OrderStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PENDING":
      return "outline"
    case "CONFIRMED":
      return "secondary"
    case "PROCESSING":
      return "default"
    case "SHIPPED":
      return "default"
    case "DELIVERED":
      return "default"
    case "CANCELLED":
      return "destructive"
    default:
      return "default"
  }
}

export function getStatusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 border-yellow-300"
    case "CONFIRMED":
      return "bg-blue-100 text-blue-800 border-blue-300"
    case "PROCESSING":
      return "bg-purple-100 text-purple-800 border-purple-300"
    case "SHIPPED":
      return "bg-indigo-100 text-indigo-800 border-indigo-300"
    case "DELIVERED":
      return "bg-green-100 text-green-800 border-green-300"
    case "CANCELLED":
      return "bg-red-100 text-red-800 border-red-300"
    default:
      return "bg-gray-100 text-gray-800 border-gray-300"
  }
}
