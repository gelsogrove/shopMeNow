/**
 * SystemPromptSection - Editable main/system prompt for custom chatbot
 * workspaces (workspace.customChatbotSystemPrompt).
 *
 * Processed with {{variables}} by PromptProcessorService at runtime — see
 * CustomClientChatbotService.buildCustomChatbotSystemPrompt(). Empty means
 * the module falls back to its own static prompt file (e.g. common.md).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText } from "lucide-react"
import Editor from "@monaco-editor/react"

interface SystemPromptSectionProps {
  formData: {
    customChatbotSystemPrompt: string
  }
  canEdit: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
}

const AVAILABLE_VARIABLES: Array<{ name: string; description: string }> = [
  { name: "{{companyName}}", description: "Workspace name" },
  { name: "{{chatbotName}}", description: "Custom chatbot display name" },
  { name: "{{welcomeMessage}}", description: "Welcome message (Business Config)" },
  { name: "{{faqs}}", description: "All active FAQs, formatted as Q/A pairs" },
  { name: "{{humanSupportInstructions}}", description: "Human support instructions (Human Support)" },
  { name: "{{operatorContactMethod}}", description: "email or whatsapp" },
  { name: "{{operatorWhatsappNumber}}", description: "Operator WhatsApp number" },
  { name: "{{toneOfVoice}}", description: "friendly / formal / professional / casual" },
  { name: "{{address}}", description: "Business physical address" },
  { name: "{{allowedExternalLinks}}", description: "Domains the bot may link to" },
]

export function SystemPromptSection({ formData, canEdit, onFieldChange, onFieldFocus }: SystemPromptSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <FileText className="h-6 w-6 text-violet-600" />
          Main Prompt
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          The fixed system prompt this chatbot reads on every turn. Leave empty to use the module's built-in default.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-white">
          <CardTitle className="text-base font-semibold">Prompt Template</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div
            className="border rounded-md overflow-hidden"
            onFocus={() => onFieldFocus?.("customChatbotSystemPrompt")}
          >
            <Editor
              height="360px"
              defaultLanguage="markdown"
              theme="vs-light"
              value={formData.customChatbotSystemPrompt}
              onChange={(value) => onFieldChange("customChatbotSystemPrompt", value || "")}
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

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">Available variables</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {AVAILABLE_VARIABLES.map((v) => (
                <div key={v.name} className="flex items-baseline gap-2 text-xs">
                  <code className="text-violet-700 font-mono shrink-0">{v.name}</code>
                  <span className="text-gray-500">{v.description}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
