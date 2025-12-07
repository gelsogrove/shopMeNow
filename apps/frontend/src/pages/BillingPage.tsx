/**
 * Billing Page - Subscription & Credit Management
 * Feature 198: Owner-Based Billing
 *
 * Shows:
 * - Subscription status (Active/Paused/etc)
 * - Current plan with upgrade/downgrade options
 * - Credit wallet balance with recharge
 * - Pause/Resume subscription buttons
 * - Monthly invoices history
 *
 * IMPORTANT: All billing is per OWNER (User), not per Workspace!
 * Credit is SHARED across all workspaces owned by the user.
 */

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import {
  getOwnerBillingOverview,
  getOwnerSubscriptionStatus,
  getOwnerTransactions,
  rechargeOwnerCredit,
  pauseOwnerSubscription,
  resumeOwnerSubscription,
  upgradeOwnerPlan,
  scheduleOwnerDowngrade,
  cancelOwnerPendingChange,
  getCurrentInvoice,
  formatCurrency,
  getSubscriptionStatusInfo,
  getTransactionTypeInfo,
  type BillingOverview,
  type SubscriptionStatusResponse,
  type Transaction,
  type PlanType,
  type Invoice,
} from "@/services/subscriptionBillingApi"
import {
  FileText,
  Loader2,
  CreditCard,
  PauseCircle,
  PlayCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Wallet,
  Calendar,
  RefreshCw,
  XCircle,
  Check,
} from "lucide-react"
import { useEffect, useState } from "react"

// Plan configurations for display
const PLAN_CONFIGS: Record<PlanType, { name: string; price: number; features: string[] }> = {
  FREE_TRIAL: { name: "Free Trial", price: 0, features: ["14 giorni gratis", "1 workspace", "100 messaggi"] },
  BASIC: { name: "Basic", price: 19, features: ["1 workspace", "Illimitati messaggi", "1 canale WhatsApp"] },
  PREMIUM: { name: "Premium", price: 49, features: ["3 workspace", "Illimitati messaggi", "3 canali WhatsApp"] },
  ENTERPRISE: { name: "Enterprise", price: 99, features: ["Illimitati workspace", "Illimitati messaggi", "Illimitati canali"] },
}

export default function BillingPage() {
  // State
  const [isLoading, setIsLoading] = useState(true)
  const [billing, setBilling] = useState<BillingOverview | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusResponse | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null)
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false)

  // Action modals
  const [showRechargeModal, setShowRechargeModal] = useState(false)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showDowngradeModal, setShowDowngradeModal] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState("20")
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Load data on mount
  useEffect(() => {
    loadBillingData()
  }, [])

  const loadBillingData = async () => {
    try {
      setIsLoading(true)
      logger.info("📦 [BillingPage] Loading owner billing data...")

      const [billingData, statusData] = await Promise.all([
        getOwnerBillingOverview(true),
        getOwnerSubscriptionStatus(true),
      ])

      setBilling(billingData)
      setSubscriptionStatus(statusData)
      logger.info("📦 [BillingPage] Billing data loaded:", { plan: billingData.billing.planType, balance: billingData.billing.creditBalance })

      // Load transactions and current invoice
      loadTransactions()
      loadCurrentInvoice()
    } catch (error) {
      logger.error("Failed to load billing data:", error)
      toast.error("Errore nel caricamento dei dati di fatturazione")
    } finally {
      setIsLoading(false)
    }
  }

  const loadCurrentInvoice = async () => {
    try {
      setIsLoadingInvoice(true)
      const invoice = await getCurrentInvoice()
      setCurrentInvoice(invoice)
      logger.info("📦 [BillingPage] Current invoice loaded:", { 
        month: invoice.periodMonth, 
        total: invoice.totalAmount 
      })
    } catch (error) {
      logger.error("Failed to load current invoice:", error)
    } finally {
      setIsLoadingInvoice(false)
    }
  }

  const loadTransactions = async () => {
    try {
      setIsLoadingTransactions(true)
      const result = await getOwnerTransactions({ limit: 50 })
      setTransactions(result.transactions || [])
    } catch (error) {
      logger.error("Failed to load transactions:", error)
    } finally {
      setIsLoadingTransactions(false)
    }
  }

  // Actions
  const handleRecharge = async () => {
    const amount = parseFloat(rechargeAmount)
    if (isNaN(amount) || amount < 10 || amount > 1000) {
      toast.error("Importo non valido (min €10, max €1000)")
      return
    }

    try {
      setIsProcessing(true)
      await rechargeOwnerCredit(amount)
      toast.success(`Credito ricaricato di €${amount}`)
      setShowRechargeModal(false)
      setRechargeAmount("20")
      loadBillingData()
    } catch (error: any) {
      logger.error("Recharge failed:", error)
      toast.error(error.response?.data?.error || "Errore durante la ricarica")
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePause = async () => {
    try {
      setIsProcessing(true)
      await pauseOwnerSubscription()
      toast.success("Abbonamento in pausa! I chatbot non risponderanno più ai clienti.")
      setShowPauseModal(false)
      loadBillingData()
    } catch (error: any) {
      logger.error("Pause failed:", error)
      toast.error(error.response?.data?.error || "Errore durante la pausa")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleResume = async () => {
    try {
      setIsProcessing(true)
      await resumeOwnerSubscription()
      toast.success("Abbonamento riattivato! I chatbot riprenderanno a rispondere.")
      loadBillingData()
    } catch (error: any) {
      logger.error("Resume failed:", error)
      toast.error(error.response?.data?.error || "Errore durante la riattivazione")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpgrade = async () => {
    if (!selectedPlan) return

    try {
      setIsProcessing(true)
      await upgradeOwnerPlan(selectedPlan as "BASIC" | "PREMIUM" | "ENTERPRISE")
      toast.success(`Piano aggiornato a ${PLAN_CONFIGS[selectedPlan].name}!`)
      setShowUpgradeModal(false)
      setSelectedPlan(null)
      loadBillingData()
    } catch (error: any) {
      logger.error("Upgrade failed:", error)
      toast.error(error.response?.data?.error || "Errore durante l'upgrade")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDowngrade = async () => {
    if (!selectedPlan) return

    try {
      setIsProcessing(true)
      const result = await scheduleOwnerDowngrade(selectedPlan)
      toast.success(
        `Downgrade a ${PLAN_CONFIGS[selectedPlan].name} programmato per ${new Date(result.effectiveDate).toLocaleDateString("it-IT")}`
      )
      setShowDowngradeModal(false)
      setSelectedPlan(null)
      loadBillingData()
    } catch (error: any) {
      logger.error("Downgrade failed:", error)
      toast.error(error.response?.data?.error || "Errore durante il downgrade")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancelPendingChange = async () => {
    try {
      setIsProcessing(true)
      await cancelOwnerPendingChange()
      toast.success("Cambio piano annullato")
      loadBillingData()
    } catch (error: any) {
      logger.error("Cancel pending change failed:", error)
      toast.error(error.response?.data?.error || "Errore")
    } finally {
      setIsProcessing(false)
    }
  }

  // Render helpers
  const currentPlan = billing?.billing.planType || "FREE_TRIAL"
  const planConfig = PLAN_CONFIGS[currentPlan]
  const creditBalance = billing?.billing.creditBalance || 0
  const statusInfo = subscriptionStatus ? getSubscriptionStatusInfo(subscriptionStatus.subscriptionStatus) : null

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
              <p className="text-gray-500">Caricamento fatturazione...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-green-600" />
              Fatturazione
            </h1>
            <p className="text-gray-600 mt-1">Gestisci abbonamento e crediti</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadBillingData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Aggiorna
          </Button>
        </div>

        {/* Pending Downgrade Banner */}
        {subscriptionStatus?.pendingPlanType && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">Cambio piano programmato</p>
                    <p className="text-sm text-yellow-600">
                      Dal {subscriptionStatus.pendingPlanEffectiveDate 
                        ? new Date(subscriptionStatus.pendingPlanEffectiveDate).toLocaleDateString("it-IT")
                        : "prossimo mese"} passerai al piano {PLAN_CONFIGS[subscriptionStatus.pendingPlanType]?.name}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelPendingChange}
                  disabled={isProcessing}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Annulla
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Failed Banner */}
        {subscriptionStatus?.subscriptionStatus === "PAYMENT_FAILED" && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">Pagamento fallito</p>
                  <p className="text-sm text-red-600">
                    Il chatbot non risponde ai clienti. Ricarica il credito per riattivare il servizio.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscription Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  �� Abbonamento
                  {statusInfo && (
                    <Badge variant={statusInfo.color === "emerald" ? "default" : "secondary"}>
                      {statusInfo.icon} {statusInfo.label}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Il tuo piano e stato dell'abbonamento
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Plan */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Piano attuale</p>
                <p className="text-2xl font-bold">{planConfig.name}</p>
                <p className="text-lg text-gray-600">€{planConfig.price}/mese</p>
              </div>
              <div className="flex gap-2">
                {currentPlan !== "ENTERPRISE" && (
                  <Button onClick={() => setShowUpgradeModal(true)}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Upgrade
                  </Button>
                )}
                {currentPlan !== "FREE_TRIAL" && currentPlan !== "BASIC" && (
                  <Button variant="outline" onClick={() => setShowDowngradeModal(true)}>
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Downgrade
                  </Button>
                )}
              </div>
            </div>

            {/* Subscription Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                {subscriptionStatus?.subscriptionStatus === "ACTIVE" && subscriptionStatus?.nextBillingDate && (
                  <p className="text-sm text-gray-500">
                    Prossimo rinnovo: {new Date(subscriptionStatus.nextBillingDate).toLocaleDateString("it-IT")}
                  </p>
                )}
                {subscriptionStatus?.subscriptionStatus === "PAUSED" && subscriptionStatus?.pausedAt && (
                  <p className="text-sm text-red-600">
                    In pausa dal: {new Date(subscriptionStatus.pausedAt).toLocaleDateString("it-IT")}
                  </p>
                )}
              </div>
              <div>
                {subscriptionStatus?.subscriptionStatus === "ACTIVE" && (
                  <Button variant="outline" onClick={() => setShowPauseModal(true)}>
                    <PauseCircle className="h-4 w-4 mr-2" />
                    Metti in Pausa
                  </Button>
                )}
                {subscriptionStatus?.subscriptionStatus === "PAUSED" && (
                  <Button onClick={handleResume} disabled={isProcessing}>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Riattiva (Gratis)
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Wallet Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Portafoglio Crediti
                </CardTitle>
                <CardDescription>
                  Credito condiviso tra tutti i tuoi workspace
                </CardDescription>
              </div>
              <Button onClick={() => setShowRechargeModal(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Ricarica
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Saldo attuale</p>
                <p className={`text-3xl font-bold ${creditBalance < 0 ? "text-red-600" : creditBalance < 5 ? "text-yellow-600" : "text-green-600"}`}>
                  {formatCurrency(creditBalance)}
                </p>
              </div>
              {creditBalance < 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-sm font-medium">Credito in negativo!</span>
                </div>
              )}
              {creditBalance >= 0 && creditBalance < 5 && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-sm font-medium">Credito basso</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Soglia minima: -€10.00 (sotto questa soglia il chatbot smette di rispondere)
            </p>
          </CardContent>
        </Card>

        {/* Current Invoice Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🧾 Fattura Corrente
              {currentInvoice && (
                <Badge variant="secondary" className="ml-2">
                  {new Date(currentInvoice.periodStart).toLocaleString("it-IT", { month: "long", year: "numeric" })}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Riepilogo costi del mese corrente (aggiornato in tempo reale)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingInvoice ? (
              <div className="py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : currentInvoice ? (
              <div className="space-y-4">
                {/* Subscription Fee */}
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Abbonamento {PLAN_CONFIGS[currentInvoice.planType]?.name || currentInvoice.planType}</span>
                  <span className="font-medium">€{currentInvoice.subscriptionAmount.toFixed(2)}</span>
                </div>
                
                {/* Consumption Breakdown */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500 uppercase">Consumo questo mese:</p>
                  
                  {currentInvoice.itemsBreakdown.messages.count > 0 && (
                    <div className="flex justify-between items-center pl-4">
                      <span className="text-gray-600">
                        💬 {currentInvoice.itemsBreakdown.messages.count} messaggi
                      </span>
                      <span className="text-red-600">-€{currentInvoice.itemsBreakdown.messages.amount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {currentInvoice.itemsBreakdown.orders.count > 0 && (
                    <div className="flex justify-between items-center pl-4">
                      <span className="text-gray-600">
                        📦 {currentInvoice.itemsBreakdown.orders.count} ordini
                      </span>
                      <span className="text-red-600">-€{currentInvoice.itemsBreakdown.orders.amount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {currentInvoice.itemsBreakdown.pushNotifications.count > 0 && (
                    <div className="flex justify-between items-center pl-4">
                      <span className="text-gray-600">
                        📤 {currentInvoice.itemsBreakdown.pushNotifications.count} notifiche push
                      </span>
                      <span className="text-red-600">-€{currentInvoice.itemsBreakdown.pushNotifications.amount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {currentInvoice.itemsBreakdown.adjustments.count > 0 && (
                    <div className="flex justify-between items-center pl-4">
                      <span className="text-gray-600">
                        ⚙️ {currentInvoice.itemsBreakdown.adjustments.count} aggiustamenti
                      </span>
                      <span className="text-red-600">-€{currentInvoice.itemsBreakdown.adjustments.amount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {currentInvoice.itemsBreakdown.totalConsumption === 0 && (
                    <div className="pl-4 text-gray-400 italic">
                      Nessun consumo registrato
                    </div>
                  )}
                </div>
                
                {/* Total Consumption */}
                <div className="flex justify-between items-center py-2 border-t">
                  <span className="text-gray-600">Totale consumo</span>
                  <span className="font-medium text-red-600">-€{currentInvoice.creditUsage.toFixed(2)}</span>
                </div>
                
                {/* Credit Debt */}
                {currentInvoice.creditDebt > 0 && (
                  <div className="flex justify-between items-center py-2 border-t bg-red-50 px-2 rounded">
                    <span className="text-red-600">Debito credito (da recuperare)</span>
                    <span className="font-medium text-red-600">€{currentInvoice.creditDebt.toFixed(2)}</span>
                  </div>
                )}
                
                {/* TOTAL */}
                <div className="flex justify-between items-center py-3 border-t-2 border-gray-300">
                  <span className="text-lg font-bold">TOTALE PREVISTO</span>
                  <span className="text-2xl font-bold text-green-600">€{currentInvoice.totalAmount.toFixed(2)}</span>
                </div>
                
                {/* Expected charge date */}
                <p className="text-sm text-gray-500 text-center">
                  Addebito previsto: 1 {new Date(currentInvoice.periodEnd).toLocaleString("it-IT", { month: "long", year: "numeric" })}
                </p>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p>Nessuna fattura disponibile</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transactions / Invoices Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Storico Transazioni
            </CardTitle>
            <CardDescription>
              Le tue ultime transazioni e fatture
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTransactions ? (
              <div className="py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p>Nessuna transazione</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.slice(0, 20).map((tx) => {
                    const typeInfo = getTransactionTypeInfo(tx.type)
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(tx.createdAt).toLocaleDateString("it-IT")}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            {typeInfo.icon} {typeInfo.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{tx.description || "-"}</TableCell>
                        <TableCell className={`text-right font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {tx.amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-gray-500">
                          {formatCurrency(tx.balanceAfter)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recharge Modal */}
        <Dialog open={showRechargeModal} onOpenChange={setShowRechargeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>💰 Ricarica Credito</DialogTitle>
              <DialogDescription>
                Inserisci l'importo da ricaricare (min €10, max €1000)
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">€</span>
                <Input
                  type="number"
                  min="10"
                  max="1000"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  className="text-2xl font-bold"
                />
              </div>
              <div className="flex gap-2 mt-4">
                {[20, 50, 100, 200].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setRechargeAmount(String(amount))}
                  >
                    €{amount}
                  </Button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRechargeModal(false)}>
                Annulla
              </Button>
              <Button onClick={handleRecharge} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ricarica €{rechargeAmount}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pause Confirmation Modal */}
        <Dialog open={showPauseModal} onOpenChange={setShowPauseModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>⚠️ Conferma Pausa Abbonamento</DialogTitle>
              <DialogDescription>
                Mettendo in pausa l'abbonamento:
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <p className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-500" />
                Il chatbot smetterà SUBITO di rispondere ai clienti
              </p>
              <p className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                A fine mese pagherai solo il consumo effettivo
              </p>
              <p className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                I tuoi dati (prodotti, clienti, ordini) saranno conservati
              </p>
              <p className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                Potrai riattivare GRATIS quando vuoi
              </p>
              <div className="mt-4 p-3 bg-red-50 rounded-lg">
                <p className="text-sm font-medium text-red-800">
                  ⚡ La pausa è IMMEDIATA - i chatbot smetteranno di rispondere ora
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPauseModal(false)}>
                Annulla
              </Button>
              <Button variant="destructive" onClick={handlePause} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Conferma Pausa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upgrade Modal */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>⬆️ Upgrade Piano</DialogTitle>
              <DialogDescription>
                Scegli il nuovo piano. L'upgrade è immediato.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["BASIC", "PREMIUM", "ENTERPRISE"] as PlanType[])
                .filter((plan) => {
                  const planOrder = { FREE_TRIAL: 0, BASIC: 1, PREMIUM: 2, ENTERPRISE: 3 }
                  return planOrder[plan] > planOrder[currentPlan]
                })
                .map((plan) => {
                  const config = PLAN_CONFIGS[plan]
                  return (
                    <div
                      key={plan}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedPlan === plan
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedPlan(plan)}
                    >
                      <h4 className="font-bold">{config.name}</h4>
                      <p className="text-2xl font-bold text-green-600">€{config.price}/mese</p>
                      <ul className="mt-2 space-y-1">
                        {config.features.map((f, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-center gap-1">
                            <Check className="h-3 w-3 text-green-500" /> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowUpgradeModal(false); setSelectedPlan(null) }}>
                Annulla
              </Button>
              <Button onClick={handleUpgrade} disabled={!selectedPlan || isProcessing}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Conferma Upgrade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Downgrade Modal */}
        <Dialog open={showDowngradeModal} onOpenChange={setShowDowngradeModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>⬇️ Downgrade Piano</DialogTitle>
              <DialogDescription>
                Il downgrade sarà effettivo dal prossimo ciclo di fatturazione.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["BASIC", "PREMIUM"] as PlanType[])
                .filter((plan) => {
                  const planOrder = { FREE_TRIAL: 0, BASIC: 1, PREMIUM: 2, ENTERPRISE: 3 }
                  return planOrder[plan] < planOrder[currentPlan]
                })
                .map((plan) => {
                  const config = PLAN_CONFIGS[plan]
                  return (
                    <div
                      key={plan}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedPlan === plan
                          ? "border-yellow-500 bg-yellow-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedPlan(plan)}
                    >
                      <h4 className="font-bold">{config.name}</h4>
                      <p className="text-2xl font-bold text-gray-600">€{config.price}/mese</p>
                      <ul className="mt-2 space-y-1">
                        {config.features.map((f, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-center gap-1">
                            <Check className="h-3 w-3 text-gray-400" /> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
              ⚠️ Verifica che il tuo utilizzo attuale (prodotti, clienti, canali) sia compatibile con i limiti del nuovo piano.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDowngradeModal(false); setSelectedPlan(null) }}>
                Annulla
              </Button>
              <Button variant="secondary" onClick={handleDowngrade} disabled={!selectedPlan || isProcessing}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Programma Downgrade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
