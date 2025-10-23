import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/LanguageContext"
import { usePricing } from "@/hooks/usePricing"
import { Check, MessageSquare, ShoppingCart, X } from "lucide-react"

interface PricingPlan {
  name: string
  price: string
  priceSuffix?: string
  description: string
  features: Array<{ name: string; included: boolean }>
  isPopular?: boolean
  buttonText: string
  buttonVariant: "default" | "outline"
}

export function PricingPlans() {
  const { t } = useLanguage()
  const { plans: pricingPlans, usage, isLoading } = usePricing()

  // Show loading state while fetching prices
  if (isLoading) {
    return (
      <div className="py-16 bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-600">Loading pricing...</p>
        </div>
      </div>
    )
  }

  // Use pricing from database (with fallbacks for safety)
  const PRICES = {
    MONTHLY_CHANNEL: usage.MONTHLY_CHANNEL_COST ?? 59.0,
    MESSAGE: usage.MESSAGE ?? 0.15,
    NEW_CUSTOMER: usage.NEW_CUSTOMER ?? 1.0,
    NEW_ORDER: usage.NEW_ORDER ?? 1.5,
    PUSH_CAMPAIGN: usage.PUSH_CAMPAIGN ?? 1.0,
  }

  // Build dynamic features with translations
  const getFeatureText = (
    count: number | string,
    type: "channel" | "channels" | "products" | "clients"
  ) => {
    if (count === "Unlimited") {
      return `${t("pricing.features.unlimited")} ${t(
        `pricing.features.${type}`
      )}`
    }
    if (typeof count === "number") {
      return `${t("pricing.features.upto")} ${count} ${t(
        `pricing.features.${type}`
      )}`
    }
    return `${count} ${t(`pricing.features.${type}`)}`
  }

  const plans: PricingPlan[] = [
    {
      name: "Free",
      price: "€0",
      priceSuffix: "/14 days",
      description: t("pricing.free.creditDesc"),
      buttonText: t("pricing.button.start") + " Free Trial",
      buttonVariant: "default",
      isPopular: true,
      features: [
        { name: getFeatureText(1, "channel"), included: true },
        { name: getFeatureText(50, "products"), included: true },
        { name: getFeatureText(50, "clients"), included: true },
        { name: "Multi-Language Support", included: true },
        { name: t("pricing.features.analytics"), included: true },
        { name: t("pricing.features.support"), included: true },
        { name: t("pricing.features.branding"), included: false },
        { name: t("pricing.features.integration"), included: false },
      ],
    },
    {
      name: "Basic",
      price: "€29",
      description: t("pricing.basic.desc"),
      buttonText: `${t("pricing.button.start")} Basic`,
      buttonVariant: "default",
      features: [
        { name: getFeatureText(1, "channel"), included: true },
        { name: getFeatureText(50, "products"), included: true },
        { name: getFeatureText(50, "clients"), included: true },
        { name: "Multi-Language Support", included: true },
        { name: t("pricing.features.analytics"), included: true },
        { name: t("pricing.features.support"), included: true },
        { name: t("pricing.features.branding"), included: false },
        { name: t("pricing.features.integration"), included: false },
      ],
    },
    {
      name: "Premium",
      price: "€59",
      description: t("pricing.premium.desc"),
      buttonText: `${t("pricing.button.start")} Premium`,
      buttonVariant: "default",
      features: [
        { name: getFeatureText(2, "channels"), included: true },
        { name: getFeatureText(100, "products"), included: true },
        { name: getFeatureText(100, "clients"), included: true },
        { name: "Multi-Language Support", included: true },
        { name: t("pricing.features.analytics"), included: true },
        { name: t("pricing.features.support"), included: true },
        { name: t("pricing.features.branding"), included: true },
        { name: t("pricing.features.integration"), included: false },
      ],
    },
    {
      name: "Enterprise",
      price: pricingPlans.ENTERPRISE_MONTHLY
        ? `€${pricingPlans.ENTERPRISE_MONTHLY}`
        : "€0",
      priceSuffix: "+",
      description: t("pricing.enterprise.desc"),
      buttonText: t("pricing.button.contact"),
      buttonVariant: "outline",
      features: [
        { name: getFeatureText("Unlimited", "channels"), included: true },
        { name: getFeatureText("Unlimited", "products"), included: true },
        { name: getFeatureText("Unlimited", "clients"), included: true },
        { name: "Multi-Language Support", included: true },
        { name: t("pricing.features.analytics"), included: true },
        { name: t("pricing.features.priority"), included: true },
        { name: t("pricing.features.branding"), included: true },
        { name: t("pricing.features.integration"), included: true },
        { name: "Server Dedicado", included: true },
      ],
    },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
          {t("pricing.title")}
        </h2>
        <p className="text-lg text-gray-600">{t("pricing.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-2xl border-2 p-8 flex flex-col h-full min-h-[600px] ${
              plan.isPopular
                ? "border-blue-500 bg-gradient-to-br from-blue-50 to-green-50 shadow-xl scale-105"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="text-center mb-6 flex flex-col justify-between min-h-[110px]">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {plan.name}
              </h3>
              <div className="mb-3">
                {plan.price !== "Custom" && (
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.price}
                  </span>
                )}
                {plan.priceSuffix && (
                  <span className="text-gray-600"> {plan.priceSuffix}</span>
                )}
                {plan.name !== "Free" &&
                  plan.name !== "Enterprise" &&
                  plan.price !== "Custom" && (
                    <span className="text-gray-600">/month</span>
                  )}
              </div>
              <p className="text-gray-600 min-h-[40px]">{plan.description}</p>
            </div>

            <div className="flex-grow mb-8">
              <Button
                className={`w-full ${
                  plan.name === "Basic" || plan.name === "Premium"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : ""
                }`}
                variant={plan.buttonVariant}
                size="lg"
                disabled={
                  plan.name === "Premium" ||
                  plan.name === "Enterprise" ||
                  plan.name === "Basic"
                }
              >
                {plan.name === "Free" && "Start Free Trial"}
                {plan.name === "Basic" && "Start Basic"}
                {plan.name === "Premium" && "Start Premium"}
                {plan.name === "Enterprise" && "Contact Sales"}
              </Button>
            </div>

            <div className="space-y-3">
              {plan.features.map((feature) => (
                <div key={feature.name} className="flex items-start gap-3">
                  {feature.included ? (
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-5 w-5 text-gray-300 flex-shrink-0 mt-0.5" />
                  )}
                  <span
                    className={`text-sm ${
                      feature.included ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    {feature.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Usage-Based Pricing Details */}
      <div className="mt-16">
        <div className="text-center mb-4 text-gray-700 font-semibold">
          {t("pricing.usage.title")}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {/* Messages */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
            <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-600 mb-1">
              €{PRICES.MESSAGE}
            </div>
            <div className="text-sm font-medium text-gray-900 mb-2">
              {t("pricing.usage.message")}
            </div>
            <p className="text-xs text-gray-600">
              {t("pricing.usage.message.desc")}
            </p>
          </div>

          {/* New Customer */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-1">
              €{PRICES.NEW_CUSTOMER.toFixed(2)}
            </div>
            <div className="text-sm font-medium text-gray-900 mb-2">
              {t("pricing.usage.customer")}
            </div>
            <p className="text-xs text-gray-600">
              {t("pricing.usage.customer.desc")}
            </p>
          </div>

          {/* New Order */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShoppingCart className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-1">
              €{PRICES.NEW_ORDER.toFixed(2)}
            </div>
            <div className="text-sm font-medium text-gray-900 mb-2">
              {t("pricing.usage.order")}
            </div>
            <p className="text-xs text-gray-600">
              {t("pricing.usage.order.desc")}
            </p>
          </div>

          {/* Push Campaign */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
            <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <div className="text-3xl font-bold text-orange-600 mb-1">
              €{PRICES.PUSH_CAMPAIGN.toFixed(2)}
            </div>
            <div className="text-sm font-medium text-gray-900 mb-2">
              {t("pricing.usage.push")}
            </div>
            <p className="text-xs text-gray-600">
              {t("pricing.usage.push.desc")}
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            💡 All usage costs are transparent and billed monthly based on
            actual consumption
          </p>
        </div>
      </div>
    </div>
  )
}
