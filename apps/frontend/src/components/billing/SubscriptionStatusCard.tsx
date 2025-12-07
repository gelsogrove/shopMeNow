/**
 * Subscription Status Card Component
 * Feature 197: Billing Subscription Separation
 *
 * Displays:
 * - Current subscription status (ACTIVE, PAUSED, PAYMENT_FAILED, etc.)
 * - Pause/Resume buttons
 * - Pending downgrade banner
 * - Next billing date
 *
 * SECURITY: Pause/Resume only visible to SUPER_ADMIN (Owner)
 */

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import {
  getSubscriptionStatus,
  pauseSubscription,
  resumeSubscription,
  cancelPendingPlanChange,
  SubscriptionStatusResponse,
  getSubscriptionStatusInfo,
} from "@/services/subscriptionBillingApi"
import { toast } from "@/lib/toast"
import {
  Play,
  Pause,
  AlertTriangle,
  CreditCard,
  Calendar,
  Loader2,
  X,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react"

// ============================================================================
// TYPES
// ============================================================================

interface SubscriptionStatusCardProps {
  workspaceId: string
  onStatusChange?: () => void
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SubscriptionStatusCard({
  workspaceId,
  onStatusChange,
}: SubscriptionStatusCardProps) {
  const { isSuperAdmin } = useWorkspaceRole(workspaceId)

  // State
  const [status, setStatus] = useState<SubscriptionStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPausing, setIsPausing] = useState(false)
  const [isResuming, setIsResuming] = useState(false)
  const [isCancellingPending, setIsCancellingPending] = useState(false)
  const [showPauseConfirmDialog, setShowPauseConfirmDialog] = useState(false)

  // Load subscription status
  const loadStatus = async () => {
    if (!workspaceId) return

    try {
      setIsLoading(true)
      const data = await getSubscriptionStatus(workspaceId)
      setStatus(data)
    } catch (error) {
      console.error("Failed to load subscription status:", error)
      toast.error("Errore caricamento stato abbonamento")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [workspaceId])

  // Handle pause subscription
  const handlePause = async () => {
    if (!workspaceId) return

    try {
      setIsPausing(true)
      const result = await pauseSubscription(workspaceId)
      toast.success(`Pausa programmata per il ${new Date(result.effectiveDate).toLocaleDateString("it-IT")}`)
      setShowPauseConfirmDialog(false)
      await loadStatus()
      onStatusChange?.()
    } catch (error: any) {
      const message = error.response?.data?.error || "Errore durante la pausa"
      toast.error(message)
    } finally {
      setIsPausing(false)
    }
  }

  // Handle resume subscription
  const handleResume = async () => {
    if (!workspaceId) return

    try {
      setIsResuming(true)
      await resumeSubscription(workspaceId)
      toast.success("Abbonamento riattivato!")
      await loadStatus()
      onStatusChange?.()
    } catch (error: any) {
      const message = error.response?.data?.error || "Errore durante la riattivazione"
      toast.error(message)
    } finally {
      setIsResuming(false)
    }
  }

  // Handle cancel pending plan change
  const handleCancelPending = async () => {
    if (!workspaceId) return

    try {
      setIsCancellingPending(true)
      await cancelPendingPlanChange(workspaceId)
      toast.success("Downgrade annullato")
      await loadStatus()
      onStatusChange?.()
    } catch (error: any) {
      const message = error.response?.data?.error || "Errore durante l'annullamento"
      toast.error(message)
    } finally {
      setIsCancellingPending(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!status) {
    return null
  }

  const statusInfo = getSubscriptionStatusInfo(status.subscriptionStatus)
  const isBlocked = status.isBlocked
  const hasPendingDowngrade = status.pendingPlanType !== null

  return (
    <>
      <Card className={isBlocked ? "border-red-500" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Stato Abbonamento
            </CardTitle>
            <Badge
              variant={
                status.subscriptionStatus === "ACTIVE"
                  ? "default"
                  : status.subscriptionStatus === "PAYMENT_FAILED"
                    ? "destructive"
                    : "secondary"
              }
              className="gap-1"
            >
              {statusInfo.icon} {statusInfo.label}
            </Badge>
          </div>
          <CardDescription>
            Piano: {status.planType}
            {status.nextBillingDate && (
              <span className="ml-2">
                • Prossimo rinnovo:{" "}
                {new Date(status.nextBillingDate).toLocaleDateString("it-IT")}
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Block Warning */}
          {isBlocked && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Servizio Bloccato</AlertTitle>
              <AlertDescription>
                {status.blockReason === "PAUSED" && (
                  "L'abbonamento è in pausa. Il chatbot non risponde ai clienti."
                )}
                {status.blockReason === "PAYMENT_FAILED" && (
                  "Pagamento fallito. Aggiorna il metodo di pagamento per ripristinare il servizio."
                )}
                {status.blockReason === "CREDIT_EXHAUSTED" && (
                  `Credito esaurito (€${status.creditBalance.toFixed(2)}). Ricarica per continuare.`
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Pending Downgrade Banner */}
          {hasPendingDowngrade && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Cambio Piano Programmato</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>
                  Dal{" "}
                  {status.pendingPlanEffectiveDate
                    ? new Date(status.pendingPlanEffectiveDate).toLocaleDateString("it-IT")
                    : "-"}{" "}
                  passerai al piano {status.pendingPlanType}
                </span>
                {isSuperAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelPending}
                    disabled={isCancellingPending}
                  >
                    {isCancellingPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Annulla
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Payment Failed Actions */}
          {status.subscriptionStatus === "PAYMENT_FAILED" && isSuperAdmin && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  // TODO: Open payment update dialog
                  toast.info("Funzionalità in arrivo: aggiorna metodo di pagamento")
                }}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Aggiorna Pagamento
              </Button>
            </div>
          )}

          {/* Pause/Resume Actions */}
          {isSuperAdmin && status.subscriptionStatus !== "PAYMENT_FAILED" && (
            <div className="flex gap-2">
              {status.subscriptionStatus === "ACTIVE" && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPauseConfirmDialog(true)}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Metti in Pausa
                </Button>
              )}

              {(status.subscriptionStatus === "PAUSED" ||
                status.subscriptionStatus === "PAUSE_PENDING") && (
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleResume}
                  disabled={isResuming}
                >
                  {isResuming ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Riattiva Abbonamento
                </Button>
              )}
            </div>
          )}

          {/* Status Details */}
          <div className="text-xs text-muted-foreground space-y-1">
            {status.pausedAt && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                In pausa dal: {new Date(status.pausedAt).toLocaleDateString("it-IT")}
              </div>
            )}
            {status.pauseRequestedAt && status.subscriptionStatus === "PAUSE_PENDING" && (
              <div className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                Pausa richiesta il: {new Date(status.pauseRequestedAt).toLocaleDateString("it-IT")}
              </div>
            )}
            {status.lastPaymentFailedAt && (
              <div className="flex items-center gap-1 text-red-600">
                <XCircle className="h-3 w-3" />
                Ultimo pagamento fallito: {new Date(status.lastPaymentFailedAt).toLocaleDateString("it-IT")}
                {status.paymentFailureCount > 0 && (
                  <span>({status.paymentFailureCount} tentativi)</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pause Confirmation Dialog */}
      <Dialog open={showPauseConfirmDialog} onOpenChange={setShowPauseConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Conferma Pausa Abbonamento
            </DialogTitle>
            <DialogDescription>
              Mettendo in pausa l'abbonamento:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <span>Il chatbot <strong>NON risponderà</strong> più ai clienti</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Non ti verrà addebitato nulla dal prossimo mese</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <span>I tuoi dati (prodotti, clienti, ordini) saranno <strong>conservati</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Potrai riattivare quando vuoi</span>
            </div>
          </div>

          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm">
              <strong>La pausa sarà effettiva dal:</strong>{" "}
              {new Date(
                new Date().getFullYear(),
                new Date().getMonth() + 1,
                1
              ).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPauseConfirmDialog(false)}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handlePause}
              disabled={isPausing}
            >
              {isPausing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Pause className="h-4 w-4 mr-2" />
              )}
              Conferma Pausa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
