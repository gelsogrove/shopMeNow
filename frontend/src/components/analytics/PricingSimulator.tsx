import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePricing } from "@/hooks/usePricing"
import {
  Calculator,
  MessageSquare,
  Send,
  ShoppingCart,
  UserPlus,
} from "lucide-react"
import { useState } from "react"

export function PricingSimulator() {
  // Fetch pricing from API (centralized)
  const { usage, isLoading } = usePricing()

  const [messages, setMessages] = useState(100)
  const [customers, setCustomers] = useState(10)
  const [orders, setOrders] = useState(20)
  const [pushCampaigns, setPushCampaigns] = useState(10)

  // Show loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulatore Costi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Caricamento prezzi...
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate costs using API prices
  const messageCost = messages * (usage.MESSAGE ?? 0.1)
  const customerCost = customers * (usage.WELCOME_MESSAGE ?? 1.0)
  const orderCost = orders * (usage.NEW_ORDER ?? 1.0)
  const pushCampaignCost = pushCampaigns * (usage.PUSH_CAMPAIGN ?? 1.0)

  const totalVariableCost =
    messageCost + customerCost + orderCost + pushCampaignCost

  const totalMonthlyCost =
    (usage.MONTHLY_CHANNEL_COST ?? 59.0) + totalVariableCost

  const sliders = [
    {
      icon: MessageSquare,
      label: "LLM Messages",
      description: "AI chatbot responses",
      value: messages,
      setValue: setMessages,
      max: 1000,
      step: 10,
      unitCost: usage.MESSAGE ?? 0.1,
      cost: messageCost,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      icon: UserPlus,
      label: "New Customers",
      description: "Customer registrations",
      value: customers,
      setValue: setCustomers,
      max: 100,
      step: 1,
      unitCost: usage.WELCOME_MESSAGE ?? 1.0,
      cost: customerCost,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      icon: ShoppingCart,
      label: "New Orders",
      description: "Orders processed",
      value: orders,
      setValue: setOrders,
      max: 200,
      step: 1,
      unitCost: usage.NEW_ORDER ?? 1.0,
      cost: orderCost,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      icon: Send,
      label: "Push Notifications",
      description: "Advertising campaigns",
      value: pushCampaigns,
      setValue: setPushCampaigns,
      max: 100,
      step: 1,
      unitCost: usage.PUSH_CAMPAIGN ?? 1.0,
      cost: pushCampaignCost,
      color: "text-pink-600",
      bgColor: "bg-pink-100",
    },
  ]

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-blue-600" />
          Monthly Cost Simulator
        </CardTitle>
        <p className="text-sm text-gray-600">
          Adjust the sliders to estimate your monthly costs
        </p>
      </CardHeader>
      <CardContent>
        {/* Two Column Layout: Sliders Left, Total Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side: Sliders (2 columns) */}
          <div className="lg:col-span-2 space-y-4">
            {sliders.map((slider, index) => {
              const IconComponent = slider.icon
              return (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${slider.bgColor}`}>
                        <IconComponent className={`h-4 w-4 ${slider.color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {slider.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {slider.description} · €{slider.unitCost.toFixed(2)}{" "}
                          each
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {slider.value}
                      </p>
                    </div>
                  </div>

                  {/* Slider */}
                  <input
                    type="range"
                    value={slider.value}
                    onChange={(e) => slider.setValue(Number(e.target.value))}
                    min={0}
                    max={slider.max}
                    step={slider.step}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mb-2 accent-blue-600"
                  />

                  {/* Cost Display */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">0 - {slider.max}</span>
                    <span className={`font-bold ${slider.color}`}>
                      €{slider.cost.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right Side: Total Summary (1 column, sticky) */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-blue-50 to-green-50 p-6 rounded-lg border-2 border-blue-200 sticky top-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                Monthly Total
              </h3>

              <div className="space-y-3">
                {/* Fixed Cost */}
                <div className="flex items-center justify-between text-sm pb-2 border-b border-gray-300">
                  <span className="text-gray-700 font-medium">Fixed Cost</span>
                  <span className="font-bold text-orange-600">
                    €{(usage.MONTHLY_CHANNEL_COST ?? 59.0).toFixed(2)}
                  </span>
                </div>

                {/* Variable Costs Breakdown */}
                <div className="space-y-2 pb-2 border-b border-gray-300">
                  <p className="text-xs font-semibold text-gray-600 uppercase">
                    Variable Costs
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Messages</span>
                    <span className="font-semibold text-blue-600">
                      €{messageCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Customers</span>
                    <span className="font-semibold text-green-600">
                      €{customerCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Orders</span>
                    <span className="font-semibold text-purple-600">
                      €{orderCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Push</span>
                    <span className="font-semibold text-pink-600">
                      €{pushCampaignCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-medium pt-1">
                    <span className="text-gray-700">Subtotal</span>
                    <span className="text-blue-600">
                      €{totalVariableCost.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-base font-bold text-gray-900">
                    Total
                  </span>
                  <span className="text-3xl font-bold text-green-600">
                    €{totalMonthlyCost.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Info Box */}
              <div className="mt-4 p-3 bg-white/60 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-900">
                  💡 This is an estimate. Actual costs in Billing tab.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
