import { cn } from "@/lib/utils"
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react"

type StatusType =
  | "active"
  | "inactive"
  | "pending"
  | "processing"
  | "completed"
  | "cancelled"
  | "paid"
  | "failed"
  | "expired"

interface StatusBadgeProps {
  status: StatusType
  className?: string
  children?: React.ReactNode
}

export function StatusBadge({ status, className, children }: StatusBadgeProps) {
  const getStatusStyles = (status: StatusType) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-background text-foreground border-input"
      case "completed":
      case "paid":
        return "bg-green-50 text-green-700 border-green-200"
      case "pending":
      case "processing":
        return "bg-yellow-50 text-yellow-700 border-yellow-200"
      case "cancelled":
      case "failed":
      case "expired":
        return "bg-red-50 text-red-700 border-red-200"
      default:
        return "bg-gray-100 text-gray-600 border-gray-200"
    }
  }

  const getStatusIcon = (status: StatusType) => {
    switch (status) {
      case "active":
      case "completed":
      case "paid":
        return (
          <CheckCircle2 className="h-5 w-5 text-green-500" strokeWidth={2.5} />
        )
      case "pending":
      case "processing":
        return <Clock className="h-5 w-5 text-yellow-500" strokeWidth={2.5} />
      case "cancelled":
      case "failed":
      case "expired":
        return (
          <AlertCircle className="h-5 w-5 text-red-500" strokeWidth={2.5} />
        )
      default:
        return <XCircle className="h-5 w-5 text-gray-400" strokeWidth={2} />
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-6 py-2 text-base font-medium uppercase",
        getStatusStyles(status),
        className
      )}
    >
      {getStatusIcon(status)}
      {children || status}
    </span>
  )
}
