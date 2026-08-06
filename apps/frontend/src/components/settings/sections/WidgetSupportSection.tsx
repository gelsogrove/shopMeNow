/**
 * WidgetSupportSection - Human Support & Escalation Configuration
 */
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Headphones, Mic, Smartphone, Users, Mail } from "lucide-react"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { OperatorRecipientList } from "@/components/settings/OperatorRecipientList"

interface WidgetSupportSectionProps {
  formData: {
    hasHumanSupport: boolean
    /** Widget composer shows a microphone; voice notes are transcribed to text. */
    speechToTextEnabled: boolean
    hasSalesAgents: boolean
    operatorContactMethod: "email" | "whatsapp"
    operatorEmails: string[]
    operatorWhatsappNumbers: string[]
    operatorDeliveryMode: string
    humanSupportInstructions: string
    /** Sentence sent to the customer when the chat is handed to an operator. */
    humanSupportMessage?: string
    frustrationTriggers: string
    escalationTrigger: string
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
  { value: "all", label: "Send to all", description: "Every operator gets the message" },
  { value: "random", label: "Random", description: "One operator at random, to spread the load" },
  { value: "custom", label: "Customized", description: "The chatbot module decides who to notify" },
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
  // 'custom' hands routing to the chatbot module, so the platform stops asking
  // for recipients — configuring addresses it would never use is misleading.
  const deliveryMode = formData.operatorDeliveryMode || "all"
  const isCustomDelivery = deliveryMode === "custom"
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
          {/* Hand-off message — what the CUSTOMER is told when the chat moves
              to a human. The bot asks for the customer's name before escalating
              when it does not have one, so {{customerName}} is normally filled. */}
          <div
            className="space-y-2"
            onFocus={() => onFieldFocus?.("humanSupportMessage")}
            data-focus-key="humanSupportMessage"
          >
            <Label htmlFor="humanSupportMessage" className="text-sm font-medium">
              Hand-off Message
            </Label>
            <p className="text-sm text-gray-600">
              Sent to the customer when the conversation is passed to an operator.
            </p>
            <Textarea
              id="humanSupportMessage"
              rows={3}
              value={formData.humanSupportMessage ?? ""}
              onChange={(e) => onFieldChange("humanSupportMessage", e.target.value)}
              placeholder="Hi {{customerName}}, I'm putting you in touch with our operator as soon as possible."
              disabled={!canEdit}
            />
            <p className="text-xs text-gray-500">
              Supports <code>{"{{customerName}}"}</code>. Written in one language — the
              chatbot translates it into the customer's language automatically.
            </p>
          </div>

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

                {/* Delivery mode comes BEFORE the recipients, because it decides
                    whether recipients are configured here at all: with 'custom'
                    the chatbot module owns the routing, so asking for addresses
                    would be misleading. */}
                <div className="space-y-3 pt-2">
                  <Label>Who gets notified</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {DELIVERY_MODES.map((mode) => {
                      const selected = deliveryMode === mode.value
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => onFieldChange("operatorDeliveryMode", mode.value)}
                          className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                            selected
                              ? "border-purple-300 bg-purple-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          } ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <span
                            className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                              selected ? "border-purple-600 bg-purple-600" : "border-slate-300"
                            }`}
                          />
                          <span>
                            <span className="block text-sm font-medium">{mode.label}</span>
                            <span className="block text-xs text-gray-500 mt-0.5">
                              {mode.description}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Recipients — hidden entirely under 'custom': the module decides
                    who to contact, so there is nothing to configure here. */}
                {!isCustomDelivery && formData.operatorContactMethod === "email" && (
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

                {!isCustomDelivery && formData.operatorContactMethod === "whatsapp" && (
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

                {isCustomDelivery && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-gray-600">
                    Recipients are chosen by the custom chatbot module — by shift, language,
                    workload or whatever rule it implements. Nothing to configure here.
                  </div>
                )}
              </div>

              {/* Escalation rules. Andrea 2026-08-01: this is the single escalation
                  field. 'Frustration Signals' and 'Escalation Trigger Message' were
                  removed from the UI — three separate boxes for one concept was
                  redundant, and neither of the other two was ever read by the
                  chatbot. Their columns are kept in the DB so existing values are
                  not lost. */}
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
                <p className="text-xs text-gray-500">
                  One rule per line. The chatbot reads these to decide when to hand the
                  conversation to a person.
                </p>
              </div>

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

      {/* Speech to Text — widget microphone. Independent of hasHumanSupport:
          it changes the widget composer, not the escalation flow. */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-white" data-focus-key="speechToTextToggle">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Mic className="h-5 w-5 text-purple-600" />
                Speech to Text
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Adds a microphone to the chat widget. Voice messages are transcribed to
                text in the customer's detected language, and the chatbot replies to the
                transcription.
              </p>
            </div>
            <Switch
              checked={formData.speechToTextEnabled}
              onCheckedChange={(checked) => onFieldChange("speechToTextEnabled", checked)}
              disabled={!canEdit}
            />
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}
