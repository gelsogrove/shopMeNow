/**
 * WhatsAppChannelSection - WhatsApp Configuration
 * Separate from Widget - cleaner organization
 */
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Smartphone, Copy, AlertCircle } from "lucide-react"
import { toast } from "@/lib/toast"
import { WasenderOnboarding } from "@/components/WasenderOnboarding"

interface WhatsAppChannelSectionProps {
  formData: {
    enableWhatsapp: boolean
    whatsappPhoneNumber: string
    whatsappApiKey: string
    whatsappAppName: string
    whatsappAppSecret: string
    whatsappPhoneNumberId: string
    whatsappVerifyToken: string
    whatsappBusinessAccountId: string
    whatsappWebhookId?: string
    whatsappWebhookUrl?: string
    whatsappProvider?: string
    ultraMsgInstanceId?: string
    ultraMsgToken?: string
    ultraMsgApiUrl?: string
  }
  enableWidget?: boolean
  errors: Record<string, string>
  canEdit: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
}

// ALWAYS use production domain for webhook URLs
const WEBHOOK_BASE = "https://www.echatbot.ai"

export function WhatsAppChannelSection({
  formData,
  enableWidget,
  errors,
  canEdit,
  onFieldChange,
  onFieldFocus,
}: WhatsAppChannelSectionProps) {
  const currentProvider = formData.whatsappProvider || "meta"
  
  // Use only the webhookId from formData - no fallback to workspaceId
  const webhookId = formData.whatsappWebhookId || ""
  
  const metaWebhookUrl =
    formData.whatsappWebhookUrl ||
    `${WEBHOOK_BASE.replace(/\/$/, "")}/api/v1/whatsapp/webhook/${webhookId}`
  
  const ultraMsgWebhookUrl = webhookId
    ? `${WEBHOOK_BASE.replace(/\/$/, "")}/api/v1/whatsapp/ultramsg/${webhookId}`
    : ""

  const webhookDisplayUrl = currentProvider === "ultramsg" ? ultraMsgWebhookUrl : metaWebhookUrl

  const handleCopy = async (text?: string) => {
    if (!text) {
      toast.error("Nothing to copy")
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied to clipboard")
    } catch (err) {
      toast.error("Copy failed")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Smartphone className="h-6 w-6 text-emerald-600" />
          WhatsApp Channel
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure your WhatsApp Business API connection
        </p>
      </div>


      {/* Enable WhatsApp */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-600" />
              WhatsApp Status
            </CardTitle>
            <Switch
              checked={formData.enableWhatsapp}
              onCheckedChange={(checked) => onFieldChange("enableWhatsapp", checked)}
              disabled={!canEdit}
            />
          </div>
        </CardHeader>
        {/* Same pattern as Human Support: when the master toggle is off the
            card body collapses entirely instead of showing a placeholder. */}
        {formData.enableWhatsapp && (
        <CardContent className="pt-6 space-y-4">
          {/* ⚠️ Widget Warning */}
          {enableWidget && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-700">
                Web Widget is active. WhatsApp configuration is optional for informational workspaces.
              </AlertDescription>
            </Alert>
          )}

            <div className="space-y-4">
            {/* Provider Selection */}
            <div className="space-y-3">
              <Label>WhatsApp Provider</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => onFieldChange("whatsappProvider", "meta")}
                  disabled={!canEdit}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    currentProvider === "meta"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  } ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="font-semibold">Meta Business API</div>
                  <div className="text-xs text-gray-500 mt-1">Official WhatsApp API</div>
                </button>
                <button
                  type="button"
                  onClick={() => onFieldChange("whatsappProvider", "ultramsg")}
                  disabled={!canEdit}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    currentProvider === "ultramsg"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  } ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="font-semibold">UltraMsg</div>
                  <div className="text-xs text-gray-500 mt-1">Alternative provider</div>
                </button>
                <button
                  type="button"
                  onClick={() => onFieldChange("whatsappProvider", "wasender")}
                  disabled={!canEdit}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    currentProvider === "wasender"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  } ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="font-semibold">WasenderAPI</div>
                  <div className="text-xs text-gray-500 mt-1">Cost-effective QR</div>
                </button>
              </div>
            </div>

            {/* WasenderAPI Provider Section */}
            {currentProvider === "wasender" && (
              <Card className="border-emerald-200 bg-emerald-50">
                <CardContent className="pt-6">
                  <WasenderOnboarding onComplete={async () => {
                    toast.success('WhatsApp connected via WasenderAPI!');
                  }} />
                </CardContent>
              </Card>
            )}

            {/* Shared Field: Phone Number (Meta/UltraMsg only) */}
            {currentProvider !== "wasender" && (
              <div
                className="space-y-2"
                onFocus={() => onFieldFocus?.("whatsappPhoneNumber")}
                data-focus-key="whatsappAccess"
              >
                <Label htmlFor="whatsappPhoneNumber">Phone Number</Label>
                <Input
                  id="whatsappPhoneNumber"
                  value={formData.whatsappPhoneNumber}
                  onChange={(e) => onFieldChange("whatsappPhoneNumber", e.target.value)}
                  placeholder="+1234567890"
                  disabled={!canEdit}
                />
              </div>
            )}

            {/* Meta Provider Fields */}
            {currentProvider === "meta" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="whatsappAppName">App Name</Label>
                  <Input
                    id="whatsappAppName"
                    value={formData.whatsappAppName}
                    onChange={(e) => onFieldChange("whatsappAppName", e.target.value)}
                    placeholder="Meta app name"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-gray-500">
                    The name of your app in Meta for Developers. Used for reference only.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsappAppSecret">App Secret</Label>
                  <Input
                    id="whatsappAppSecret"
                    type="password"
                    value={formData.whatsappAppSecret}
                    onChange={(e) => onFieldChange("whatsappAppSecret", e.target.value)}
                    placeholder="Meta app secret"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-gray-500">
                    Meta for Developers → your app → App settings → Basic → App secret.
                    Used to verify that incoming messages really come from Meta.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsappApiKey">Access Token</Label>
                  <Input
                    id="whatsappApiKey"
                    type="password"
                    value={formData.whatsappApiKey}
                    onChange={(e) => onFieldChange("whatsappApiKey", e.target.value)}
                    placeholder="Paste access token"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-gray-500">
                    Meta for Developers → your app → WhatsApp → API Setup. Use a permanent
                    token: temporary ones expire after 24 hours and replies stop working.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsappPhoneNumberId">Phone Number ID</Label>
                  <Input
                    id="whatsappPhoneNumberId"
                    value={formData.whatsappPhoneNumberId}
                    onChange={(e) => onFieldChange("whatsappPhoneNumberId", e.target.value)}
                    placeholder="123456789012345"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-gray-500">
                    WhatsApp → API Setup, shown under your phone number. This is an ID, not
                    the phone number itself.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsappBusinessAccountId">WhatsApp Business Account ID</Label>
                  <Input
                    id="whatsappBusinessAccountId"
                    value={formData.whatsappBusinessAccountId}
                    onChange={(e) => onFieldChange("whatsappBusinessAccountId", e.target.value)}
                    placeholder="123456789012345"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-gray-500">
                    WhatsApp → API Setup, listed as "WhatsApp Business Account ID". Identifies
                    the business account the number belongs to.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsappVerifyToken">Verify Token</Label>
                  <Input
                    id="whatsappVerifyToken"
                    value={formData.whatsappVerifyToken}
                    onChange={(e) => onFieldChange("whatsappVerifyToken", e.target.value)}
                    placeholder="mySecureToken123"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-gray-500">
                    A password you invent yourself. Enter the same value here and in Meta's
                    webhook setup — Meta uses it to confirm the webhook is really yours.
                  </p>
                </div>
              </>
            )}

            {/* UltraMsg Provider Fields */}
            {currentProvider === "ultramsg" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ultraMsgApiUrl">API URL</Label>
                  <Input
                    id="ultraMsgApiUrl"
                    value={formData.ultraMsgApiUrl || ""}
                    onChange={(e) => onFieldChange("ultraMsgApiUrl", e.target.value)}
                    placeholder="https://api.ultramsg.com/instance12345/"
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ultraMsgInstanceId">Instance ID</Label>
                  <Input
                    id="ultraMsgInstanceId"
                    value={formData.ultraMsgInstanceId || ""}
                    onChange={(e) => onFieldChange("ultraMsgInstanceId", e.target.value)}
                    placeholder="instance12345"
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ultraMsgToken">API Token</Label>
                  <Input
                    id="ultraMsgToken"
                    type="password"
                    value={formData.ultraMsgToken || ""}
                    onChange={(e) => onFieldChange("ultraMsgToken", e.target.value)}
                    placeholder="Paste UltraMsg API token"
                    disabled={!canEdit}
                  />
                </div>

                {/* Webhook ID - HIDDEN (internal use only) */}
              </>
            )}

            {/* Webhook URL - Meta/UltraMsg only (Wasender uses its own webhook URL) */}
            {currentProvider !== "wasender" && <div className="space-y-2">
              <Label>Callback URL</Label>
              <div className="flex gap-2 items-center">
                <code className="flex-1 rounded border bg-slate-50 px-2 py-2 text-xs font-mono overflow-x-auto">
                  {webhookDisplayUrl || "Not generated - save WhatsApp settings first"}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCopy(webhookDisplayUrl)}
                  disabled={!webhookDisplayUrl}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
            </div>}

            </div>
        </CardContent>
        )}
      </Card>
    </div>
  )
}
