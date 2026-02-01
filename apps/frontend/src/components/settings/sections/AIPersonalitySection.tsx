/**
 * AIPersonalitySection - AI Personality & Configuration
 * Merged: chatbotName, botIdentityResponse, toneOfVoice, welcomeMessage, customAiRules, wipMessage, sellsProductsAndServices
 */
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Bot, Briefcase, Smile, Award, Coffee, ShoppingCart, Sparkles, Settings, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Link } from "react-router-dom"
import Editor from "@monaco-editor/react"

interface AIPersonalitySectionProps {
  formData: {
    chatbotName: string
    botIdentityResponse: string
    toneOfVoice: "formal" | "friendly" | "professional" | "casual"
    sellsProductsAndServices: boolean
    welcomeMessage: string
    customAiRules: string
    wipMessage: string
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
          <div className="space-y-2" onFocus={() => onFieldFocus?.("botName")}>
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
          <div className="space-y-2" onFocus={() => onFieldFocus?.("toneOfVoice")}>
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

          {/* Enable E-commerce */}
          <div className="space-y-2" onFocus={() => onFieldFocus?.("ecommerceFeatures")}>
            <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-green-600" />
                <div>
                  <Label htmlFor="ecommerceToggle" className="text-sm font-medium text-gray-900">
                    Enable E-commerce
                  </Label>
                  <p className="text-xs text-green-700">
                    {formData.sellsProductsAndServices
                      ? "AI can help with products, orders, and payments"
                      : "AI focuses on information and support only"}
                  </p>
                </div>
              </div>
              <Switch
                id="ecommerceToggle"
                checked={formData.sellsProductsAndServices}
                onCheckedChange={(checked) => onFieldChange("sellsProductsAndServices", checked)}
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Bot Identity Response */}
          <div className="space-y-2" onFocus={() => onFieldFocus?.("botDescription")}>
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
          {/* Welcome Message */}
          <div className="space-y-2" onFocus={() => onFieldFocus?.("welcomeMessage")}>
            <Label htmlFor="welcomeMessage">Welcome Message</Label>
            <div className="border rounded-md overflow-hidden">
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
                  readOnly: !canEdit,
                }}
              />
            </div>
          </div>

          {/* Custom AI Rules */}
          <div className="space-y-2" onFocus={() => onFieldFocus?.("agentSystemPrompt")}>
            <Label htmlFor="customAiRules">Custom AI Rules</Label>
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

          {/* Advanced Agent Configuration Link */}
          <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Advanced Agent Configuration</h4>
                  <p className="text-xs text-gray-600">
                    Configure individual agent prompts, temperatures, and view the multi-agent flow
                  </p>
                </div>
              </div>
              <Link to="/agents">
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  {formData.sellsProductsAndServices ? "Configure Agents" : "Configure Info Agent"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Maintenance Message */}
          <div className="space-y-2" onFocus={() => onFieldFocus?.("maintenanceMessage")}>
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
