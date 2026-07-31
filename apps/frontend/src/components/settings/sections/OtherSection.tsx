/**
 * OtherSection - Miscellaneous workspace settings
 * Fields: allowedExternalLinks (Security), termsAndConditions (Terms & Conditions), wipMessage (Maintenance)
 */
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, FileText, Clock } from "lucide-react"
import Editor from "@monaco-editor/react"

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
  errors,
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

      {/* Terms & Conditions */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            Terms & Conditions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div
            className="border rounded-md overflow-hidden"
            onFocus={() => onFieldFocus?.("termsAndConditions")}
          >
            <Editor
              height="240px"
              defaultLanguage="markdown"
              theme="vs-light"
              value={formData.termsAndConditions}
              onChange={(value) => onFieldChange("termsAndConditions", value || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                folding: true,
                renderLineHighlight: "all",
                tabSize: 2,
                padding: { top: 8, bottom: 8 },
                readOnly: !canEdit,
              }}
            />
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
        </CardHeader>
        <CardContent className="pt-6">
          <div
            className="space-y-2"
            onFocus={() => onFieldFocus?.("maintenanceMessage")}
            data-focus-key="maintenanceMessage"
          >
            <Label htmlFor="wipMessage">Maintenance Message</Label>
            <div className="border rounded-md overflow-hidden">
              <Editor
                height="200px"
                defaultLanguage="markdown"
                theme="vs-light"
                value={formData.wipMessage}
                onChange={(value) => onFieldChange("wipMessage", value || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  folding: true,
                  renderLineHighlight: "all",
                  tabSize: 2,
                  padding: { top: 8, bottom: 8 },
                  readOnly: !canEdit,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
