import { usePricing } from "@/hooks/usePricing"
import { useState } from "react"

export function PricingCalculator() {
  const { usage, isLoading } = usePricing()
  const [channels, setChannels] = useState(1)
  const [messages, setMessages] = useState(100)

  const MONTHLY_CHANNEL_COST = usage.MONTHLY_CHANNEL_COST ?? 59.0
  const MESSAGE_COST = usage.MESSAGE ?? 0.1
  const FREE_MESSAGES_PER_CHANNEL = 100

  if (isLoading) {
    return <div className="text-center py-4">Caricamento prezzi...</div>
  }

  const calculatePrice = () => {
    const subscriptionCost = channels * MONTHLY_CHANNEL_COST
    const totalFreeMessages = channels * FREE_MESSAGES_PER_CHANNEL
    const billableMessages = Math.max(0, messages - totalFreeMessages)
    const messagesCost = billableMessages * MESSAGE_COST
    const totalCost = subscriptionCost + messagesCost

    return {
      subscription: subscriptionCost.toFixed(2),
      messages: messagesCost.toFixed(2),
      total: totalCost.toFixed(2),
    }
  }

  const price = calculatePrice()

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-slate-900">
        Pricing Calculator
      </h3>
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 space-y-6">
        {/* Monthly Channels */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-slate-700">
              Active Channels
            </label>
            <span className="text-lg font-bold text-slate-900">{channels}</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={channels}
            onChange={(e) => setChannels(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Monthly Messages */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-slate-700">
              Monthly Messages
            </label>
            <span className="text-lg font-bold text-slate-900">{messages}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1000"
            step="50"
            value={messages}
            onChange={(e) => setMessages(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>0</span>
            <span>500</span>
            <span>1000+</span>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">
              Subscription (€{MONTHLY_CHANNEL_COST}/channel)
            </span>
            <span className="font-medium text-slate-900">
              €{price.subscription}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">
              Messages (€{MESSAGE_COST}/msg)
            </span>
            <span className="font-medium text-slate-900">
              €{price.messages}
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-3 border-t border-slate-200">
            <span className="text-slate-900">Total per Month</span>
            <span className="text-green-600">€{price.total}</span>
          </div>
        </div>

        <div className="text-xs text-slate-500 text-center pt-2">
          * First {FREE_MESSAGES_PER_CHANNEL} messages/month are free per
          channel
        </div>
      </div>
    </div>
  )
}
