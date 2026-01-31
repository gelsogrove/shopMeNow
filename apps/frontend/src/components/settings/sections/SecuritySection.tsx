/**
 * SecuritySection - Security & Access Control
 * Fields: allowedExternalLinks, dangerZone (delete workspace)
 * NOTE: Human Support has been moved to WidgetSupportSection
 */
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Trash2, Loader2, Link2, AlertTriangle } from "lucide-react"

interface SecuritySectionProps {
  formData: {
    allowedExternalLinks: string
  }
  errors: Record<string, string>
  canEdit: boolean
  isSuperAdmin: boolean
  isDeleting: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
  onDeleteWorkspace: () => void
}

export function SecuritySection({
  formData,
  errors,
  canEdit,
  isSuperAdmin,
  isDeleting,
  onFieldChange,
  onFieldFocus,
  onDeleteWorkspace,
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

          {/* Danger Zone - Delete Workspace (Super Admin only) */}
          {isSuperAdmin && (
            <div className="border-t pt-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-red-900">Danger Zone</p>
                    <p className="text-xs text-red-700 mt-1">
                      Delete this workspace and all data. Recoverable within 90 days.
                    </p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-100 hover:text-red-700"
                    size="sm"
                    onClick={onDeleteWorkspace}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Workspace
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
