
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl"
}

export function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-3",
    xl: "h-12 w-12 border-4"
  }

  return (
    <div
      className={`inline-block animate-spin rounded-full border-t-transparent border-primary ${sizeClasses[size]}`}
      aria-label="Loading"
      role="status"
    />
  )
} 