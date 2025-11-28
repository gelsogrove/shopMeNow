import React from "react"

/**
 * Simplified Billing Display Component
 * Shows billing information in a single line format: €X.XX + €0.15 = €Y.YY
 */

interface BillingData {
  currentTotal: number
  messageCharge: number
  humanSupportCharge: number
  newTotal: number
}

interface SimpleBillingDisplayProps {
  billing?: BillingData
  fallbackTotal?: number
}

export const SimpleBillingDisplay: React.FC<SimpleBillingDisplayProps> = ({
  billing,
  fallbackTotal = 0,
}) => {
  if (billing) {
    const charge = billing.messageCharge + billing.humanSupportCharge
    return (
      <div className="bg-blue-50 border border-blue-200 rounded p-2">
        <div className="text-xs text-blue-700 text-center font-mono font-semibold">
          💰 €{billing.currentTotal.toFixed(2)} + €{charge.toFixed(2)} = €
          {billing.newTotal.toFixed(2)}
        </div>
      </div>
    )
  }

  // Fallback when billing data not available
  const newTotal = fallbackTotal + 0.15
  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-2">
      <div className="text-xs text-blue-700 text-center font-mono font-semibold">
        💰 €{fallbackTotal.toFixed(2)} + €0.15 = €{newTotal.toFixed(2)}
      </div>
    </div>
  )
}
