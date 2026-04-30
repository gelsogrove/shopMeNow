/**
 * AIPersonalitySection - AI Personality & Configuration
 * Merged: chatbotName, botIdentityResponse, toneOfVoice, welcomeMessage, customAiRules, wipMessage, channelMode
 */
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bot, Briefcase, Smile, Award, Coffee, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import Editor from "@monaco-editor/react"

// E0b - Session reset timeout options (seconds). 0 = never auto-reset.
const SESSION_RESET_OPTIONS = [
  { value: 3600, label: "1 hour" },
  { value: 7200, label: "2 hours" },
  { value: 14400, label: "4 hours" },
  { value: 28800, label: "8 hours" },
  { value: 43200, label: "12 hours" },
  { value: 86400, label: "24 hours" },
  { value: 172800, label: "48 hours" },
  { value: 259200, label: "72 hours" },
  { value: 0, label: "Never" },
] as const

interface AIPersonalitySectionProps {
  formData: {
    chatbotName: string
    botIdentityResponse: string
    toneOfVoice: "formal" | "friendly" | "professional" | "casual"
    channelMode: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'
    welcomeMessage: string
    enableWelcomeMessage: boolean
    sessionResetTimeout: number
    customAiRules: string
    wipMessage: string
    customChatbotId: string
  }
  errors: Record<string, string>
  canEdit: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
}

const TONE_OPTIONS = [
  { value: "formal", icon: Briefcase, label: "Formal" },
  { value: "friendly", icon: Smile, label: "Friendly" },
  { value: "professional", icon: Award, label: "Professional" },
  { value: "casual", icon: Coffee, label: "Casual" },
] as const

export function AIPersonalitySection({
  formData,
  errors,
  canEdit,
  onFieldChange,
  onFieldFocus,
}: AIPersonalitySectionProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Bot className="h-6 w-6 text-blue-600" />
          AI Personality
        </h2>
        <p className="text-sm text-gray-500 mt-1">Define how your AI assistant communicates and behaves</p>
      </div>

      {/* Single Card without toggle in header */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            AI Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">{/* Chatbot Name */}
          <div
            className="space-y-2"
            onFocus={() => onFieldFocus?.("botName")}
            data-focus-key="botName"
          >
            <Label htmlFor="chatbotName">Assistant Name</Label>
            <Input
              id="chatbotName"
              value={formData.chatbotName}
              onChange={(e) => onFieldChange("chatbotName", e.target.value)}
              placeholder="Sofia"
              disabled={!canEdit}
              className={cn("w-48", errors.chatbotName && "border-red-500")}
            />
            {errors.chatbotName && (
              <p className="text-xs text-red-600">{errors.chatbotName}</p>
            )}
          </div>

          {/* Tone of Voice */}
          <div
            className="space-y-2"
            onFocus={() => onFieldFocus?.("toneOfVoice")}
            data-focus-key="toneOfVoice"
          >
            <Label>Tone of Voice</Label>
            <div className="grid grid-cols-2 gap-2">
              {TONE_OPTIONS.map(({ value, icon: Icon, label }) => (
                <div
                  key={value}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-colors",
                    formData.toneOfVoice === value
                      ? "border-green-200 bg-green-50 ring-2 ring-green-200"
                      : "border-slate-200 bg-white hover:bg-slate-50",
                    !canEdit && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => canEdit && onFieldChange("toneOfVoice", value)}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2",
                      formData.toneOfVoice === value
                        ? "border-green-600 bg-green-600"
                        : "border-slate-300"
                    )}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bot Identity Response */}
          <div
            className="space-y-2"
            onFocus={() => onFieldFocus?.("botDescription")}
            data-focus-key="botDescription"
          >
            <Label htmlFor="botIdentityResponse">Bot Identity</Label>
            <div className="border rounded-md overflow-hidden">
              <Editor
                height="250px"
                defaultLanguage="markdown"
                theme="vs-light"
                value={formData.botIdentityResponse}
                onChange={(value) => onFieldChange("botIdentityResponse", value || "")}
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

          {/* Divider */}
          <div className="border-t pt-6" />
          {/* Welcome Message + Enable Toggle (E0a) */}
          <div
            className="space-y-2"
            onFocus={() => onFieldFocus?.("welcomeMessage")}
            data-focus-key="welcomeMessage"
          >
            <div className="flex items-center justify-between">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {formData.enableWelcomeMessage ? "Enabled" : "Disabled"}
                </span>
                <Switch
                  id="enableWelcomeMessage"
                  checked={formData.enableWelcomeMessage}
                  onCheckedChange={(checked) => onFieldChange("enableWelcomeMessage", checked)}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div className={cn(
              "border rounded-md overflow-hidden transition-opacity",
              !formData.enableWelcomeMessage && "opacity-50"
            )}>
              <Editor
                height="200px"
                defaultLanguage="markdown"
                theme="vs-light"
                value={formData.welcomeMessage}
                onChange={(value) => onFieldChange("welcomeMessage", value || "")}
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
                  readOnly: !canEdit || !formData.enableWelcomeMessage,
                }}
              />
            </div>
            <p className="text-xs text-gray-500">
              When disabled, no welcome message is sent on first contact. The text is preserved for later use.
            </p>
          </div>

          {/* Session Reset Timeout (E0b) */}
          <div
            className="space-y-2"
            onFocus={() => onFieldFocus?.("sessionResetTimeout")}
            data-focus-key="sessionResetTimeout"
          >
            <Label htmlFor="sessionResetTimeout" className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              Session Reset Timeout
            </Label>
            <Select
              value={String(formData.sessionResetTimeout ?? 3600)}
              onValueChange={(value) => onFieldChange("sessionResetTimeout", Number(value))}
              disabled={!canEdit}
            >
              <SelectTrigger id="sessionResetTimeout" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_RESET_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              How long to wait after operator escalation before auto-resetting the session (cart, conversation context, flow state). Applies to all chatbot types.
            </p>
          </div>

          {/* Maintenance Message */}
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

          {/* Override Rules (formerly Custom AI Rules) */}
          <div className="space-y-2" onFocus={() => onFieldFocus?.("agentSystemPrompt")}>
            <Label htmlFor="customAiRules">Override Rules</Label>
            <div className="border rounded-md overflow-hidden">
              <Editor
                height="200px"
                defaultLanguage="markdown"
                theme="vs-light"
                value={formData.customAiRules}
                onChange={(value) => onFieldChange("customAiRules", value || "")}
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

          {/* Custom Chatbot ID — only relevant for FLOW workspaces */}
          {formData.channelMode === 'FLOW' && (
            <div className="space-y-2">
              <Label htmlFor="customChatbotId">Custom Chatbot ID</Label>
              <Input
                id="customChatbotId"
                value={formData.customChatbotId}
                onChange={(e) => onFieldChange("customChatbotId", e.target.value)}
                placeholder="e.g. cliente-0"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-500">
                Module identifier for the custom chatbot used in FLOW mode (e.g. <code>cliente-0</code>).
                Leave empty to use the standard AI agents.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
