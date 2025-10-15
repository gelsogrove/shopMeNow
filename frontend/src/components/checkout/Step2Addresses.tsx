import React from "react"

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

interface Step2AddressesProps {
  shippingAddress: Address
  billingAddress: Address
  sameAsBilling: boolean
  texts: any
  onShippingChange: (field: keyof Address, value: string) => void
  onBillingChange: (field: keyof Address, value: string) => void
  onSameAsBillingChange: (value: boolean) => void
  onNext: () => void
}

/**
 * Step 2: Shipping & Billing Addresses
 * Clean form design with proper validation
 * Navigate back via clickable progress steps
 */
export const Step2Addresses: React.FC<Step2AddressesProps> = ({
  shippingAddress,
  billingAddress,
  sameAsBilling,
  texts,
  onShippingChange,
  onBillingChange,
  onSameAsBillingChange,
  onNext,
}) => {
  const InputField = ({
    label,
    value,
    onChange,
    placeholder,
    required = false,
  }: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    required?: boolean
  }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
      />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Shipping Address */}
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
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          {texts.shippingAddress || "Indirizzo di Spedizione"}
        </h3>

        <div className="space-y-4">
          <InputField
            label={texts.street || "Via"}
            value={shippingAddress.street}
            onChange={(value) => onShippingChange("street", value)}
            placeholder="Via Roma 123"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label={texts.city || "Città"}
              value={shippingAddress.city}
              onChange={(value) => onShippingChange("city", value)}
              placeholder="Milano"
              required
            />

            <InputField
              label={texts.postalCode || "CAP"}
              value={shippingAddress.postalCode}
              onChange={(value) => onShippingChange("postalCode", value)}
              placeholder="20100"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label={texts.province || "Provincia"}
              value={shippingAddress.province || ""}
              onChange={(value) => onShippingChange("province", value)}
              placeholder="MI"
            />

            <InputField
              label={texts.country || "Paese"}
              value={shippingAddress.country || ""}
              onChange={(value) => onShippingChange("country", value)}
              placeholder="Italia"
              required
            />
          </div>
        </div>
      </div>

      {/* Same as Billing Checkbox */}
      <div className="flex items-center gap-3 px-1">
        <input
          type="checkbox"
          id="sameAsBilling"
          checked={sameAsBilling}
          onChange={(e) => onSameAsBillingChange(e.target.checked)}
          className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
        />
        <label
          htmlFor="sameAsBilling"
          className="text-sm text-gray-700 font-medium cursor-pointer"
        >
          {texts.sameAsBilling || "Usa lo stesso indirizzo per la fatturazione"}
        </label>
      </div>

      {/* Billing Address (conditional) */}
      {!sameAsBilling && (
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
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
            {texts.billingAddress || "Indirizzo di Fatturazione"}
          </h3>

          <div className="space-y-4">
            <InputField
              label={texts.street || "Via"}
              value={billingAddress.street}
              onChange={(value) => onBillingChange("street", value)}
              placeholder="Via Roma 123"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label={texts.city || "Città"}
                value={billingAddress.city}
                onChange={(value) => onBillingChange("city", value)}
                placeholder="Milano"
                required
              />

              <InputField
                label={texts.postalCode || "CAP"}
                value={billingAddress.postalCode}
                onChange={(value) => onBillingChange("postalCode", value)}
                placeholder="20100"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label={texts.province || "Provincia"}
                value={billingAddress.province || ""}
                onChange={(value) => onBillingChange("province", value)}
                placeholder="MI"
              />

              <InputField
                label={texts.country || "Paese"}
                value={billingAddress.country || ""}
                onChange={(value) => onBillingChange("country", value)}
                placeholder="Italia"
                required
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation Button */}
      <div>
        <button
          onClick={onNext}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <span>{texts.continue || "Continua"}</span>
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
