/**
 * SecuritySection - Security & Access Control
 * Fields: allowedExternalLinks
 * NOTE: Human Support has been moved to WidgetSupportSection
 * NOTE: Delete Workspace (Danger Zone) has moved to BusinessConfigSection (Preferences)
 */
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield } from "lucide-react"

interface SecuritySectionProps {
  formData: {
    allowedExternalLinks: string
  }
  errors: Record<string, string>
  canEdit: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
}

export function SecuritySection({
  formData,
  errors,
  canEdit,
  onFieldChange,
  onFieldFocus,
}: SecuritySectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="h-6 w-6 text-red-600" />
          Security
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Control access permissions and external link restrictions
        </p>
      </div>

      {/* Security Settings */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-red-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-600" />
            Security Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2" onFocus={() => onFieldFocus?.("allowedDomains")}>
            <Label htmlFor="allowedExternalLinks">Allowed External Domains</Label>
            <Textarea
              id="allowedExternalLinks"
              value={formData.allowedExternalLinks}
              onChange={(e) => onFieldChange("allowedExternalLinks", e.target.value)}
              placeholder="example.com, trusted-site.com, docs.google.com, stripe.com"
              disabled={!canEdit}
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
