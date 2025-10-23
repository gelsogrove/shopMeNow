import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calculator,
  Users,
  ShoppingCart,
  MessageSquare,
  Bell,
  Check,
  Sparkles,
  TrendingUp,
  Building2,
  Server,
  Crown,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

// 💰 Pricing constants from backend/src/domain/enums/billing-prices.enum.ts
const BILLING_PRICES = {
  MONTHLY_CHANNEL_COST: 59.0,
  MESSAGE: 0.15,
  NEW_CUSTOMER: 1.5,
  NEW_ORDER: 1.5,
  PUSH_CAMPAIGN: 1.0,
} as const

// 📦 Plan configurations
const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    trial: 14,
    channels: 1,
    products: 50,
    customers: 50,
    features: [
      "Até 1 Canal WhatsApp",
      "Até 50 Produtos",
      "Até 50 Clientes",
      "Multi-Language Support",
      "Análises e Relatórios Avançados",
      "Suporte",
    ],
    disabled: ["Personalização de Marca", "Integração com CRM / banco de dados"],
  },
  BASIC: {
    name: "Basic",
    price: 29,
    channels: 1,
    products: 50,
    customers: 50,
    features: [
      "Até 1 Canal WhatsApp",
      "Até 50 Produtos",
      "Até 50 Clientes",
      "Multi-Language Support",
      "Análises e Relatórios Avançados",
      "Suporte",
    ],
    disabled: ["Personalização de Marca", "Integração com CRM / banco de dados"],
  },
  PREMIUM: {
    name: "Premium",
    price: 59,
    channels: 2,
    products: 100,
    customers: 100,
    features: [
      "Até 2 Canais WhatsApp",
      "Até 100 Produtos",
      "Até 100 Clientes",
      "Multi-Language Support",
      "Análises e Relatórios Avançados",
      "Suporte",
      "Personalização de Marca",
    ],
    disabled: ["Integração com CRM / banco de dados"],
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 199,
    channels: Infinity,
    products: Infinity,
    customers: Infinity,
    features: [
      "Ilimitados Canais WhatsApp",
      "Ilimitados Produtos",
      "Ilimitados Clientes",
      "Multi-Language Support",
      "Análises e Relatórios Avançados",
      "Suporte Prioritário 24/7",
      "Personalização de Marca",
      "Integração com CRM / banco de dados",
      "Server Dedicado",
    ],
    disabled: [],
  },
}

interface SimulationParams {
  channels: number
  messages: number
  newCustomers: number
  newOrders: number
  pushCampaigns: number
  wantBranding: boolean
  wantDedicatedServer: boolean
}

export default function PricingSimulator() {
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLANS>("PREMIUM")
  const [params, setParams] = useState<SimulationParams>({
    channels: 1,
    messages: 500,
    newCustomers: 20,
    newOrders: 50,
    pushCampaigns: 5,
    wantBranding: false,
    wantDedicatedServer: false,
  })

  // Calculate suggested plan based on usage
  const getSuggestedPlan = (): keyof typeof PLANS => {
    if (params.wantDedicatedServer || params.channels > 2) return "ENTERPRISE"
    if (params.channels > 1 || params.messages > 1000 || params.wantBranding) return "PREMIUM"
    if (params.messages > 100 || params.newCustomers > 5) return "BASIC"
    return "FREE"
  }

  // Auto-select suggested plan
  useEffect(() => {
    const suggested = getSuggestedPlan()
    setSelectedPlan(suggested)
  }, [
    params.channels,
    params.messages,
    params.newCustomers,
    params.wantBranding,
    params.wantDedicatedServer,
  ])

  // Calculate costs
  const calculateCost = () => {
    const basePlan = PLANS[selectedPlan].price

    // Usage-based costs
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <Calculator className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Simulador de Preços ShopME
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Descubra o plano ideal para o seu negócio
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Plans Grid - Mobile First */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((planKey) => {
            const plan = PLANS[planKey]
            const isSelected = selectedPlan === planKey
            const isSuggested = getSuggestedPlan() === planKey

            return (
              <motion.div
                key={planKey}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative"
              >
                <Card
                  className={`cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? "ring-2 ring-blue-500 shadow-lg"
                      : "hover:shadow-md border-gray-200"
                  } ${planKey === "ENTERPRISE" ? "border-purple-200 bg-gradient-to-br from-purple-50 to-white" : ""}`}
                  onClick={() => setSelectedPlan(planKey)}
                >
                  {isSuggested && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1">
                        <Sparkles className="w-3 h-3 mr-1 inline" />
                        Recomendado
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-4">
                    {planKey === "ENTERPRISE" && (
                      <Crown className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    )}
                    <CardTitle className="text-lg font-semibold">
                      {plan.name}
                    </CardTitle>
                    <div className="mt-4">
                      {planKey === "FREE" ? (
                        <>
                          <div className="text-4xl font-bold text-gray-900">€0</div>
                          <p className="text-xs text-gray-600 mt-1">/14 dias</p>
                        </>
                      ) : planKey === "ENTERPRISE" ? (
                        <>
                          <div className="text-sm text-gray-600 mb-1">A partir de</div>
                          <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                            €{plan.price}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">/mês</p>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl font-bold text-gray-900">
                            €{plan.price}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">/mês</p>
                        </>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                    {plan.disabled.map((feature, idx) => (
                      <div
                        key={`disabled-${idx}`}
                        className="flex items-start gap-2 text-sm opacity-40"
                      >
                        <div className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-500 line-through">{feature}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Simulator Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Configuration */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Configure seu uso mensal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Channels */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      Canais WhatsApp
                    </label>
                    <Badge variant="secondary">{params.channels}</Badge>
                  </div>
                  <Slider
                    value={[params.channels]}
                    onValueChange={(v) => setParams({ ...params, channels: v[0] })}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-600">
                    Número de canais WhatsApp Business ativos
                  </p>
                </div>

                <Separator />

                {/* Messages */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-green-600" />
                      Mensagens/Interações
                    </label>
                    <Badge variant="secondary">{params.messages}</Badge>
                  </div>
                  <Slider
                    value={[params.messages]}
                    onValueChange={(v) => setParams({ ...params, messages: v[0] })}
                    min={0}
                    max={10000}
                    step={100}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-600">
                    €{BILLING_PRICES.MESSAGE.toFixed(2)} por mensagem/interação com IA
                  </p>
                </div>

                <Separator />

                {/* New Customers */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      Novos Clientes
                    </label>
                    <Badge variant="secondary">{params.newCustomers}</Badge>
                  </div>
                  <Slider
                    value={[params.newCustomers]}
                    onValueChange={(v) => setParams({ ...params, newCustomers: v[0] })}
                    min={0}
                    max={500}
                    step={10}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-600">
                    €{BILLING_PRICES.NEW_CUSTOMER.toFixed(2)} por novo cliente registrado
                  </p>
                </div>

                <Separator />

                {/* New Orders */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-orange-600" />
                      Novos Pedidos
                    </label>
                    <Badge variant="secondary">{params.newOrders}</Badge>
                  </div>
                  <Slider
                    value={[params.newOrders]}
                    onValueChange={(v) => setParams({ ...params, newOrders: v[0] })}
                    min={0}
                    max={1000}
                    step={10}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-600">
                    €{BILLING_PRICES.NEW_ORDER.toFixed(2)} por novo pedido concluído
                  </p>
                </div>

                <Separator />

                {/* Push Campaigns */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Bell className="w-4 h-4 text-yellow-600" />
                      Campanhas Push
                    </label>
                    <Badge variant="secondary">{params.pushCampaigns}</Badge>
                  </div>
                  <Slider
                    value={[params.pushCampaigns]}
                    onValueChange={(v) =>
                      setParams({ ...params, pushCampaigns: v[0] })
                    }
                    min={0}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-600">
                    €{BILLING_PRICES.PUSH_CAMPAIGN.toFixed(2)} por mensagem promocional
                    enviada
                  </p>
                </div>

                <Separator />

                {/* Extras */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">Extras</h3>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Personalização de Marca
                        </p>
                        <p className="text-xs text-gray-600">
                          Seu logo e cores na interface
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={params.wantBranding}
                      onCheckedChange={(checked) =>
                        setParams({ ...params, wantBranding: checked })
                      }
                      disabled={
                        selectedPlan === "FREE" || selectedPlan === "BASIC"
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Server className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Server Dedicado
                        </p>
                        <p className="text-xs text-gray-600">
                          Seu próprio servidor com domínio customizado
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={params.wantDedicatedServer}
                      onCheckedChange={(checked) =>
                        setParams({ ...params, wantDedicatedServer: checked })
                      }
                      disabled={selectedPlan !== "ENTERPRISE"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Cost Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="border-2 border-blue-200 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Resumo de Custos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {/* Plan Base */}
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm font-medium text-gray-700">
                      Plano {PLANS[selectedPlan].name}
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      €{costs.basePlan.toFixed(2)}
                    </span>
                  </div>

                  {/* Usage Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Custos por Uso
                    </h4>

                    {costs.messageCost > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          Mensagens ({params.messages})
                        </span>
                        <span className="text-gray-900 font-medium">
                          €{costs.messageCost.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {costs.customerCost > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          Novos Clientes ({params.newCustomers})
                        </span>
                        <span className="text-gray-900 font-medium">
                          €{costs.customerCost.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {costs.orderCost > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          Novos Pedidos ({params.newOrders})
                        </span>
                        <span className="text-gray-900 font-medium">
                          €{costs.orderCost.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {costs.pushCost > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          Campanhas ({params.pushCampaigns})
                        </span>
                        <span className="text-gray-900 font-medium">
                          €{costs.pushCost.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Total */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700">
                        Total Estimado
                      </span>
                      <div className="text-right">
                        <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          €{costs.total.toFixed(2)}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">por mês</p>
                      </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <Button
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-6"
                    size="lg"
                  >
                    {selectedPlan === "FREE"
                      ? "Começar Teste Grátis"
                      : `Começar com ${PLANS[selectedPlan].name}`}
                  </Button>

                  {/* Info Note */}
                  <p className="text-xs text-center text-gray-600">
                    💡 Todos os custos de uso são transparentes e cobrados mensalmente
                    com base no consumo real
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Bottom Info */}
        <Card className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Por que escolher ShopME?
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Todos os custos de uso são transparentes e cobrados mensalmente com
                  base no consumo real. Sem surpresas, sem taxas ocultas. Você só paga
                  pelo que usa! 🎉
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
