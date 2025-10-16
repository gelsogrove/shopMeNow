import { IMG_BASE_URL } from "@/config"
import { Package } from "lucide-react"

interface ProductImageProps {
  imageUrl?: string[]
  alt: string
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
  rounded?: boolean
}

const sizeClasses = {
  sm: "w-12 h-12",
  md: "w-24 h-24",
  lg: "w-32 h-32",
  xl: "w-48 h-48",
}

/**
 * Component to display product/service images with placeholder fallback
 * Shows image from imageUrl array or a placeholder icon if no image is available
 */
export function ProductImage({
  imageUrl,
  alt,
  className = "",
  size = "md",
  rounded = true,
}: ProductImageProps) {
  const sizeClass = sizeClasses[size]
  const roundedClass = rounded ? "rounded-md" : ""
  const baseClasses = `${sizeClass} ${roundedClass} object-cover border border-gray-200`

  // Check if image is available
  const hasImage = imageUrl && imageUrl.length > 0 && imageUrl[0]

  if (hasImage) {
    const imageSrc = `${IMG_BASE_URL}${imageUrl[0]}`

    return (
      <img
        src={imageSrc}
        alt={alt}
        className={`${baseClasses} ${className}`}
        onError={(e) => {
          // On image load error, show placeholder
          const target = e.target as HTMLImageElement
          target.style.display = "none"
          const placeholder = target.nextElementSibling as HTMLElement
          if (placeholder) {
            placeholder.style.display = "flex"
          }
        }}
      />
    )
  }

  // Placeholder icon when no image is available
  return (
    <div
      className={`${baseClasses} ${className} flex items-center justify-center bg-gray-100`}
    >
      <Package
        className="text-gray-400"
        size={size === "sm" ? 20 : size === "md" ? 32 : size === "lg" ? 48 : 64}
      />
    </div>
  )
}
