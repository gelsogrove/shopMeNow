import React from "react"

interface Product {
  id: string
  descrizione: string
  qty: number
  prezzo: number
  prezzoScontato?: number
  itemType?: "PRODUCT" | "SERVICE"
}

interface Address {
  name: string
  street: string
  city: string
  postalCode: string
  province?: string
  country?: string
  phone?: string
  company?: string
}

interface Step3ConfirmProps {
  products: Product[]
  shippingAddress: Address
  billingAddress: Address
  sameAsBilling: boolean
  notes: string
  texts: any
  onNotesChange: (value: string) => void
  onNext: () => void
}

/**
 * Step 3: Order Confirmation
 * Summary of order before payment
 */
export const Step3Confirm: React.FC<Step3ConfirmProps> = ({
  products,
  shippingAddress,
  billingAddress,
  sameAsBilling,
  notes,
  texts,
  onNotesChange,
  onNext,
}) => {
  const calculateTotal = () => {
    return products.reduce((sum, product) => {
      const isService = product.itemType === "SERVICE"
      const finalPrice = isService
        ? product.prezzo
        : product.prezzoScontato || product.prezzo
      return sum + finalPrice * product.qty
    }, 0)
  }

  const AddressCard = ({
    title,
    address,
    icon,
  }: {
    title: string
    address: Address
    icon: React.ReactNode
  }) => (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
      </div>
      <div className="space-y-0.5 text-sm text-gray-600">
        <p className="font-medium text-gray-900">{address.name}</p>
        <p>{address.street}</p>
        <p>
          {address.postalCode} {address.city}
          {address.province && ` (${address.province})`}
        </p>
        {address.country && <p>{address.country}</p>}
        {address.phone && <p>{address.phone}</p>}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Order Summary */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          {texts.orderSummary || "Riepilogo Ordine"}
        </h3>

        <div className="space-y-3">
          {products.map((product, index) => {
            const isService = product.itemType === "SERVICE"
            const finalPrice = isService
              ? product.prezzo
              : product.prezzoScontato || product.prezzo
            return (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {product.descrizione}
                  </p>
                  <p className="text-sm text-gray-500">
                    {texts.quantity || "Quantità"}: {product.qty} x €
                    {finalPrice.toFixed(2)}
                  </p>
                </div>
                <p className="font-bold text-gray-900">
                  €{(finalPrice * product.qty).toFixed(2)}
                </p>
              </div>
            )
          })}

          {/* Total */}
          <div className="pt-4 border-t-2 border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-gray-700">
                {texts.total || "Totale"}:
              </span>
              <span className="text-2xl font-bold text-green-600">
                €{calculateTotal().toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Addresses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AddressCard
          title={texts.shippingAddress || "Spedizione"}
          address={shippingAddress}
          icon={
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          }
        />

        {!sameAsBilling && (
          <AddressCard
            title={texts.billingAddress || "Fatturazione"}
            address={billingAddress}
            icon={
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
          />
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {texts.notes || "Note"} ({texts.optional || "opzionale"})
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={4}
          placeholder={
            texts.notesPlaceholder || "Aggiungi note per il tuo ordine..."
          }
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all outline-none resize-none"
        />
      </div>

      {/* Navigation Button */}
      <div>
        <button
          onClick={onNext}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <span>{texts.proceedToPayment || "Procedi al Pagamento"}</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
