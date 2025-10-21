import { Calculator, ShoppingCart, Users } from "lucide-react"
import { useState } from "react"

// Pricing constants
const PRICES = {
  MONTHLY_CHANNEL: 59.0,
  MESSAGE: 0.15,
  FREE_MESSAGES: 100,
}

export function SimplePricingSimulator() {
  const [channels, setChannels] = useState(1)
  const [messages, setMessages] = useState(100)
  const [orders, setOrders] = useState(50)
  const [newCustomers, setNewCustomers] = useState(20)

  // Calculate costs
  const subscriptionCost = channels * PRICES.MONTHLY_CHANNEL
  const freeMessages = channels * PRICES.FREE_MESSAGES
  const billableMessages = Math.max(0, messages - freeMessages)
  const messagesCost = billableMessages * PRICES.MESSAGE
  const totalCost = subscriptionCost + messagesCost

  return (
    <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl border-2 border-blue-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="h-6 w-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">
          Monthly Cost Calculator
        </h3>
      </div>

      <div className="space-y-6">
        {/* Channels Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">
              Active Channels
            </label>
            <span className="text-2xl font-bold text-blue-600">{channels}</span>
          </div>
          <input
            type="range"
            value={channels}
            onChange={(e) => setChannels(Number(e.target.value))}
            min={1}
            max={10}
            step={1}
            className="w-full h-3 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Messages Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">
              Monthly Messages
            </label>
            <span className="text-2xl font-bold text-green-600">
              {messages}
            </span>
          </div>
          <input
            type="range"
            value={messages}
            onChange={(e) => setMessages(Number(e.target.value))}
            min={0}
            max={1000}
            step={50}
            className="w-full h-3 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>500</span>
            <span>1000+</span>
          </div>
        </div>

        {/* Orders Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <ShoppingCart className="h-4 w-4" />
              Monthly Orders
            </label>
            <span className="text-2xl font-bold text-purple-600">{orders}</span>
          </div>
          <input
            type="range"
            value={orders}
            onChange={(e) => setOrders(Number(e.target.value))}
            min={0}
            max={500}
            step={10}
            className="w-full h-3 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>250</span>
            <span>500+</span>
          </div>
        </div>

        {/* New Customers Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Users className="h-4 w-4" />
              New Customers
            </label>
            <span className="text-2xl font-bold text-orange-600">
              {newCustomers}
            </span>
          </div>
          <input
            type="range"
            value={newCustomers}
            onChange={(e) => setNewCustomers(Number(e.target.value))}
            min={0}
            max={200}
            step={5}
            className="w-full h-3 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>100</span>
            <span>200+</span>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white/60 rounded-lg p-4 space-y-3 border border-gray-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Subscription ({channels} × €{PRICES.MONTHLY_CHANNEL})
            </span>
            <span className="font-semibold text-gray-900">
              €{subscriptionCost.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Messages ({billableMessages} × €{PRICES.MESSAGE})
            </span>
            <span className="font-semibold text-gray-900">
              €{messagesCost.toFixed(2)}
            </span>
          </div>
          <div className="pt-3 border-t border-gray-300 flex justify-between items-center">
            <span className="text-lg font-bold text-gray-900">
              Total per Month
            </span>
            <span className="text-3xl font-bold text-green-600">
              €{totalCost.toFixed(2)}
            </span>
          </div>

          {/* Business Metrics */}
          <div className="pt-3 border-t border-gray-200 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" />
                Expected Orders
              </span>
              <span className="font-bold text-purple-600">{orders}/month</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1">
                <Users className="h-3 w-3" />
                New Customers
              </span>
              <span className="font-bold text-orange-600">
                {newCustomers}/month
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-gray-600 text-center">
          💡 First {PRICES.FREE_MESSAGES} messages/month are free per channel
        </div>
      </div>
    </div>
  )
}
