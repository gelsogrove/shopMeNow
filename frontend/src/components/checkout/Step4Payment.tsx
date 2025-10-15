import React, { useState } from "react"

interface Step4PaymentProps {
  total: number
  texts: any
  onConfirm: () => void
  loading?: boolean
}

/**
 * Step 4: Payment (Stripe-style Mock)
 * Professional payment interface with card details
 */
export const Step4Payment: React.FC<Step4PaymentProps> = ({
  total,
  texts,
  onConfirm,
  loading = false,
}) => {
  const [cardNumber, setCardNumber] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvc, setCvc] = useState("")
  const [cardholderName, setCardholderName] = useState("")

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    const formatted = numbers.match(/.{1,4}/g)?.join(" ") || numbers
    return formatted.substring(0, 19) // Max 16 digits + 3 spaces
  }

  // Format expiry MM/YY
  const formatExpiry = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length >= 2) {
      return numbers.substring(0, 2) + "/" + numbers.substring(2, 4)
    }
    return numbers
  }

  const handleCardNumberChange = (value: string) => {
    setCardNumber(formatCardNumber(value))
  }

  const handleExpiryChange = (value: string) => {
    setExpiry(formatExpiry(value))
  }

  const handleCvcChange = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    setCvc(numbers.substring(0, 3))
  }

  // Detect card type
  const getCardBrand = () => {
    const number = cardNumber.replace(/\s/g, "")
    if (number.startsWith("4")) return "visa"
    if (number.startsWith("5")) return "mastercard"
    if (number.startsWith("3")) return "amex"
    return null
  }

  const cardBrand = getCardBrand()

  return (
    <div className="space-y-6">
      {/* Payment Card - Stripe Style */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 rounded-2xl shadow-2xl p-6 sm:p-8 text-white">
        {/* Card Chip */}
        <div className="flex items-start justify-between mb-8">
          <div className="w-12 h-10 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-md shadow-md" />
          <div className="text-right">
            {cardBrand === "visa" && (
              <div className="text-2xl font-bold">VISA</div>
            )}
            {cardBrand === "mastercard" && (
              <div className="flex gap-1">
                <div className="w-8 h-8 rounded-full bg-red-500 opacity-80" />
                <div className="w-8 h-8 rounded-full bg-yellow-500 opacity-80 -ml-4" />
              </div>
            )}
            {cardBrand === "amex" && (
              <div className="text-xl font-bold">AMEX</div>
            )}
          </div>
        </div>

        {/* Card Number Display */}
        <div className="mb-6">
          <p className="text-sm opacity-70 mb-2">Card Number</p>
          <p className="text-2xl font-mono tracking-wider">
            {cardNumber || "•••• •••• •••• ••••"}
          </p>
        </div>

        {/* Cardholder & Expiry */}
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs opacity-70 mb-1">Cardholder</p>
            <p className="font-semibold uppercase">
              {cardholderName || "FULL NAME"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-70 mb-1">Expires</p>
            <p className="font-mono font-semibold">{expiry || "MM/YY"}</p>
          </div>
        </div>
      </div>

      {/* Payment Form */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
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
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            {texts.paymentDetails || "Dettagli Pagamento"}
          </h3>
          <div className="flex gap-2">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/0/04/Visa.svg"
              alt="Visa"
              className="h-5"
            />
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg"
              alt="Mastercard"
              className="h-5"
            />
          </div>
        </div>

        <div className="space-y-4">
          {/* Card Number */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {texts.cardNumber || "Numero Carta"}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => handleCardNumberChange(e.target.value)}
                placeholder="1234 5678 9012 3456"
                className="w-full px-4 py-3 pl-12 rounded-lg border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all outline-none font-mono"
              />
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
          </div>

          {/* Cardholder Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {texts.cardholderName || "Nome Titolare"}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
              placeholder="MARIO ROSSI"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all outline-none uppercase"
            />
          </div>

          {/* Expiry & CVC */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {texts.expiry || "Scadenza"}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => handleExpiryChange(e.target.value)}
                placeholder="MM/YY"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none font-mono text-center"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                CVC
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={cvc}
                  onChange={(e) => handleCvcChange(e.target.value)}
                  placeholder="123"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none font-mono text-center"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 group">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                    Codice di 3 cifre sul retro della carta
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-green-50 p-3 rounded-lg">
            <svg
              className="w-5 h-5 text-green-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>
              {texts.securePayment || "Pagamento sicuro crittografato SSL"}
            </span>
          </div>
        </div>
      </div>

      {/* Total Summary */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg opacity-90">
            {texts.totalToPay || "Totale da Pagare"}
          </span>
          <span className="text-3xl font-bold">€{total.toFixed(2)}</span>
        </div>
        <p className="text-sm opacity-70">
          {texts.includesVAT || "IVA inclusa"}
        </p>
      </div>

      {/* Navigation Button */}
      <div>
        <button
          onClick={onConfirm}
          disabled={
            loading ||
            !cardNumber ||
            !cardholderName ||
            !expiry ||
            !cvc ||
            cardNumber.replace(/\s/g, "").length < 15
          }
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>{texts.processing || "Elaborazione..."}</span>
            </>
          ) : (
            <>
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-lg">
                {texts.confirmPayment || "Conferma Pagamento"}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-gray-500">
        {texts.paymentDisclaimer ||
          "Cliccando su 'Conferma Pagamento' accetti i nostri Termini e Condizioni"}
      </p>
    </div>
  )
}
