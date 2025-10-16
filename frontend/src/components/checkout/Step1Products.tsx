import React from "react"
import { ProductCard } from "./ProductCard"

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

interface Step1ProductsProps {
  products: Product[]
  texts: any
  onQuantityChange: (index: number, newQty: number) => void
  onDeleteProduct: (
    index: number,
    name: string,
    type: "PRODUCT" | "SERVICE",
    id: string
  ) => void
  onAddProducts: () => void
  onAddServices: () => void
  onNext: () => void
}

/**
 * Step 1: Products & Services Selection
 * REDESIGNED - Mobile-first, dimensioni normali, bottoni sulla stessa riga
 */
export const Step1Products: React.FC<Step1ProductsProps> = ({
  products,
  texts,
  onQuantityChange,
  onDeleteProduct,
  onAddProducts,
  onAddServices,
  onNext,
}) => {
  const calculateTotal = () => {
    return products.reduce((sum, product) => {
      const isService = product.itemType === "SERVICE"
      const finalPrice = isService
        ? product.prezzo
        : product.prezzoScontato || product.prezzo
      return sum + finalPrice * (product.qty || product.quantita || 1)
    }, 0)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header with Action Buttons */}
      <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-100">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onAddProducts}
            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-2 px-3 rounded-lg transition-all flex items-center gap-1.5 text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>{texts.addProducts || "Prodotti"}</span>
          </button>

          <button
            onClick={onAddServices}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2 px-3 rounded-lg transition-all flex items-center gap-1.5 text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>{texts.addServices || "Servizi"}</span>
          </button>
        </div>
      </div>

      {/* Products List */}
      <div className="p-3 sm:p-4 lg:p-6">
        {products.length === 0 ? (
          <div className="text-center py-6 lg:py-12">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <p className="text-gray-500 text-base mb-1">
              {texts.emptyCart || "Nessun prodotto nel carrello"}
            </p>
            <p className="text-gray-400 text-sm">
              {texts.addProductsToStart ||
                "Aggiungi prodotti o servizi per iniziare"}
            </p>
          </div>
        ) : (
          <div className="space-y-3 lg:space-y-0">
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                onQuantityChange={onQuantityChange}
                onDelete={onDeleteProduct}
                texts={texts}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with Total and Next Button - HIDDEN on desktop (sidebar shows it) */}
      {products.length > 0 && (
        <div className="p-3 sm:p-4 lg:p-6 border-t border-gray-100 bg-gray-50 lg:hidden">
          {/* Total */}
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <span className="text-base sm:text-lg lg:text-xl font-semibold text-gray-700">
              {texts.total || "Totale"}:
            </span>
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              €{calculateTotal().toFixed(2)}
            </span>
          </div>

          {/* Next Button - DIMENSIONI NORMALI */}
          <button
            onClick={onNext}
            className="w-full lg:w-auto lg:px-8 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-2.5 px-4 sm:py-3 lg:py-4 rounded-lg transition-all flex items-center justify-center gap-2 text-base lg:text-lg"
          >
            <span>{texts.continue || "Continua"}</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
