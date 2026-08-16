/**
 * OtherSection - Miscellaneous workspace settings
 * Fields: allowedExternalLinks (Security), termsAndConditions (Terms & Conditions), wipMessage (Maintenance)
 *
 * Card standard (same across every Settings section):
 *   CardHeader  -> gradient background + colored icon + title + subtitle
 *   CardContent -> field(s), each with a plain-language helper line underneath
 */
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Shield, FileText, Clock } from "lucide-react"

interface OtherSectionProps {
  formData: {
    customChatbotId: string
    allowedExternalLinks: string
    securityBlockedMessage: string
    termsAndConditions: string
    wipMessage: string
  }
  errors: Record<string, string>
  canEdit: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
}

export function OtherSection({
  formData,
  canEdit,
  onFieldChange,
  onFieldFocus,
}: OtherSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="h-6 w-6 text-gray-600" />
          Other
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Security, legal text, and maintenance message
        </p>
      </div>

      {/* Custom Chatbot Module — which code module answers on this channel */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Custom Chatbot Module
          </CardTitle>
          <p className="text-sm text-gray-500">
            Which chatbot module handles conversations on this channel
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-2" onFocus={() => onFieldFocus?.("customChatbotId")}>
            <Label htmlFor="customChatbotId">Custom Chatbot ID</Label>
            <Input
              id="customChatbotId"
              value={formData.customChatbotId}
              onChange={(e) => onFieldChange("customChatbotId", e.target.value)}
              placeholder="e.g. demowash"
              disabled={!canEdit}
            />
            <p className="text-xs text-gray-500">
              Name of the custom module that answers on this channel (e.g.{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">demowash</code>).
              Leave empty to use the standard AI agents.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-red-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-600" />
            Security
          </CardTitle>
          <p className="text-sm text-gray-500">
            Restrict which websites the chatbot is allowed to link to
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-2" onFocus={() => onFieldFocus?.("allowedDomains")}>
            <Label htmlFor="allowedExternalLinks">Allowed External Domains</Label>
            <Textarea
              id="allowedExternalLinks"
              value={formData.allowedExternalLinks}
              onChange={(e) => onFieldChange("allowedExternalLinks", e.target.value)}
              placeholder="example.com, trusted-site.com, docs.google.com, stripe.com"
              disabled={!canEdit}
              className="min-h-[90px]"
            />
            <p className="text-xs text-gray-500">
              One domain per line or comma-separated. Links to any other site are blocked
              before the message reaches the customer. Leave empty to block ALL external
              links (internal echatbot.ai links always work).
            </p>
          </div>
          <div
            className="space-y-2 mt-6"
            onFocus={() => onFieldFocus?.("securityBlockedMessage")}
            data-focus-key="securityBlockedMessage"
          >
            <Label htmlFor="securityBlockedMessage">Blocked-Reply Courtesy Message</Label>
            <Textarea
              id="securityBlockedMessage"
              value={formData.securityBlockedMessage}
              onChange={(e) => onFieldChange("securityBlockedMessage", e.target.value)}
              placeholder="Sorry, I can't help with that request. Please contact our support team."
              disabled={!canEdit}
              className="min-h-[90px]"
            />
            <p className="text-xs text-gray-500">
              Sent to the customer when the security check blocks a reply. Leave empty to
              send nothing (the customer sees no response for that message).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            Terms & Conditions
          </CardTitle>
          <p className="text-sm text-gray-500">
            The terms customers are asked to accept before chatting
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-2" onFocus={() => onFieldFocus?.("termsAndConditions")}>
            <Label htmlFor="termsAndConditions">Terms & Conditions Text</Label>
            <Textarea
              id="termsAndConditions"
              value={formData.termsAndConditions}
              onChange={(e) => onFieldChange("termsAndConditions", e.target.value)}
              placeholder="By accepting you allow us to message you on WhatsApp for support, notifications, and offers. You can revoke anytime by replying STOP."
              disabled={!canEdit}
              className="min-h-[160px]"
            />
            <p className="text-xs text-gray-500">
              Shown to new customers on first contact. Keep it short — customers read this
              inside a chat bubble.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* WIP / Maintenance Message */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Maintenance
          </CardTitle>
          <p className="text-sm text-gray-500">
            The reply customers get while the channel is switched off
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div
            className="space-y-2"
            onFocus={() => onFieldFocus?.("maintenanceMessage")}
            data-focus-key="maintenanceMessage"
          >
            <Label htmlFor="wipMessage">Maintenance Message</Label>
            <Textarea
              id="wipMessage"
              value={formData.wipMessage}
              onChange={(e) => onFieldChange("wipMessage", e.target.value)}
              placeholder="⚠️ We're currently doing some maintenance. Please try again later."
              disabled={!canEdit}
              className="min-h-[120px]"
            />
            <p className="text-xs text-gray-500">
              Sent instead of AI replies when the channel is set to Inactive in
              Preferences. Include an email or phone number for urgent cases.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
