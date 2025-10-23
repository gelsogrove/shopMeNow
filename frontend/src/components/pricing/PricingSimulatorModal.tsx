import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { usePricing } from "@/hooks/usePricing"
import {
  Bell,
  Building2,
  Calculator,
  MessageSquare,
  Server,
  ShoppingCart,
  Sparkles,
  Users,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"

interface SimulationParams {
  totalProducts: number // Total products in catalog
  totalCustomers: number // Total customers in database
  channels: number
  messages: number
  newCustomers: number
  newOrders: number
  pushCampaigns: number
  wantBranding: boolean
  wantDedicatedServer: boolean
}

interface PricingSimulatorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  t: (key: string) => string
}

export function PricingSimulatorModal({
  open,
  onOpenChange,
  t,
}: PricingSimulatorModalProps) {
  // Fetch pricing from database
  const { plans, usage, thresholds, isLoading } = usePricing()

  // 💰 Dynamic pricing from database with fallbacks
  const BILLING_PRICES = {
    MONTHLY_CHANNEL_COST: usage.MONTHLY_CHANNEL_COST ?? 59.0,
    MESSAGE: usage.MESSAGE ?? 0.15,
    NEW_CUSTOMER: usage.NEW_CUSTOMER ?? 1.0,
    NEW_ORDER: usage.NEW_ORDER ?? 1.5,
    PUSH_CAMPAIGN: usage.PUSH_CAMPAIGN ?? 1.0,
  } as const

  // 📦 Plan configurations with dynamic pricing
  const PLANS = {
    FREE: { name: "Free", price: plans.FREE_MONTHLY || 0 },
    BASIC: { name: "Basic", price: plans.BASIC_MONTHLY || 0 },
    PREMIUM: { name: "Premium", price: plans.PREMIUM_MONTHLY || 0 },
    ENTERPRISE: { name: "Enterprise", price: plans.ENTERPRISE_MONTHLY || 0 },
  }

  const [selectedPlan, setSelectedPlan] =
    useState<keyof typeof PLANS>("PREMIUM")
  const [params, setParams] = useState<SimulationParams>({
    totalProducts: 50, // Default number of products in catalog
    totalCustomers: 100, // Total customers in database
    channels: 1,
    messages: 300,
    newCustomers: 10,
    newOrders: 20,
    pushCampaigns: 3,
    wantBranding: false,
    wantDedicatedServer: false,
  })

  // 💡 Calculate suggestions based on total customers
  const getSuggestions = () => {
    const { totalCustomers } = params
    return {
      // ~30% of customers message monthly
      suggestedMessages: Math.round(totalCustomers * 0.3),
      // ~10% new customers monthly
      suggestedNewCustomers: Math.round(totalCustomers * 0.1),
      // ~5% escalate to human support
      suggestedHumanSupport: Math.round(totalCustomers * 0.05),
      // 1-3 push campaigns per month
      suggestedPushCampaigns:
        totalCustomers > 200 ? 3 : totalCustomers > 100 ? 2 : 1,
    }
  }

  const suggestions = getSuggestions()

  // Calculate suggested plan based on usage
  const getSuggestedPlan = (): keyof typeof PLANS => {
    // ENTERPRISE: Server Dedicato OR più di 2 canali OR più di 500 clienti OR più di 200 prodotti
    if (
      params.wantDedicatedServer ||
      params.channels > 2 ||
      params.totalCustomers > 500 ||
      params.totalProducts > 200
    )
      return "ENTERPRISE"

    // PREMIUM: Branding OR più di 1 canale OR più di 100 clienti OR più di 500 messaggi OR più di 100 prodotti
    if (
      params.wantBranding ||
      params.channels > 1 ||
      params.totalCustomers > 100 ||
      params.messages > 500 ||
      params.totalProducts > 100
    )
      return "PREMIUM"

    // BASIC: più di 50 clienti OR più di 100 messaggi OR più di 5 nuovi clienti al mese OR più di 50 prodotti
    if (
      params.totalCustomers > 50 ||
      params.messages > 100 ||
      params.newCustomers > 5 ||
      params.totalProducts > 50
    )
      return "BASIC"

    return "FREE"
  }

  // Auto-select suggested plan
  useEffect(() => {
    const suggested = getSuggestedPlan()
    setSelectedPlan(suggested)
  }, [
    params.totalProducts,
    params.totalCustomers,
    params.channels,
    params.messages,
    params.newCustomers,
    params.wantBranding,
    params.wantDedicatedServer,
  ])

  // Calculate costs
  const calculateCost = () => {
    const basePlan = PLANS[selectedPlan].price

    const messageCost = params.messages * BILLING_PRICES.MESSAGE
    const customerCost = params.newCustomers * BILLING_PRICES.NEW_CUSTOMER
    const orderCost = params.newOrders * BILLING_PRICES.NEW_ORDER
    const pushCost = params.pushCampaigns * BILLING_PRICES.PUSH_CAMPAIGN

    const totalUsage = messageCost + customerCost + orderCost + pushCost

    return {
      basePlan,
      messageCost,
      customerCost,
      orderCost,
      pushCost,
      totalUsage,
      total: basePlan + totalUsage,
    }
  }

  const costs = calculateCost()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-green-50 to-emerald-50 sticky top-0 z-10 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <Calculator className="w-7 h-7 text-green-600" />
              <span className="text-slate-900">
                {t("pricing.simulator.title")}
              </span>
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {t("pricing.simulator.subtitle")}
          </p>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* Plan Selector Pills */}
          <div className="flex flex-wrap gap-2 mb-6 mt-4">
            {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map(
              (planKey) => {
                const plan = PLANS[planKey]
                const isSelected = selectedPlan === planKey
                const isSuggested = getSuggestedPlan() === planKey

                return (
                  <button
                    key={planKey}
                    onClick={() => setSelectedPlan(planKey)}
                    className={`relative px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      isSelected
                        ? "bg-green-600 text-white shadow-lg scale-105"
                        : "bg-white text-slate-700 border border-slate-200 hover:border-green-300"
                    }`}
                  >
                    {isSuggested && !isSelected && (
                      <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-green-600" />
                    )}
                    {plan.name}
                    {planKey !== "FREE" && (
                      <span className="ml-2 opacity-75">
                        €{plan.price}
                        {planKey === "ENTERPRISE" && "+"}
                      </span>
                    )}
                  </button>
                )
              }
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Configuration */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-slate-900">
                    {t("pricing.simulator.subtitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Total Products - NEW: Context slider */}
                  <div className="space-y-2 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-2 border-blue-300">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                        <ShoppingCart className="w-5 h-5 text-blue-700" />
                        {t("pricing.simulator.totalProducts")}
                      </label>
                      <Badge
                        variant="secondary"
                        className="bg-blue-700 text-white text-base px-3 py-1"
                      >
                        {params.totalProducts}
                      </Badge>
                    </div>
                    <Slider
                      value={[params.totalProducts]}
                      onValueChange={(v) =>
                        setParams({ ...params, totalProducts: v[0] })
                      }
                      min={5}
                      max={500}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-600 font-medium">
                      {t("pricing.simulator.totalProducts.help")}
                    </p>
                  </div>

                  {/* Total Customers - NEW: Context slider */}
                  <div className="space-y-2 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border-2 border-slate-300">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                        <Users className="w-5 h-5 text-slate-700" />
                        {t("pricing.simulator.totalCustomers")}
                      </label>
                      <Badge
                        variant="secondary"
                        className="bg-slate-700 text-white text-base px-3 py-1"
                      >
                        {params.totalCustomers}
                      </Badge>
                    </div>
                    <Slider
                      value={[params.totalCustomers]}
                      onValueChange={(v) =>
                        setParams({ ...params, totalCustomers: v[0] })
                      }
                      min={10}
                      max={1000}
                      step={10}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-600 font-medium">
                      {t("pricing.simulator.totalCustomers.help")}
                    </p>
                  </div>

                  <Separator className="bg-slate-300" />

                  {/* Channels */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium flex items-center gap-2 text-slate-700">
                        <MessageSquare className="w-4 h-4 text-green-600" />
                        {t("pricing.simulator.channels")}
                      </label>
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700"
                      >
                        {params.channels}
                      </Badge>
                    </div>
                    <Slider
                      value={[params.channels]}
                      onValueChange={(v) =>
                        setParams({ ...params, channels: v[0] })
                      }
                      min={1}
                      max={5}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  <Separator className="bg-slate-200" />

                  {/* Messages - Range più realistico: 0-2000 */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium flex items-center gap-2 text-slate-700">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        {t("pricing.simulator.messages")}
                      </label>
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-700"
                      >
                        {params.messages}/mês
                      </Badge>
                    </div>
                    <Slider
                      value={[params.messages]}
                      onValueChange={(v) =>
                        setParams({ ...params, messages: v[0] })
                      }
                      min={0}
                      max={2000}
                      step={50}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-600">
                      €{BILLING_PRICES.MESSAGE.toFixed(2)} por mensagem
                    </p>
                  </div>

                  <Separator className="bg-slate-200" />

                  {/* New Customers */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium flex items-center gap-2 text-slate-700">
                        <Users className="w-4 h-4 text-purple-600" />
                        {t("pricing.simulator.newCustomers")}
                      </label>
                      <Badge
                        variant="secondary"
                        className="bg-purple-100 text-purple-700"
                      >
                        {params.newCustomers}/mês
                      </Badge>
                    </div>
                    <Slider
                      value={[params.newCustomers]}
                      onValueChange={(v) =>
                        setParams({ ...params, newCustomers: v[0] })
                      }
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-600">
                      €{BILLING_PRICES.NEW_CUSTOMER.toFixed(2)} por novo cliente
                    </p>
                  </div>

                  <Separator className="bg-slate-200" />

                  {/* New Orders - Range più realistico: 0-200 */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium flex items-center gap-2 text-slate-700">
                        <ShoppingCart className="w-4 h-4 text-orange-600" />
                        {t("pricing.simulator.newOrders")}
                      </label>
                      <Badge
                        variant="secondary"
                        className="bg-orange-100 text-orange-700"
                      >
                        {params.newOrders}/mês
                      </Badge>
                    </div>
                    <Slider
                      value={[params.newOrders]}
                      onValueChange={(v) =>
                        setParams({ ...params, newOrders: v[0] })
                      }
                      min={0}
                      max={200}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-600">
                      €{BILLING_PRICES.NEW_ORDER.toFixed(2)} por novo pedido
                    </p>
                  </div>

                  <Separator className="bg-slate-200" />

                  {/* Push Campaigns */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium flex items-center gap-2 text-slate-700">
                        <Bell className="w-4 h-4 text-yellow-600" />
                        {t("pricing.simulator.pushCampaigns")}
                      </label>
                      <Badge
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-700"
                      >
                        {params.pushCampaigns}/mês
                      </Badge>
                    </div>
                    <Slider
                      value={[params.pushCampaigns]}
                      onValueChange={(v) =>
                        setParams({ ...params, pushCampaigns: v[0] })
                      }
                      min={0}
                      max={200}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-600">
                      €{BILLING_PRICES.PUSH_CAMPAIGN.toFixed(2)}{" "}
                      {t("pricing.simulator.price.perPushMessage")}
                    </p>
                  </div>

                  <Separator className="bg-slate-200" />

                  {/* Extras */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      {t("pricing.simulator.extras")}
                    </h4>

                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {t("pricing.simulator.branding")}
                          </p>
                          <p className="text-xs text-slate-600">
                            {t("pricing.simulator.branding.desc")}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={params.wantBranding}
                        onCheckedChange={(checked) =>
                          setParams({ ...params, wantBranding: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {t("pricing.simulator.dedicatedServer")}
                          </p>
                          <p className="text-xs text-slate-600">
                            {t("pricing.simulator.dedicatedServer.desc")}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={params.wantDedicatedServer}
                        onCheckedChange={(checked) =>
                          setParams({ ...params, wantDedicatedServer: checked })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Cost Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <Card className="border-2 border-green-200 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calculator className="w-5 h-5" />
                      {t("pricing.simulator.summary")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    {/* Plan Base */}
                    <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                      <span className="text-sm font-medium text-slate-700">
                        {t("pricing.simulator.plan")} {PLANS[selectedPlan].name}
                      </span>
                      <span className="text-lg font-bold text-slate-900">
                        €{costs.basePlan.toFixed(2)}
                      </span>
                    </div>

                    {/* Usage Breakdown */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        {t("pricing.simulator.usageCosts")}
                      </h4>

                      {costs.messageCost > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">
                            Mensagens ({params.messages})
                          </span>
                          <span className="text-slate-900 font-medium">
                            €{costs.messageCost.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {costs.customerCost > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">
                            Clientes ({params.newCustomers})
                          </span>
                          <span className="text-slate-900 font-medium">
                            €{costs.customerCost.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {costs.orderCost > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">
                            Pedidos ({params.newOrders})
                          </span>
                          <span className="text-slate-900 font-medium">
                            €{costs.orderCost.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {costs.pushCost > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">
                            Campanhas ({params.pushCampaigns})
                          </span>
                          <span className="text-slate-900 font-medium">
                            €{costs.pushCost.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <Separator className="bg-slate-200" />

                    {/* Total */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-700">
                          {t("pricing.simulator.monthlyTotal")}
                        </span>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-green-600">
                            €{costs.total.toFixed(2)}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {t("pricing.simulator.estimated")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* CTA Button */}
                    <Button
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-6"
                      size="lg"
                      onClick={() => onOpenChange(false)}
                    >
                      {selectedPlan === "FREE"
                        ? t("pricing.simulator.cta.free")
                        : `${t("pricing.simulator.cta.plan")} ${
                            PLANS[selectedPlan].name
                          }`}
                    </Button>

                    {/* Info Note */}
                    <p className="text-xs text-center text-slate-600">
                      {t("pricing.simulator.transparent")}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
