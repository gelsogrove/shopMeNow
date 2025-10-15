import React from "react"

// 🖼️ Helper to get full image URL
const getImageUrl = (imageUrl: string | string[] | undefined): string | null => {
  if (!imageUrl) return null
  const url = Array.isArray(imageUrl) ? imageUrl[0] : imageUrl
  if (!url) return null
  // If URL already starts with http, return as-is
  if (url.startsWith('http')) return url
  // Otherwise, prepend backend URL
  return `http://localhost:3001${url}`
}

interface Product {
  id: string
  productId?: string
  serviceId?: string
  itemType?: "PRODUCT" | "SERVICE"
  codice: string
  descrizione: string
  formato?: string
  qty: number
  quantita?: number
  prezzo: number
  prezzoOriginale?: number
  prezzoScontato?: number
  scontoApplicato?: number
  imageUrl?: string[]
}

interface ProductCardProps {
  product: Product
  index: number
  onQuantityChange: (index: number, newQty: number) => void
  onDelete: (
    index: number,
    name: string,
    type: "PRODUCT" | "SERVICE",
    id: string
  ) => void
  texts: any
}

/**
 * Professional Product Card - Mobile-First Design
 * Clean, minimal, Apple/Stripe inspired
 */
export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  index,
  onQuantityChange,
  onDelete,
  texts,
}) => {
  const isService = product.itemType === "SERVICE"
  const finalPrice = isService
    ? product.prezzo
    : product.prezzoScontato || product.prezzo
  const totalPrice = finalPrice * (product.qty || product.quantita || 1)
  const hasDiscount =
    !isService && product.scontoApplicato && product.scontoApplicato > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="p-4">
        {/* Top Section: Image + Info + Delete */}
        <div className="flex gap-3 mb-3">
          {/* Product Image */}
          <div className="w-20 h-20 flex-shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden border border-gray-100 relative">
            {getImageUrl(product.imageUrl) ? (
              <img
                src={getImageUrl(product.imageUrl)!}
                alt={product.descrizione}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  className="w-9 h-9 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4-8-4m16 0v10l-8 4-8-4V7"
                  />
                </svg>
              </div>
            )}
            
            {/* Discount Badge - Overlay on Image */}
            {hasDiscount && (
              <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded shadow-sm">
                -{product.scontoApplicato}%
              </span>
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base leading-tight mb-1.5 line-clamp-2">
              {product.descrizione}
            </h3>

            {/* Meta Info */}
            <div className="space-y-0.5 mb-2">
              {product.codice !== "N/A" && (
                <p className="text-xs font-mono text-gray-500">
                  {product.codice}
                </p>
              )}
              {product.formato && !isService && (
                <p className="text-xs text-gray-600">{product.formato}</p>
              )}
            </div>
          </div>

          {/* Delete Button */}
          <button
            onClick={() =>
              onDelete(
                index,
                product.descrizione,
                isService ? "SERVICE" : "PRODUCT",
                isService ? product.serviceId! : product.productId!
              )
            }
            className="text-gray-300 hover:text-red-500 transition-colors h-fit"
            aria-label="Rimuovi"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 mb-3" />

        {/* Bottom Section: Quantity + Price */}
        <div className="flex items-center justify-between">
          {/* Quantity Controls - iOS Style */}
          {!isService ? (
            <div className="flex items-center bg-gray-50 rounded-lg p-0.5">
              <button
                onClick={() => onQuantityChange(index, product.qty - 1)}
                disabled={product.qty <= 1}
                className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-white active:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                aria-label="Diminuisci quantità"
              >
                <svg
                  className="w-4 h-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M20 12H4"
                  />
                </svg>
              </button>
              <span className="w-11 text-center text-base font-semibold text-gray-900">
                {product.qty}
              </span>
              <button
                onClick={() => onQuantityChange(index, product.qty + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-white active:bg-gray-100 transition-all"
                aria-label="Aumenta quantità"
              >
                <svg
                  className="w-4 h-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              {texts.quantity || "Quantità"}: 1
            </div>
          )}

          {/* Price Display */}
          <div className="text-right">
            {hasDiscount ? (
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-400 line-through">
                  €{(product.prezzoOriginale! * product.qty).toFixed(2)}
                </span>
                <span className="text-xl font-bold text-green-600">
                  €{totalPrice.toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="text-xl font-bold text-gray-900">
                €{totalPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
