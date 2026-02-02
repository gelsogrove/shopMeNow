/**
 * SubscriptionSection - Current Plan & PayPal Connection
 * Shows the current subscription plan and PayPal connection status
 * Same PayPal UX as WorkspaceSelectionPage
 */
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CreditCard,
  Crown,
  AlertTriangle,
  Package,
  Check,
  Loader2,
  X,
} from "lucide-react"
import { toast } from "@/lib/toast"
import {
  getPayPalConnectUrl,
  getPayPalStatus,
  disconnectPayPal,
  getPayPalConfig,
  type PayPalStatusResponse,
  type PayPalConfigResponse,
} from "@/services/paypalApi"
import { getOwnerBillingOverview, BillingOverview } from "@/services/subscriptionBillingApi"
import { PLAN_CONFIGS } from "@/config/planFeatures"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"

interface SubscriptionSectionProps {
  onFieldFocus?: (fieldKey: string) => void
}

// Plan display names
const PLAN_DISPLAY: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  FREE_TRIAL: { label: "Free Trial", color: "bg-blue-100 text-blue-800", icon: <Package className="h-4 w-4" /> },
  BASIC: { label: "Basic", color: "bg-green-100 text-green-800", icon: <Package className="h-4 w-4" /> },
  PREMIUM: { label: "Premium", color: "bg-purple-100 text-purple-800", icon: <Crown className="h-4 w-4" /> },
  ENTERPRISE: { label: "Enterprise", color: "bg-amber-100 text-amber-800", icon: <Crown className="h-4 w-4" /> },
}

export function SubscriptionSection({ onFieldFocus }: SubscriptionSectionProps) {
  const { workspace } = useWorkspace()
  const { isSuperAdmin } = useWorkspaceRole(workspace?.id || "")

  // Billing state
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null)
  const [isLoadingBilling, setIsLoadingBilling] = useState(true)

  // PayPal state
  const [paypalStatus, setPaypalStatus] = useState<PayPalStatusResponse | null>(null)
  const [paypalConfig, setPaypalConfig] = useState<PayPalConfigResponse | null>(null)
  const [paypalLoading, setPaypalLoading] = useState(true)
  const [paypalConnecting, setPaypalConnecting] = useState(false)
  const [paypalDisconnecting, setPaypalDisconnecting] = useState(false)
  const [paypalConnectModalOpen, setPaypalConnectModalOpen] = useState(false)
  const [paypalDisconnectModalOpen, setPaypalDisconnectModalOpen] = useState(false)
  const [disconnectConfirmText, setDisconnectConfirmText] = useState("")

  // Load billing overview
  const loadBillingOverview = useCallback(async () => {
    try {
      setIsLoadingBilling(true)
      const data = await getOwnerBillingOverview()
      setBillingOverview(data)
    } catch (error) {
      console.error("Failed to load billing overview:", error)
    } finally {
      setIsLoadingBilling(false)
    }
  }, [])

  // Load PayPal status
  const loadPayPalStatus = useCallback(async () => {
    try {
      setPaypalLoading(true)
      const data = await getPayPalStatus()
      setPaypalStatus(data)
    } catch (error) {
      console.error("Failed to load PayPal status:", error)
      setPaypalStatus({ paypalStatus: "DISCONNECTED", isPaymentConnected: false })
    } finally {
      setPaypalLoading(false)
    }
  }, [])

  // Load PayPal config
  const loadPayPalConfig = useCallback(async () => {
    try {
      const data = await getPayPalConfig()
      setPaypalConfig(data)
    } catch (error) {
      console.error("Failed to load PayPal config:", error)
      setPaypalConfig(null)
    }
  }, [])

  useEffect(() => {
    loadBillingOverview()
    loadPayPalStatus()
    loadPayPalConfig()
  }, [loadBillingOverview, loadPayPalStatus, loadPayPalConfig])

  // PayPal handlers - same as WorkspaceSelectionPage
  const handlePayPalConnect = async () => {
    if (paypalConfig && !paypalConfig.configured) {
      toast.error("PayPal is not configured. Add sandbox/live credentials first.")
      return
    }
    setPaypalConnectModalOpen(true)
  }

  const confirmPayPalConnect = async () => {
    try {
      setPaypalConnecting(true)
      setPaypalConnectModalOpen(false)
      const url = await getPayPalConnectUrl()

      // Open PayPal in a popup
      const popup = window.open(
        url,
        "PayPal Connection",
        "width=600,height=800,left=100,top=100,resizable=yes,scrollbars=yes"
      )

      // Monitor when popup closes
      const checkPopupClosed = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(checkPopupClosed)
          console.info("PayPal popup closed, refreshing status...")
          loadPayPalStatus()
          loadPayPalConfig()
          setPaypalConnecting(false)
        }
      }, 500)

      // Fallback: if popup blocked
      if (!popup || popup.closed) {
        toast.error("Popup blocked! Please allow popups for this site.")
        setPaypalConnecting(false)
      }
    } catch (error) {
      console.error("Failed to start PayPal connect:", error)
      toast.error("Unable to start PayPal connection.")
      setPaypalConnecting(false)
    }
  }

  const handlePayPalDisconnect = async () => {
    setPaypalDisconnectModalOpen(true)
  }

  const confirmPayPalDisconnect = async () => {
    if (disconnectConfirmText !== "DISCONNECT") {
      toast.error("Please type DISCONNECT to confirm")
      return
    }

    try {
      setPaypalDisconnecting(true)
      await disconnectPayPal()
      toast.success("PayPal disconnected.")
      setPaypalDisconnectModalOpen(false)
      setDisconnectConfirmText("")
      await loadPayPalStatus()
      await loadPayPalConfig()
    } catch (error) {
      console.error("Failed to disconnect PayPal:", error)
      toast.error("Unable to disconnect PayPal.")
    } finally {
      setPaypalDisconnecting(false)
    }
  }

  // Derived values
  const planType = billingOverview?.billing?.planType || workspace?.planType || "FREE_TRIAL"
  const planInfo = PLAN_DISPLAY[planType] || PLAN_DISPLAY.FREE_TRIAL
  const isPaymentConnected =
    paypalStatus?.isPaymentConnected ?? paypalStatus?.paypalStatus === "CONNECTED"
  const requiresPayment = planType !== "FREE_TRIAL"
  const showPayPalWarning = requiresPayment && !paypalLoading && !isPaymentConnected
  
  // Calculate days left in trial
  const getTrialDaysLeft = (): number | null => {
    if (!billingOverview?.billing?.trialEndsAt) return null
    const trialEndDate = new Date(billingOverview.billing.trialEndsAt)
    const today = new Date()
    const daysLeft = Math.ceil((trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, daysLeft)
  }
  
  const trialDaysLeft = getTrialDaysLeft()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-indigo-600" />
          Subscription
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your subscription plan and payment method
        </p>
      </div>

      {/* Current Plan Card */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-white">
          <CardTitle className="text-base font-semibold">Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoadingBilling ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${planInfo.color}`}>
                  {planInfo.icon}
                  <span className="font-semibold">{planInfo.label}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {billingOverview?.billing?.trialEndsAt && (
                    <>
                      <span className="text-sm font-semibold text-gray-900">
                        {trialDaysLeft !== null ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left` : 'Trial active'}
                      </span>
                      <span className="text-xs text-gray-500">
                        Ends: {new Date(billingOverview.billing.trialEndsAt).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  // Navigate to home and open change plan dialog
                  window.location.href = "/#billing-section"
                  // Trigger the change plan dialog via localStorage flag
                  localStorage.setItem("openChangePlanDialog", "true")
                }}
              >
                Manage Plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PayPal Warning */}
      {showPayPalWarning && (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-400">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">PayPal Connection Required</p>
            <p className="text-sm text-red-700 mt-0.5">
              You must connect PayPal to add new channels or invite team members.
            </p>
          </div>
        </div>
      )}

      {/* PayPal Connection Card */}
      {isSuperAdmin && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <img src="/paypal.png" alt="PayPal" className="w-9 h-auto object-contain" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">PayPal Account</CardTitle>
                    {paypalStatus?.paypalStatus === "CONNECTED" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <CardDescription className="text-blue-700">
                    {paypalStatus?.paypalStatus === "CONNECTED"
                      ? "Your PayPal account is connected and ready to receive monthly payouts."
                      : "Connect your PayPal account to receive monthly payouts."}
                  </CardDescription>
                </div>
              </div>
              {paypalLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              ) : paypalStatus?.paypalStatus === "CONNECTED" ? (
                <Button
                  variant="outline"
                  onClick={handlePayPalDisconnect}
                  disabled={paypalDisconnecting}
                >
                  {paypalDisconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              ) : (
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handlePayPalConnect}
                  disabled={paypalConnecting || paypalConfig?.configured === false}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {paypalConnecting ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>
          </CardHeader>
          {(paypalLoading || paypalConfig?.configured === false) && (
            <CardContent className="pt-2">
              {paypalLoading ? (
                <p className="text-sm text-gray-500">Loading PayPal status...</p>
              ) : paypalConfig?.configured === false ? (
                <div className="rounded-lg bg-yellow-50 px-3 py-2 text-yellow-800">
                  PayPal is not configured. Add sandbox/live credentials to enable Connect.
                </div>
              ) : null}
            </CardContent>
          )}
        </Card>
      )}

      {/* PayPal Connect Modal */}
      <Dialog open={paypalConnectModalOpen} onOpenChange={setPaypalConnectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect PayPal Account</DialogTitle>
            <DialogDescription>
              You will be redirected to PayPal's secure login page.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-2">You will be redirected to PayPal</p>
                <p>Click OK to connect your PayPal account. After connecting, you'll be returned automatically.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaypalConnectModalOpen(false)}
              disabled={paypalConnecting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmPayPalConnect}
              disabled={paypalConnecting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {paypalConnecting ? "Connecting..." : "OK - Proceed to PayPal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PayPal Disconnect Modal */}
      <Dialog open={paypalDisconnectModalOpen} onOpenChange={setPaypalDisconnectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Disconnect PayPal
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect your PayPal account? You won't be able to receive payouts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="disconnectConfirm">
                Type <span className="font-mono font-bold">DISCONNECT</span> to confirm
              </Label>
              <Input
                id="disconnectConfirm"
                value={disconnectConfirmText}
                onChange={(e) => setDisconnectConfirmText(e.target.value)}
                placeholder="DISCONNECT"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPaypalDisconnectModalOpen(false)
                setDisconnectConfirmText("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmPayPalDisconnect}
              disabled={disconnectConfirmText !== "DISCONNECT" || paypalDisconnecting}
            >
              {paypalDisconnecting ? "Disconnecting..." : "Disconnect PayPal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
