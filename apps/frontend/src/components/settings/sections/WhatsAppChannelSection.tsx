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
import { Smartphone, Copy } from "lucide-react"
import { toast } from "@/lib/toast"

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
  }
  errors: Record<string, string>
  canEdit: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
}

const WEBHOOK_BASE =
  import.meta.env.VITE_PUBLIC_WEBHOOK_BASE ||
  (typeof window !== "undefined" ? window.location.origin : "https://echatbot.ai")

export function WhatsAppChannelSection({
  formData,
  errors,
  canEdit,
  onFieldChange,
  onFieldFocus,
}: WhatsAppChannelSectionProps) {
  const webhookDisplayUrl =
    formData.whatsappWebhookUrl ||
    `${WEBHOOK_BASE.replace(/\/$/, "")}/api/v1/whatsapp/webhook/${formData.whatsappWebhookId || ""}`

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
        <CardContent className="pt-6">
          {!formData.enableWhatsapp ? (
            <div className="text-center py-8 text-gray-500">
              <Smartphone className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">WhatsApp Channel is disabled</p>
              <p className="text-sm">Enable the toggle above to configure WhatsApp settings</p>
            </div>
          ) : (
            <>
            <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsappAppName">app name</Label>
              <Input
                id="whatsappAppName"
                value={formData.whatsappAppName}
                onChange={(e) => onFieldChange("whatsappAppName", e.target.value)}
                placeholder="Meta app name"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappApiKey">token</Label>
              <Input
                id="whatsappApiKey"
                type="password"
                value={formData.whatsappApiKey}
                onChange={(e) => onFieldChange("whatsappApiKey", e.target.value)}
                placeholder="Paste token"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappPhoneNumberId">Phone number ID:</Label>
              <Input
                id="whatsappPhoneNumberId"
                value={formData.whatsappPhoneNumberId}
                onChange={(e) => onFieldChange("whatsappPhoneNumberId", e.target.value)}
                placeholder="123456789012345"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappBusinessAccountId">WhatsApp Business Account</Label>
              <Input
                id="whatsappBusinessAccountId"
                value={formData.whatsappBusinessAccountId}
                onChange={(e) => onFieldChange("whatsappBusinessAccountId", e.target.value)}
                placeholder="123456789012345"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label>webhook</Label>
              <div className="flex gap-2 items-center">
                <code className="flex-1 rounded border bg-slate-50 px-2 py-2 text-xs font-mono overflow-x-auto">
                  {webhookDisplayUrl || "Not generated"}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappVerifyToken">Verify token</Label>
              <Input
                id="whatsappVerifyToken"
                value={formData.whatsappVerifyToken}
                onChange={(e) => onFieldChange("whatsappVerifyToken", e.target.value)}
                placeholder="mySecureToken123"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappAppSecret">App Secret (Meta App)</Label>
              <Input
                id="whatsappAppSecret"
                type="password"
                value={formData.whatsappAppSecret}
                onChange={(e) => onFieldChange("whatsappAppSecret", e.target.value)}
                placeholder="Enter App Secret"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-500">
                Used to verify webhook signature (per channel).
              </p>
            </div>

            <div
              className="space-y-2"
              onFocus={() => onFieldFocus?.("whatsappPhoneNumber")}
            >
              <Label htmlFor="whatsappPhoneNumber">Phone Number (fallback)</Label>
              <Input
                id="whatsappPhoneNumber"
                value={formData.whatsappPhoneNumber}
                onChange={(e) => onFieldChange("whatsappPhoneNumber", e.target.value)}
                placeholder="+1234567890"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-500">
                Used only if Phone Number ID is missing.
              </p>
            </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
