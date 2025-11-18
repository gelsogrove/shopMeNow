import { usePricing } from "@/hooks/usePricing"
import { Bell, Check, MessageSquare, ShoppingCart, Users } from "lucide-react"

export function PricingCard() {
  // Fetch pricing from API (centralized)
  const { usage, plans, isLoading } = usePricing()

  // Show loading state
  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl border-2 border-blue-200 p-6 lg:p-8">
        <div className="text-center py-8 text-gray-500">
          Caricamento prezzi...
        </div>
      </div>
    )
  }

  // Use API prices with fallbacks
  const PRICES = {
    MONTHLY_CHANNEL: usage.MONTHLY_CHANNEL_COST ?? 59.0,
    MESSAGE: usage.MESSAGE ?? 0.1,
    WELCOME_MESSAGE: usage.WELCOME_MESSAGE ?? 1.0,
    NEW_ORDER: usage.NEW_ORDER ?? 1.0,
    PUSH_CAMPAIGN: usage.PUSH_CAMPAIGN ?? 1.0,
    FREE_MESSAGES: 100,
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl border-2 border-blue-200 p-6 lg:p-8">
      <div className="text-center mb-6">
        <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
          Transparent Pricing
        </h3>
        <p className="text-sm lg:text-base text-gray-600">
          Pay only for what you use
        </p>
      </div>

      {/* Main Price */}
      <div className="text-center mb-6 bg-white/60 rounded-xl p-4 lg:p-6 border border-gray-200">
        <div className="text-4xl lg:text-5xl font-bold text-green-600 mb-2">
          €{PRICES.MONTHLY_CHANNEL}
          <span className="text-lg lg:text-xl text-gray-600 font-normal">
            /month
          </span>
        </div>
        <p className="text-sm lg:text-base text-gray-700 font-medium">
          per channel
        </p>
      </div>

      {/* Usage-Based Costs */}
      <div className="space-y-3 mb-6">
        <h4 className="font-bold text-gray-900 text-base lg:text-lg mb-3">
          Usage-Based Costs:
        </h4>

        {/* New Customers */}
        <div className="bg-white/60 rounded-lg p-3 border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-1.5 rounded-lg">
              <Users className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600" />
            </div>
            <span className="text-sm lg:text-base font-medium text-gray-900">
              New Customer
            </span>
          </div>
          <span className="text-lg lg:text-xl font-bold text-blue-600">
            €{PRICES.WELCOME_MESSAGE.toFixed(2)}
          </span>
        </div>

        {/* New Orders */}
        <div className="bg-white/60 rounded-lg p-3 border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 p-1.5 rounded-lg">
              <ShoppingCart className="h-4 w-4 lg:h-5 lg:w-5 text-purple-600" />
            </div>
            <span className="text-sm lg:text-base font-medium text-gray-900">
              New Order
            </span>
          </div>
          <span className="text-lg lg:text-xl font-bold text-purple-600">
            €{PRICES.NEW_ORDER.toFixed(2)}
          </span>
        </div>

        {/* Push Notifications */}
        <div className="bg-white/60 rounded-lg p-3 border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-orange-100 p-1.5 rounded-lg">
              <Bell className="h-4 w-4 lg:h-5 lg:w-5 text-orange-600" />
            </div>
            <span className="text-sm lg:text-base font-medium text-gray-900">
              Push Campaign
            </span>
          </div>
          <span className="text-lg lg:text-xl font-bold text-orange-600">
            €{PRICES.PUSH_CAMPAIGN.toFixed(2)}
          </span>
        </div>

        {/* Messages */}
        <div className="bg-white/60 rounded-lg p-3 border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-green-100 p-1.5 rounded-lg">
              <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5 text-green-600" />
            </div>
            <span className="text-sm lg:text-base font-medium text-gray-900">
              Message
            </span>
          </div>
          <span className="text-lg lg:text-xl font-bold text-green-600">
            €{PRICES.MESSAGE.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Free Messages Info */}
      <div className="bg-green-50 rounded-lg p-3 border border-green-200 mb-4">
        <div className="flex items-center gap-2 text-green-700">
          <Check className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs lg:text-sm font-semibold">
            {PRICES.FREE_MESSAGES} free messages/month per channel
          </span>
        </div>
      </div>

      {/* Additional Features */}
      <div className="space-y-2">
        <h4 className="font-bold text-gray-900 text-sm lg:text-base mb-2">
          Included Features:
        </h4>
        <div className="flex items-start gap-2 text-xs lg:text-sm">
          <Check className="h-3 w-3 lg:h-4 lg:w-4 text-green-600 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700">AI-Powered Chatbot</span>
        </div>
        <div className="flex items-start gap-2 text-xs lg:text-sm">
          <Check className="h-3 w-3 lg:h-4 lg:w-4 text-green-600 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700">Multi-Language Support</span>
        </div>
        <div className="flex items-start gap-2 text-xs lg:text-sm">
          <Check className="h-3 w-3 lg:h-4 lg:w-4 text-green-600 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700">24/7 Automated Service</span>
        </div>
        <div className="flex items-start gap-2 text-xs lg:text-sm">
          <Check className="h-3 w-3 lg:h-4 lg:w-4 text-green-600 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700">Analytics & Reporting</span>
        </div>
      </div>
    </div>
  )
}
