/**
 * TermsConditionsSection - Editable Terms & Conditions text for the workspace
 * (workspace.termsAndConditions). Free text, no {{variables}} processing.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText } from "lucide-react"
import Editor from "@monaco-editor/react"

interface TermsConditionsSectionProps {
  formData: {
    termsAndConditions: string
  }
  canEdit: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
}

export function TermsConditionsSection({ formData, canEdit, onFieldChange, onFieldFocus }: TermsConditionsSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <FileText className="h-6 w-6 text-violet-600" />
          Terms & Conditions
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Terms & Conditions text for this workspace.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-white">
          <CardTitle className="text-base font-semibold">Terms & Conditions Text</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div
            className="border rounded-md overflow-hidden"
            onFocus={() => onFieldFocus?.("termsAndConditions")}
          >
            <Editor
              height="360px"
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
    </div>
  )
}
