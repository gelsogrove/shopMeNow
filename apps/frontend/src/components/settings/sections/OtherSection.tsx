/**
 * OtherSection - Miscellaneous workspace settings
 * Fields: allowedExternalLinks (Security), termsAndConditions (Terms & Conditions), wipMessage (Maintenance)
 *
 * Card standard (same across every Settings section):
 *   CardHeader  -> gradient background + colored icon + title + subtitle
 *   CardContent -> field(s), each with a plain-language helper line underneath
 */
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, FileText, Clock } from "lucide-react"

interface OtherSectionProps {
  formData: {
    allowedExternalLinks: string
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
              before the message reaches the customer. Leave empty to allow all links.
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
