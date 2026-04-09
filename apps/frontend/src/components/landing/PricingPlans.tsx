import { Button } from "@/components/ui/button"
import { PLAN_CONFIGS, getPlanFeaturesWithText } from "@/config/planFeatures"
import { useLanguage } from "@/contexts/LanguageContext"
import { usePlatformConfig } from "@/hooks/usePlatformConfig"
import { PlanType } from "@/services/subscriptionBillingApi"
import { Check, MessageSquare, X, Bell } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

interface PricingPlan {
  name: string
  planType: PlanType
  price: number
  originalPrice: number | null
  priceSuffix?: string
  description: string
  features: Array<{ name: string; included: boolean }>
  isPopular?: boolean
  buttonText: string
  buttonVariant: "default" | "outline"
}

interface PricingPlansProps {
  onStartFreeTrial?: () => void
  currentPlan?: PlanType | null
  onChangePlan?: () => void
  disableTrial?: boolean
}

export function PricingPlans({ onStartFreeTrial, currentPlan, onChangePlan, disableTrial = false }: PricingPlansProps) {
  const { t } = useLanguage()
  const { prices, isLoading, error, getPriceWithOriginal, freeTrialCredit } = usePlatformConfig()
  const navigate = useNavigate()

  const handleStartFreeTrial = () => {
    if (onStartFreeTrial) {
      onStartFreeTrial()
    } else {
      navigate("/onboarding")
    }
  }

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

  if (error) {
    return (
      <div className="py-16 bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-red-600 font-medium">
            Pricing configuration missing. Please contact support.
          </p>
        </div>
      </div>
    )
  }

  // Get prices from database with original values for strikethrough
  const freePrice = getPriceWithOriginal("FREE_MONTHLY")
  const basicPrice = getPriceWithOriginal("BASIC_MONTHLY")
  const premiumPrice = getPriceWithOriginal("PREMIUM_MONTHLY")
  const enterprisePrice = getPriceWithOriginal("ENTERPRISE_MONTHLY")
  const messagePrice = prices.MESSAGE
  const widgetPrice = prices.WIDGET_MESSAGE
  const pushPrice = prices.PUSH_CAMPAIGN
  const reminderPrice = prices.APPOINTMENT_REMINDER_WHATSAPP

  if (!freePrice || !basicPrice || !premiumPrice || !enterprisePrice || !messagePrice || !widgetPrice || !pushPrice || !reminderPrice) {
    return (
      <div className="py-16 bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-red-600 font-medium">
            Pricing configuration missing. Please contact support.
          </p>
        </div>
      </div>
    )
  }

  // Build plans with DYNAMIC prices from database
  const plans: PricingPlan[] = [
    {
      name: "Free",
      planType: "FREE_TRIAL",
      price: freePrice.current,
      originalPrice: freePrice.original,
      priceSuffix: "/14 days",
      description: t(PLAN_CONFIGS.FREE_TRIAL.descriptionKey || "pricing.free.creditDesc").replace("${amount}", String(freeTrialCredit)),
      buttonText: t("pricing.button.start") + " Free Trial",
      buttonVariant: PLAN_CONFIGS.FREE_TRIAL.buttonVariant || "default",
      isPopular: PLAN_CONFIGS.FREE_TRIAL.isPopular,
      features: getPlanFeaturesWithText("FREE_TRIAL", t),
    },
    {
      name: "Basic",
      planType: "BASIC",
      price: basicPrice.current,
      originalPrice: basicPrice.original,
      description: t(PLAN_CONFIGS.BASIC.descriptionKey || "pricing.basic.desc"),
      buttonText: `${t("pricing.button.start")} Basic`,
      buttonVariant: PLAN_CONFIGS.BASIC.buttonVariant || "default",
      features: getPlanFeaturesWithText("BASIC", t),
    },
    {
      name: "Premium",
      planType: "PREMIUM",
      price: premiumPrice.current,
      originalPrice: premiumPrice.original,
      description: t(PLAN_CONFIGS.PREMIUM.descriptionKey || "pricing.premium.desc"),
      buttonText: `${t("pricing.button.start")} Premium`,
      buttonVariant: PLAN_CONFIGS.PREMIUM.buttonVariant || "default",
      features: getPlanFeaturesWithText("PREMIUM", t),
    },
    {
      name: "Enterprise",
      planType: "ENTERPRISE",
      price: enterprisePrice.current,
      originalPrice: enterprisePrice.original,
      priceSuffix: "/month",
      description: t(PLAN_CONFIGS.ENTERPRISE.descriptionKey || "pricing.enterprise.desc"),
      buttonText: t("pricing.button.contact"),
      buttonVariant: PLAN_CONFIGS.ENTERPRISE.buttonVariant || "outline",
      features: getPlanFeaturesWithText("ENTERPRISE", t),
    },
  ]

  const planOrder: Record<PlanType, number> = {
    FREE_TRIAL: 0,
    BASIC: 1,
    PREMIUM: 2,
    ENTERPRISE: 3,
  }

  const currentOrder =
    currentPlan && planOrder[currentPlan as PlanType] !== undefined
      ? planOrder[currentPlan as PlanType]
      : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
          {t("pricing.title")}
        </h2>
        <p className="text-lg text-gray-600">{t("pricing.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {plans.map((plan) => {
          const order = planOrder[plan.planType]
          const isCurrent = currentOrder !== null && plan.planType === currentPlan
          const isPast = currentOrder !== null && order < (currentOrder as number)
          const isFuture = currentOrder !== null && order > (currentOrder as number)

          const highlightClass = isCurrent
            ? "border-blue-500 bg-gradient-to-br from-blue-50 via-white to-green-50 shadow-xl scale-105"
            : plan.isPopular && !isPast
            ? "border-blue-500 bg-gradient-to-br from-blue-50 to-green-50 shadow-xl scale-105"
            : "border-gray-200 bg-white"

          const disabledClass = isPast ? "opacity-60" : ""
          
          // Frame colors based on plan type
          const frameColors = {
            "Free": "from-gray-100 to-slate-100",
            "Basic": "from-green-100 to-emerald-100",
            "Premium": "from-purple-100 to-pink-100"
          }
          const frameColor = frameColors[plan.name] || "from-gray-100 to-slate-100"

          return (
            <div key={plan.name} className="relative group">
              {/* Decorative rotated background frame */}
              <div className={`absolute inset-0 bg-gradient-to-br ${frameColor} rounded-2xl rotate-1 scale-[1.02] shadow-lg group-hover:rotate-2 transition-transform duration-500`}></div>
              
              <div
                className={`relative rounded-2xl border-2 p-8 flex flex-col h-full min-h-[600px] ${highlightClass} ${disabledClass}`}
              >
              <div className="text-center mb-6 flex flex-col justify-between min-h-[110px]">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
              </h3>
              <div className="mb-3">
                {plan.name === "Free" ? (
                  <>
                    <span className="text-4xl font-bold text-gray-900">
                      $0
                    </span>
                    <span className="text-gray-600"> {plan.priceSuffix}</span>
                  </>
                ) : (
                  <>
                    {/* Show strikethrough original price if different from current */}
                    {plan.originalPrice && plan.originalPrice !== plan.price && (
                      <span className="text-xl text-gray-400 line-through mr-2">
                        ${plan.originalPrice}
                      </span>
                    )}
                    <span className={`text-4xl font-bold ${plan.originalPrice && plan.originalPrice !== plan.price ? "text-green-600" : "text-gray-900"}`}>
                      ${plan.price}
                    </span>
                    <span className="text-gray-600">/month</span>
                  </>
                )}
              </div>
              <p className="text-gray-600 min-h-[40px]">{plan.description}</p>
            </div>

            <div className="flex-grow mb-8">
              {currentOrder === null ? (
                <Button
                  className={`w-full ${
                    plan.name === "Basic" || plan.name === "Premium"
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : ""
                  } ${plan.name === "Free" && disableTrial ? "opacity-60 cursor-not-allowed" : ""}`}
                  variant={plan.buttonVariant}
                  size="lg"
                  disabled={
                    plan.name === "Premium" ||
                    plan.name === "Enterprise" ||
                    plan.name === "Basic"
                  }
                  aria-disabled={plan.name === "Free" && disableTrial}
                  onClick={plan.name === "Free" ? handleStartFreeTrial : undefined}
                  asChild={plan.name === "Enterprise"}
                >
                  {plan.name === "Enterprise" ? (
                    <Link to="/contact">Contact Sales</Link>
                  ) : (
                    <>
                      {plan.name === "Free" && "Start Free Trial"}
                      {plan.name === "Basic" && "Start Basic"}
                      {plan.name === "Premium" && "Start Premium"}
                    </>
                  )}
                </Button>
              ) : (
                <>
                  {isPast ? (
                    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm font-semibold py-3 text-center cursor-not-allowed">
                      Included in your plan
                    </div>
                  ) : isCurrent ? (
                    <div className="w-full rounded-xl border border-green-600 bg-green-50 text-green-700 text-sm font-semibold py-3 text-center">
                      Current plan
                    </div>
                  ) : (
                    <Button
                      className={`w-full ${
                        plan.planType === "ENTERPRISE"
                          ? "border-green-500 text-green-600 hover:bg-green-50"
                          : "bg-green-600 hover:bg-green-700 text-white"
                      }`}
                      variant={plan.planType === "ENTERPRISE" ? "outline" : "default"}
                      size="lg"
                      onClick={
                        plan.planType === "ENTERPRISE"
                          ? undefined
                          : onChangePlan
                      }
                      asChild={plan.planType === "ENTERPRISE"}
                    >
                      {plan.planType === "ENTERPRISE" ? (
                        <Link to="/contact">Contact Sales</Link>
                      ) : (
                        `Upgrade to ${plan.name}`
                      )}
                    </Button>
                  )}
                </>
              )}
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
          </div>
          )
        })}
      </div>

      {/* Usage-Based Pricing Details */}
      <div className="mt-16">
        <div className="text-center mb-8 text-gray-700 font-semibold">
          {t("pricing.usage.title")}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {/* Messages - dynamic from database */}
          <div className="relative group">
            {/* Decorative rotated background frame */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl rotate-2 scale-105 shadow-lg group-hover:rotate-3 transition-transform duration-500"></div>
            
            <div className="relative bg-white rounded-xl p-6 border border-gray-200 text-center shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-600 mb-1">
                ${messagePrice.current.toFixed(2)}
              </div>
              <div className="text-base font-medium text-gray-900 mb-2">
                {t("pricing.usage.message")}
              </div>
              <p className="text-sm text-gray-600">
                {t("pricing.usage.message.desc")}
              </p>
            </div>
          </div>

          {/* Widget messages - dynamic from database */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl rotate-2 scale-105 shadow-lg group-hover:rotate-3 transition-transform duration-500"></div>
            
            <div className="relative bg-white rounded-xl p-6 border border-gray-200 text-center shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="text-3xl font-bold text-emerald-600 mb-1">
                ${widgetPrice.current.toFixed(2)}
              </div>
              <div className="text-base font-medium text-gray-900 mb-2">
                {t("pricing.usage.widget")}
              </div>
              <p className="text-sm text-gray-600">
                {t("pricing.usage.widget.desc")}
              </p>
            </div>
          </div>

          {/* Push Campaign - dynamic from database */}
          <div className="relative group">
            {/* Decorative rotated background frame */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl rotate-2 scale-105 shadow-lg group-hover:rotate-3 transition-transform duration-500"></div>
            
            <div className="relative bg-white rounded-xl p-6 border border-gray-200 text-center shadow-lg hover:shadow-xl transition-all duration-300">
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
                ${pushPrice.current.toFixed(2)}
              </div>
              <div className="text-base font-medium text-gray-900 mb-2">
                {t("pricing.usage.push")}
              </div>
              <p className="text-sm text-gray-600">
                {t("pricing.usage.push.desc")}
              </p>
            </div>
          </div>

          {/* Appointment Reminder - dynamic from database */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-violet-100 rounded-xl rotate-2 scale-105 shadow-lg group-hover:rotate-3 transition-transform duration-500"></div>
            
            <div className="relative bg-white rounded-xl p-6 border border-gray-200 text-center shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-1">
                ${reminderPrice.current.toFixed(2)}
              </div>
              <div className="text-base font-medium text-gray-900 mb-2">
                {t("pricing.usage.reminder")}
              </div>
              <p className="text-sm text-gray-600">
                {t("pricing.usage.reminder.desc")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-base text-gray-600">
            {t("pricing.usage.transparent")}
          </p>
        </div>
      </div>
    </div>
  )
}
