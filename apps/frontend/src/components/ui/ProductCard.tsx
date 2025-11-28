import { Minus, Plus, Trash2 } from "lucide-react"
import React from "react"
import { componentVariants } from "../../styles/theme"
import { ProductImage } from "../shared/ProductImage"

interface ProductCardProps {
  id: string
  name: string
  code?: string
  format?: string
  price: number
  originalPrice?: number
  quantity?: number
  imageUrl?: string[]
  discount?: {
    amount: number
    source?: string
    name?: string
  }
  onQuantityChange?: (id: string, newQuantity: number) => void
  onRemove?: (id: string) => void
  showQuantityControls?: boolean
  className?: string
  isLoading?: boolean
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  code,
  format,
  price,
  originalPrice,
  quantity = 1,
  imageUrl,
  discount,
  onQuantityChange,
  onRemove,
  showQuantityControls = false,
  className = "",
  isLoading = false,
}) => {
  const hasDiscount = originalPrice && originalPrice > price

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount)
  }

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1) return
    if (onQuantityChange) {
      onQuantityChange(id, newQuantity)
    }
  }

  return (
    <div
      className={`${componentVariants.productCard.mobile} ${className} ${
        isLoading ? "opacity-50" : ""
      }`}
    >
      {/* Product Header with Image */}
      <div className="flex justify-between items-start gap-3">
        {/* Product Image */}
        <ProductImage
          imageUrl={imageUrl}
          alt={name}
          size="md"
          className="flex-shrink-0"
        />

        <div className="flex-1 min-w-0 pr-3">
          <h3 className="font-medium text-neutral-900 text-sm leading-tight line-clamp-2">
            {name}
          </h3>
          {code && <p className="text-xs text-neutral-500 mt-1">Cod. {code}</p>}
          {format && (
            <p className="text-xs text-neutral-600 mt-1 font-medium">
              {format}
            </p>
          )}
        </div>

        {/* Remove Button */}
        {onRemove && (
          <button
            onClick={() => onRemove(id)}
            className="p-2 -mt-1 -mr-1 text-neutral-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
            aria-label="Rimuovi prodotto"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Price Section */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-neutral-900">
              {formatPrice(price)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-neutral-500 line-through">
                {formatPrice(originalPrice!)}
              </span>
            )}
          </div>

          {/* Discount Info */}
          {discount && discount.amount > 0 && (
            <div className="flex items-center mt-1">
              <span className="text-xs text-success-600 bg-success-50 px-2 py-1 rounded-full">
                -{discount.amount}% {discount.name && `(${discount.name})`}
              </span>
            </div>
          )}
        </div>

        {/* Quantity Controls */}
        {showQuantityControls && (
          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1 || isLoading}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              aria-label="Diminuisci quantità"
            >
              <Minus className="h-4 w-4" />
            </button>

            <span className="text-lg font-semibold text-neutral-900 min-w-[2rem] text-center">
              {quantity}
            </span>

            <button
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={isLoading}
              className="w-8 h-8 rounded-full bg-primary-100 hover:bg-primary-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors text-primary-600"
              aria-label="Aumenta quantità"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Total Price for multiple quantities */}
      {showQuantityControls && quantity > 1 && (
        <div className="pt-2 border-t border-neutral-100">
          <div className="flex justify-between items-center">
            <span className="text-sm text-neutral-600">
              Totale ({quantity} pz)
            </span>
            <span className="text-lg font-bold text-primary-600">
              {formatPrice(price * quantity)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
