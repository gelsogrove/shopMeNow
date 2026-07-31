/**
 * WidgetSupportSection - Human Support & Escalation Configuration
 */
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Headphones, Smartphone, Users, Mail } from "lucide-react"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { OperatorRecipientList } from "@/components/settings/OperatorRecipientList"

interface WidgetSupportSectionProps {
  formData: {
    hasHumanSupport: boolean
    hasSalesAgents: boolean
    operatorContactMethod: "email" | "whatsapp"
    operatorEmails: string[]
    operatorWhatsappNumbers: string[]
    operatorDeliveryMode: string
    humanSupportInstructions: string
    frustrationTriggers: string
    translateOperatorMessages: boolean
  }
  errors: Record<string, string>
  canEdit: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
}

// How an escalation is routed when more than one operator is configured.
// 'custom' hands the decision to the custom chatbot module, which may route by
// shift, language or workload — logic the platform deliberately does not own.
const DELIVERY_MODES = [
  { value: "all", label: "Notify everyone", description: "All operators get the message" },
  { value: "random", label: "Pick one at random", description: "Spreads the load across the team" },
  { value: "custom", label: "Custom rule", description: "The chatbot module decides who to notify" },
] as const

// F50 — Andrea 2026-05-13: "Enable Sales Agent Routing" only makes sense
// for ECOMMERCE workspaces. Hidden for INFORMATIONAL and FLOW (custom
// chatbot) workspaces — they don't use the sales-agent dispatch model.
export function WidgetSupportSection({
  formData,
  errors,
  canEdit,
  onFieldChange,
  onFieldFocus,
}: WidgetSupportSectionProps) {
  const { workspace } = useWorkspace()
  const isEcommerce = workspace?.channelMode === 'ECOMMERCE'
  const isCustomChatbot = !!workspace?.customChatbotId
  // Routing only matters once there is more than one recipient to choose between.
  const recipientCount =
    formData.operatorContactMethod === "email"
      ? (formData.operatorEmails ?? []).length
      : (formData.operatorWhatsappNumbers ?? []).length
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Headphones className="h-6 w-6 text-purple-600" />
          Human Support
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure when and how customers can reach a human operator
        </p>
      </div>

      {/* Single Card with toggle in header */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-white" data-focus-key="humanSupportToggle">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Enable Human Support
            </CardTitle>
            <Switch
              checked={formData.hasHumanSupport}
              onCheckedChange={(checked) => onFieldChange("hasHumanSupport", checked)}
              disabled={!canEdit}
            />
          </div>
        </CardHeader>
        {formData.hasHumanSupport && (
        <CardContent className="pt-6 space-y-6">
          {/* Contact Method */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Contact Method</Label>
                <p className="text-sm text-gray-600">
                  Choose how customers will be connected to a human operator when they request support.
                </p>

                <div className="grid gap-3 md:grid-cols-2">
                  {/* Email Option */}
                  <div
                    className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-colors ${
                      formData.operatorContactMethod === "email"
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                    }`}
                    onClick={() => canEdit && onFieldChange("operatorContactMethod", "email")}
                    onFocus={() => onFieldFocus?.("contactMethodEmail")}
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="font-medium text-sm">Email</p>
                        <p className="text-xs text-gray-500">
                          Send via email notification
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 ${
                        formData.operatorContactMethod === "email"
                          ? "border-blue-600 bg-blue-600"
                          : "border-slate-300"
                      }`}
                    />
                  </div>

                  {/* WhatsApp Option */}
                  <div
                    className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-colors ${
                      formData.operatorContactMethod === "whatsapp"
                        ? "border-green-200 bg-green-50"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                    }`}
                    onClick={() => canEdit && onFieldChange("operatorContactMethod", "whatsapp")}
                    onFocus={() => onFieldFocus?.("contactMethodWhatsApp")}
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="font-medium text-sm">WhatsApp</p>
                        <p className="text-xs text-gray-500">
                          Forward to operator's WhatsApp
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 ${
                        formData.operatorContactMethod === "whatsapp"
                          ? "border-green-600 bg-green-600"
                          : "border-slate-300"
                      }`}
                    />
                  </div>
                </div>

                {/* Recipients for the selected method. Both are lists: a team
                    usually has more than one person on escalation duty. */}
                {formData.operatorContactMethod === "email" && (
                  <div className="space-y-2 pt-2" onFocus={() => onFieldFocus?.("operatorEmail")}>
                    <Label>Operator Email Addresses</Label>
                    <OperatorRecipientList
                      values={formData.operatorEmails ?? []}
                      onChange={(values) => onFieldChange("operatorEmails", values)}
                      disabled={!canEdit}
                      placeholder="support@yourcompany.com"
                      addLabel="Add"
                      emptyHint="Add at least one address, or escalations have nowhere to go."
                      validate={(value) =>
                        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : "Enter a valid email address"
                      }
                    />
                  </div>
                )}

                {formData.operatorContactMethod === "whatsapp" && (
                  <div className="space-y-2 pt-2" onFocus={() => onFieldFocus?.("operatorWhatsApp")}>
                    <Label>Operator WhatsApp Numbers</Label>
                    <OperatorRecipientList
                      values={formData.operatorWhatsappNumbers ?? []}
                      onChange={(values) => onFieldChange("operatorWhatsappNumbers", values)}
                      disabled={!canEdit}
                      placeholder="+1234567890"
                      addLabel="Add"
                      emptyHint="Add at least one number, or escalations have nowhere to go."
                      validate={(value) =>
                        /^\+?[0-9\s-]{6,20}$/.test(value)
                          ? null
                          : "Enter a valid phone number, including country code"
                      }
                    />
                  </div>
                )}

                {/* Delivery mode — only meaningful with more than one recipient. */}
                {recipientCount > 1 && (
                  <div className="space-y-3 pt-2">
                    <Label>When someone needs a human</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {DELIVERY_MODES.map((mode) => {
                        const selected = (formData.operatorDeliveryMode ?? "all") === mode.value
                        return (
                          <button
                            key={mode.value}
                            type="button"
                            disabled={!canEdit}
                            onClick={() => onFieldChange("operatorDeliveryMode", mode.value)}
                            className={`rounded-lg border p-3 text-left transition-colors ${
                              selected
                                ? "border-purple-300 bg-purple-50"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            } ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <p className="text-sm font-medium">{mode.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{mode.description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Escalation Instructions — hidden for custom chatbot workspaces:
                  escalation is deterministic in code, not LLM-prompt-driven */}
              {!isCustomChatbot && (
                <>
                  <div className="space-y-2 pt-2 border-t" onFocus={() => onFieldFocus?.("escalationInstructions")}>
                    <Label htmlFor="humanSupportInstructions" className="pt-4 block">When to Escalate</Label>
                    <Textarea
                      id="humanSupportInstructions"
                      value={formData.humanSupportInstructions}
                      onChange={(e) => onFieldChange("humanSupportInstructions", e.target.value)}
                      placeholder="Examples:
- When customer explicitly asks for a human
- For complaints or refund requests
- When AI cannot resolve the issue after 3 attempts
- For orders over €1000"
                      disabled={!canEdit}
                      className="min-h-[120px]"
                    />
                  </div>

                  <div
                    className="space-y-2 pt-4"
                    onFocus={() => onFieldFocus?.("frustrationTriggers")}
                    data-focus-key="frustrationTriggers"
                  >
                    <Label htmlFor="frustrationTriggers" className="block">Frustration Signals</Label>
                    <p className="text-xs text-gray-500">When the customer shows frustration or panic, escalate immediately</p>
                    <Textarea
                      id="frustrationTriggers"
                      value={formData.frustrationTriggers}
                      onChange={(e) => onFieldChange("frustrationTriggers", e.target.value)}
                      placeholder="Examples:
- Repeated exclamation marks or all-caps messages
- Words like 'furious', 'unacceptable', 'scam'
- Customer says they will leave a bad review"
                      disabled={!canEdit}
                      className="min-h-[100px]"
                    />
                  </div>
                </>
              )}

              {/* Translate operator messages to customer language */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Auto-translate operator messages</Label>
                    <p className="text-xs text-gray-500 mt-1">
                      When enabled, messages you write in the chat are automatically translated to the customer's language before being sent.
                    </p>
                  </div>
                  <Switch
                    checked={formData.translateOperatorMessages}
                    onCheckedChange={(checked) => onFieldChange("translateOperatorMessages", checked)}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              {/* Sales Agents Toggle — F50: only meaningful for ECOMMERCE
                  workspaces. Hidden for INFORMATIONAL and FLOW (custom chatbot). */}
              {isEcommerce && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Enable Sales Agent Routing</Label>
                      <p className="text-xs text-gray-500 mt-1">
                        When enabled, support requests are routed to the customer's assigned sales agent. Enables the Sales Agents list in the navigation menu and the Salesperson field in customer profiles.
                      </p>
                    </div>
                    <Switch
                      checked={formData.hasSalesAgents}
                      onCheckedChange={(checked) => onFieldChange("hasSalesAgents", checked)}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              )}
        </CardContent>
        )}
      </Card>
    </div>
  )
}
