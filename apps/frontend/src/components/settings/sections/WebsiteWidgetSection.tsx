/**
 * WebsiteWidgetSection - Website Widget Configuration
 * Separate from WhatsApp - cleaner organization
 */
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Monitor,
  Copy,
  MessageCircle,
  Bot,
  Sparkles,
  LifeBuoy,
  Brain,
  Zap,
  Send,
  HelpCircle,
  Phone,
  Cpu,
  MessageSquare,
  MessagesSquare,
  AlertTriangle,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"

interface WebsiteWidgetSectionProps {
  formData: {
    enableWidget: boolean
    widgetTitle: string
    widgetPrimaryColor: string
  widgetLanguage: string
  widgetIcon: string
  widgetUseChannelLogo: boolean
  widgetAutoSuggestionsEnabled: boolean
  widgetQuickReplies: string[]
    logoUrl?: string
  }
  workspaceId: string
  errors: Record<string, string>
  canEdit: boolean
  /** 🚨 Widget unavailable for e-commerce workspaces (Andrea's rule) */
  sellsProductsAndServices?: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
}

const WIDGET_ICON_OPTIONS = [
  { value: "chat", label: "Chat Bubble", icon: MessageCircle },
  { value: "bot", label: "Bot", icon: Bot },
  { value: "sparkles", label: "Sparkles", icon: Sparkles },
  { value: "support", label: "Support", icon: LifeBuoy },
  { value: "brain", label: "Brain", icon: Brain },
  { value: "zap", label: "Zap", icon: Zap },
  { value: "send", label: "Send", icon: Send },
  { value: "message-square", label: "Message", icon: MessageSquare },
  { value: "messages", label: "Messages", icon: MessagesSquare },
  { value: "help", label: "Help", icon: HelpCircle },
  { value: "phone", label: "Phone", icon: Phone },
  { value: "cpu", label: "CPU", icon: Cpu },
]

export function WebsiteWidgetSection({
  formData,
  workspaceId,
  errors,
  canEdit,
  sellsProductsAndServices = false,
  onFieldChange,
  onFieldFocus,
}: WebsiteWidgetSectionProps) {
  // 🚨 Widget disabled for e-commerce workspaces (Andrea's rule)
  const isEcommerce = sellsProductsAndServices === true
  const widgetDisabled = !canEdit || isEcommerce
  const maxReplies = 4
  
  const copyEmbedCode = () => {
  const embedCode = `<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    workspaceId: "${workspaceId}",
    title: "${formData.widgetTitle || "Chat with us"}",
    primaryColor: "${formData.widgetPrimaryColor || "#22c55e"}",
    icon: "${formData.widgetIcon || "chat"}",
    language: "${formData.widgetLanguage || "it"}",
    useChannelLogo: ${formData.widgetUseChannelLogo ? "true" : "false"},
    logoUrl: "${formData.widgetUseChannelLogo && formData.logoUrl ? formData.logoUrl : ""}"
  };
</script>
<script src="${window.location.origin}/widget.js" async></script>`
    navigator.clipboard.writeText(embedCode)
    toast.success("✅ Code copied to clipboard!")
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Monitor className="h-6 w-6 text-indigo-600" />
          Website Widget
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure the chat widget for your website
        </p>
      </div>

      {/* Enable Widget */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Monitor className="h-5 w-5 text-indigo-600" />
              Widget Status
            </CardTitle>
            <Switch
              checked={formData.enableWidget}
              onCheckedChange={(checked) => onFieldChange("enableWidget", checked)}
              disabled={widgetDisabled}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Widget auto-management info */}
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-800 font-medium">
                  Widget is automatically {formData.enableWidget ? "enabled" : "disabled"}
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {formData.enableWidget 
                    ? "Your workspace is configured for support/information. Widget is available."
                    : "E-commerce workspaces cannot use widget. Change \"Sell Products & Services\" in Business Config to enable widget."
                  }
                </p>
              </div>
            </div>
          </div>
          
          {!formData.enableWidget ? (
            <div className="text-center py-8 text-gray-500">
              <Monitor className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Website Widget is disabled</p>
              <p className="text-sm">Enable the toggle above to configure widget settings</p>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Widget Title */}
              <div
                className="space-y-2"
                onFocus={() => onFieldFocus?.("widgetTitle")}
                data-focus-key="widgetTitle"
              >
                <Label htmlFor="widgetTitle" className="text-xs font-semibold text-gray-700">
                  Widget Title
                </Label>
                <Input
                  id="widgetTitle"
                  value={formData.widgetTitle}
                  onChange={(e) => onFieldChange("widgetTitle", e.target.value)}
                  placeholder="Chat with us"
                  disabled={!canEdit}
                />
              </div>

              {/* Primary Color */}
              <div
                className="space-y-2"
                onFocus={() => onFieldFocus?.("widgetPrimaryColor")}
              >
                <Label
                  htmlFor="widgetPrimaryColor"
                  className="text-xs font-semibold text-gray-700"
                >
                  Primary Color
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="widgetPrimaryColor"
                    type="color"
                    value={formData.widgetPrimaryColor}
                    onChange={(e) => onFieldChange("widgetPrimaryColor", e.target.value)}
                    disabled={!canEdit}
                    className="w-12 h-9 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={formData.widgetPrimaryColor}
                    onChange={(e) => onFieldChange("widgetPrimaryColor", e.target.value)}
                    disabled={!canEdit}
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Auto Suggestions */}
              <div className="col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-gray-700">
                      Auto Suggestions (max {maxReplies})
                    </Label>
                    <p className="text-xs text-gray-500">
                      Quick reply buttons shown in the widget when chat opens.
                    </p>
                  </div>
                  <Switch
                    checked={formData.widgetAutoSuggestionsEnabled}
                    onCheckedChange={(checked) =>
                      onFieldChange("widgetAutoSuggestionsEnabled", checked)
                    }
                    disabled={widgetDisabled}
                  />
                </div>
                {formData.widgetAutoSuggestionsEnabled && (
                  <div className="space-y-2">
                    {formData.widgetQuickReplies.map((reply, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          value={reply}
                          maxLength={80}
                          onChange={(e) => {
                            const next = [...formData.widgetQuickReplies]
                            next[idx] = e.target.value
                            onFieldChange("widgetQuickReplies", next)
                          }}
                          disabled={widgetDisabled}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const next = formData.widgetQuickReplies.filter((_, i) => i !== idx)
                            onFieldChange("widgetQuickReplies", next)
                          }}
                          disabled={widgetDisabled}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    {formData.widgetQuickReplies.length < maxReplies && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onFieldChange("widgetQuickReplies", [...formData.widgetQuickReplies, ""])
                        }
                        disabled={widgetDisabled}
                      >
                        Add suggestion
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Widget Icon */}
              <div className="col-span-2 space-y-2">
                <Label className="text-xs font-semibold text-gray-700">Widget Icon</Label>
                <div className="grid grid-cols-6 gap-2">
                  {WIDGET_ICON_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "h-16 rounded border-2 transition-all flex flex-col items-center justify-center gap-1",
                        formData.widgetIcon === option.value
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                      onClick={() => onFieldChange("widgetIcon", option.value)}
                      disabled={!canEdit}
                    >
                      <option.icon
                        className={cn(
                          "h-5 w-5",
                          formData.widgetIcon === option.value
                            ? "text-green-600"
                            : "text-gray-600"
                        )}
                      />
                      <span className="text-[9px]">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <Label className="text-xs font-semibold text-gray-700">Use channel logo</Label>
                  <p className="text-xs text-gray-500">When enabled, the button shows the channel logo</p>
                </div>
                <Switch
                  checked={formData.widgetUseChannelLogo}
                  onCheckedChange={(checked) => onFieldChange("widgetUseChannelLogo", checked)}
                  disabled={!canEdit}
                />
              </div>
            </div>

            {/* Embed Code */}
            <div className="space-y-3 pt-6 mt-6 border-t-2 border-gray-300">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-bold text-gray-900 flex items-center gap-2">
                    📋 Embed Code
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Copy this code into your website's HTML to enable the widget
                  </p>
                </div>
                <Button
                  type="button"
                  size="default"
                  className="h-10 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg"
                  onClick={copyEmbedCode}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </Button>
              </div>
              <div className="relative min-w-0">
                <pre className="bg-slate-900 text-green-400 p-5 rounded-xl text-sm leading-relaxed overflow-x-auto border-2 border-slate-600 shadow-xl max-w-full">
                  {`<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    workspaceId: "${workspaceId || "YOUR_WORKSPACE_ID"}",
    title: "${formData.widgetTitle || "Chat with us"}",
    primaryColor: "${formData.widgetPrimaryColor || "#22c55e"}",
    icon: "${formData.widgetIcon || "chat"}",
    language: "${formData.widgetLanguage || "it"}",
    useChannelLogo: ${formData.widgetUseChannelLogo ? "true" : "false"},
    logoUrl: "${formData.widgetUseChannelLogo && formData.logoUrl ? formData.logoUrl : ""}"
  };
</script>
<script src="${window.location.origin}/widget.js" async></script>`}
                </pre>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
