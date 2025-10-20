import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Euro,
  MessageSquare,
  Package,
  Send,
  ShoppingCart,
  UserPlus,
} from "lucide-react"
import { PricingSimulator } from "./PricingSimulator"

export function PricingList() {
  const pricingItems = [
    {
      icon: Send,
      title: "Channel",
      description: "Monthly cost",
      price: "€49.00",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      icon: MessageSquare,
      title: "LLM Response",
      description: "For each chatbot response",
      price: "€0.15",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      icon: UserPlus,
      title: "New Customer",
      description: "For each new customer",
      price: "€1.50",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      icon: ShoppingCart,
      title: "New Order",
      description: "For each new order",
      price: "€1.50",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      icon: Package,
      title: "Push Notification",
      description: "For each push campaign message",
      price: "€1.00",
      color: "text-pink-600",
      bgColor: "bg-pink-100",
    },
    {
      icon: MessageSquare,
      title: "Human Support",
      description: "For each human support request",
      price: "€1.00",
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
  ]

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-green-600" />
            Pricing List
          </CardTitle>
          <p className="text-sm text-gray-600">
            Transparent pricing for all ShopMe services
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pricingItems.map((item, index) => {
              const IconComponent = item.icon
              return (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${item.bgColor}`}>
                      <IconComponent className={`h-5 w-5 ${item.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {item.description}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900">
                          {item.price}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Additional Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Transparent Billing
                </p>
                <p className="text-sm text-gray-600">
                  All costs are calculated automatically and displayed in the
                  analytics dashboard. No hidden fees or surprise costs.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Simulator */}
      <PricingSimulator />
    </>
  )
}
