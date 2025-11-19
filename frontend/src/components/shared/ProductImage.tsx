import { IMG_BASE_URL } from "@/config"
import { Package } from "lucide-react"
import { useState } from "react"

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
  const [imageError, setImageError] = useState(false)
  
  const roundedClass = rounded ? "rounded-md" : ""
  
  // Check if image is available
  const hasImage = imageUrl && imageUrl.length > 0 && imageUrl[0]

  // If no image or image failed to load, show placeholder
  if (!hasImage || imageError) {
    const sizeClass = sizeClasses[size]
    return (
      <div
        className={`${sizeClass} ${roundedClass} ${className} flex items-center justify-center bg-gray-100 border border-gray-200`}
      >
        <Package
          className="text-gray-400"
          size={size === "sm" ? 20 : size === "md" ? 32 : size === "lg" ? 48 : 64}
        />
      </div>
    )
  }

  const imageSrc = `${IMG_BASE_URL}${imageUrl[0]}`

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={`${roundedClass} object-cover border border-gray-200 ${className}`}
      onError={() => setImageError(true)}
    />
  )
}
