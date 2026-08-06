/**
 * AIPersonalitySection - AI Personality & Configuration
 * Merged: chatbotName, botIdentityResponse, toneOfVoice, welcomeMessage, customAiRules, channelMode
 */
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bot, Briefcase, Smile, Award, Coffee, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import Editor from "@monaco-editor/react"
import { useWorkspace } from "@/contexts/WorkspaceContext"

// OpenRouter model ids offered in the dropdown. Free-text entry ("Custom...")
// stays available since customChatbotModel is a plain string in the DB.
const LLM_MODEL_OPTIONS = [
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
] as const

const CUSTOM_MODEL_VALUE = "__custom__"

/**
 * Voice-id rows to render: always "Default" (the fallback the agent uses for any
 * language without its own voice), followed by the languages actually enabled —
 * so the list mirrors the checkboxes above instead of showing every language.
 */
const VOICE_ID_ROWS = (enabled: string[]) => [
  { code: "default", label: "🌐 Default" },
  ...AVAILABLE_LANGUAGES.filter((l) => enabled.includes(l.code)),
]

// Languages a client can request. `enabledLanguages` is documentation for the
// team (see Workspace.enabledLanguages) — the chatbot detects the customer's
// language from their message regardless of this list.
const AVAILABLE_LANGUAGES = [
  { code: "en", label: "🇬🇧 English" },
  { code: "it", label: "🇮🇹 Italian" },
  { code: "fr", label: "🇫🇷 French" },
  { code: "de", label: "🇩🇪 German" },
  { code: "da", label: "🇩🇰 Danish" },
  { code: "es", label: "🇪🇸 Spanish" },
  { code: "pt", label: "🇵🇹 Portuguese" },
  { code: "nl", label: "🇳🇱 Dutch" },
] as const

interface AIPersonalitySectionProps {
  formData: {
    chatbotName: string
    botIdentityResponse: string
    toneOfVoice: "formal" | "friendly" | "professional" | "casual"
    channelMode: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'
    welcomeMessage: string
    /** Greeting for a returning customer we already know by name. */
    welcomeBackMessage?: string
    enableWelcomeMessage: boolean
    sessionResetTimeout: number
    customAiRules: string
    customChatbotId: string
    defaultLanguage: string
    enabledLanguages: string[]
    needRegistration: boolean
    registrationPage: string
    requireManualApproval: boolean
    customChatbotModel: string
    customChatbotTemperature: number | null
    customChatbotMaxTokens: number | null
    audioOutput: boolean
    audioVoices: Record<string, string>
    /**
     * Free-form JSON merged onto custom-<module>/settings.json on every save,
     * for fields with no dedicated column (maxToolHops, rateLimitedMessage,
     * intakeQuestions, etc.). Widget look & feel keys are stripped server-side
     * even if present here.
     */
    customChatbotAdvancedSettings?: Record<string, unknown> | null
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
  // F50 — Andrea 2026-05-13: when the workspace runs a JSON-config custom
  // chatbot module (`customChatbotId` set, e.g. "ecolaundry"), Tone, Bot
  // Identity and Override Rules are NOT used — those live in the module's
  // own JSON config (`apps/backend/custom-<name>/json/settings.json` +
  // `json/i18n/*.json`). We hide them to avoid confusion.
  //
  // Assistant Name and Welcome Message are the exception: the flow-builder
  // paradigm (e.g. AmRobots) is DB-driven and reads chatbotName/welcomeMessage
  // straight from the Workspace row — {{chatbotName}} is resolved into
  // welcomeMessage at runtime by PromptProcessorService — so those two stay
  // visible for Flow channels even when a custom chatbot module is set.
  const { workspace } = useWorkspace()
  const isCustomChatbot = Boolean(workspace?.customChatbotId)
  const hideModuleOwnedFields = isCustomChatbot
  // LLM Model field: dropdown of well-known OpenRouter models + a "Custom..."
  // escape hatch, since customChatbotModel is a free-text string in the DB.
  const isKnownModel = LLM_MODEL_OPTIONS.some((opt) => opt.value === formData.customChatbotModel)
  const [isCustomModelMode, setIsCustomModelMode] = useState(
    () => Boolean(formData.customChatbotModel) && !isKnownModel,
  )
  // Advanced settings: edited as raw JSON text so an in-progress, momentarily
  // invalid edit isn't clobbered by re-formatting formData on every keystroke.
  // Only committed to formData (and sent to the backend) once it parses.
  const [advancedSettingsText, setAdvancedSettingsText] = useState(() =>
    JSON.stringify(formData.customChatbotAdvancedSettings ?? {}, null, 2),
  )
  const [advancedSettingsError, setAdvancedSettingsError] = useState<string | null>(null)
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

      {/* Identity Card — name, tone, bot identity */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Assistant Name — DB-backed (chatbotName), visible for all channels
              including Flow: {{chatbotName}} is resolved at runtime. */}
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

          {/* Tone of Voice — applies to every channel, including Flow. */}
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

          {/* Default Language */}
          <div className="space-y-2">
            <Label htmlFor="defaultLanguage">Default Language</Label>
            <Select
              value={formData.defaultLanguage}
              onValueChange={(value) => onFieldChange("defaultLanguage", value)}
              disabled={!canEdit}
            >
              <SelectTrigger id="defaultLanguage" className="w-64">
                <SelectValue placeholder="Select default language" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Used when the customer's language cannot be detected.
            </p>
          </div>

          {/* Supported Languages */}
          <div className="space-y-2">
            <Label>Supported Languages</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {AVAILABLE_LANGUAGES.map((lang) => {
                const checked = formData.enabledLanguages?.includes(lang.code) ?? false
                return (
                  <label
                    key={lang.code}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors",
                      checked ? "border-green-200 bg-green-50" : "border-slate-200 bg-white hover:bg-slate-50",
                      !canEdit && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-green-600"
                      checked={checked}
                      disabled={!canEdit}
                      onChange={(e) => {
                        const current = formData.enabledLanguages ?? []
                        onFieldChange(
                          "enabledLanguages",
                          e.target.checked
                            ? [...current, lang.code]
                            : current.filter((c) => c !== lang.code),
                        )
                      }}
                    />
                    <span>{lang.label}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-gray-500">
              Languages this chatbot is expected to serve.
            </p>
          </div>

          {/* Voice replies — ElevenLabs. Sits with the languages because a voice
              is picked per language; showing them apart made the pairing unclear. */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between pt-2">
              <div>
                <Label htmlFor="audioOutput">Voice Replies</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Send answers as audio messages instead of text only
                </p>
              </div>
              <Switch
                id="audioOutput"
                checked={formData.audioOutput ?? false}
                onCheckedChange={(checked) => onFieldChange("audioOutput", checked)}
                disabled={!canEdit}
              />
            </div>

            {formData.audioOutput && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-700">
                  ElevenLabs Voice IDs
                </Label>
                <p className="text-xs text-gray-500">
                  Paste the voice ID from your{" "}
                  <span className="font-medium">ElevenLabs</span> account for each language
                  (Voice Library → a voice → ID). "Default" is used for any language left
                  empty.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {VOICE_ID_ROWS(formData.enabledLanguages ?? []).map((row) => (
                    <div key={row.code} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-sm">{row.label}</span>
                      <Input
                        value={(formData.audioVoices ?? {})[row.code] ?? ""}
                        onChange={(e) => {
                          const next = { ...(formData.audioVoices ?? {}) }
                          if (e.target.value.trim()) next[row.code] = e.target.value
                          else delete next[row.code]
                          onFieldChange("audioVoices", next)
                        }}
                        placeholder="EXAVITQu4vr4xnSDxMaL"
                        disabled={!canEdit}
                        className="font-mono text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* F50: Bot Identity — hidden in custom chatbot mode (module owns identity prompts). */}
          {!hideModuleOwnedFields && (
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
          )}
        </CardContent>
      </Card>

      {/* Welcome Message Card */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Welcome Message
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Welcome Message — DB-backed (welcomeMessage), visible for all
              channels including Flow: resolved at runtime with {{chatbotName}}
              and {{companyName}} substituted. */}
          <div
            className="space-y-2"
            onFocus={() => onFieldFocus?.("welcomeMessage")}
            data-focus-key="welcomeMessage"
          >
            <Label htmlFor="welcomeMessage">Message</Label>
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
            <p className="text-xs text-gray-500">
              Sent on first contact. Supports <code>{"{{chatbotName}}"}</code>, <code>{"{{companyName}}"}</code> and <code>{"{{termsAndConditions}}"}</code>.
            </p>
          </div>

          {/* Welcome Back — used instead of the message above once we know the
              customer's name, so a returning visitor is greeted personally. */}
          <div
            className="space-y-2 mt-6"
            onFocus={() => onFieldFocus?.("welcomeBackMessage")}
            data-focus-key="welcomeBackMessage"
          >
            <Label htmlFor="welcomeBackMessage">Welcome Back Message</Label>
            <div className="border rounded-md overflow-hidden">
              <Editor
                height="140px"
                defaultLanguage="markdown"
                theme="vs-light"
                value={formData.welcomeBackMessage ?? ""}
                onChange={(value) => onFieldChange("welcomeBackMessage", value || "")}
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
            <p className="text-xs text-gray-500">
              Sent instead of the welcome message when the customer is already known by name.
              Supports <code>{"{{customerName}}"}</code>, <code>{"{{chatbotName}}"}</code> and{" "}
              <code>{"{{companyName}}"}</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Customer Registration */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              Customer Registration
            </CardTitle>
            <Switch
              id="needRegistration"
              checked={formData.needRegistration ?? false}
              onCheckedChange={(checked) => {
                onFieldChange("needRegistration", checked)
                if (!checked) onFieldChange("requireManualApproval", false)
              }}
              disabled={!canEdit}
            />
          </div>
        </CardHeader>
        {formData.needRegistration && (
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2" onFocus={() => onFieldFocus?.("registrationPage")}>
            <Label htmlFor="registrationPage">Registration Page</Label>
            <Input
              id="registrationPage"
              type="url"
              value={formData.registrationPage || ""}
              onChange={(e) => onFieldChange("registrationPage", e.target.value)}
              placeholder="https://echatbot.ai/registration/{workspaceId}"
              disabled={!canEdit}
            />
            <p className="text-xs text-gray-500">
              Custom URL for customer registration. Leave empty to use the default page.
            </p>
          </div>

          <div className="space-y-2 pt-4 border-t" onFocus={() => onFieldFocus?.("requireManualApproval")}>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="requireManualApproval" className="cursor-pointer text-sm font-medium">
                  Require Manual Approval
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  New customers stay in "Pending Approval" until an admin approves them.
                </p>
              </div>
              <Switch
                id="requireManualApproval"
                checked={formData.requireManualApproval || false}
                onCheckedChange={(checked) => onFieldChange("requireManualApproval", checked)}
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardContent>
        )}
      </Card>

      {/* Behavior — Override Rules only. F50: the whole card is hidden in custom
          chatbot mode (rephrase LLM rules live in the module's own
          prompts/rephrase.txt), otherwise it would render as an empty box. */}
      {!hideModuleOwnedFields && (
        <Card>
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Behavior
            </CardTitle>
            <p className="text-sm text-gray-500">
              Extra rules the bot must follow in every reply
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2" onFocus={() => onFieldFocus?.("agentSystemPrompt")}>
              <Label htmlFor="customAiRules">Override Rules</Label>
              <Textarea
                id="customAiRules"
                value={formData.customAiRules}
                onChange={(e) => onFieldChange("customAiRules", e.target.value)}
                placeholder={"Never promise delivery dates.\nAlways suggest the newsletter at the end."}
                disabled={!canEdit}
                className="min-h-[140px]"
              />
              <p className="text-xs text-gray-500">
                One rule per line. These are added on top of the bot's normal behaviour —
                use them for things it must always or never do.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Model — LLM used by this chatbot */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Model
          </CardTitle>
          <p className="text-sm text-gray-500">
            Which AI model answers, and how it writes
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customChatbotModel">LLM Model</Label>
              <Select
                value={isCustomModelMode ? CUSTOM_MODEL_VALUE : formData.customChatbotModel || ""}
                onValueChange={(value) => {
                  if (value === CUSTOM_MODEL_VALUE) {
                    setIsCustomModelMode(true)
                    return
                  }
                  setIsCustomModelMode(false)
                  onFieldChange("customChatbotModel", value)
                }}
                disabled={!canEdit}
              >
                <SelectTrigger id="customChatbotModel">
                  <SelectValue placeholder="Module default" />
                </SelectTrigger>
                <SelectContent>
                  {LLM_MODEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_MODEL_VALUE}>Custom...</SelectItem>
                </SelectContent>
              </Select>
              {isCustomModelMode && (
                <Input
                  value={formData.customChatbotModel || ""}
                  onChange={(e) => onFieldChange("customChatbotModel", e.target.value)}
                  placeholder="openrouter/vendor/model-id"
                  disabled={!canEdit}
                  className="mt-2"
                  autoFocus
                />
              )}
              <p className="text-xs text-gray-500">
                OpenRouter model id. Leave empty to use the module default.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="customChatbotTemperature">Temperature</Label>
                <span className="text-sm font-mono font-semibold text-blue-600 tabular-nums">
                  {(formData.customChatbotTemperature ?? 0.3).toFixed(1)}
                </span>
              </div>
              <Slider
                id="customChatbotTemperature"
                min={0}
                max={2}
                step={0.1}
                value={[formData.customChatbotTemperature ?? 0.3]}
                onValueChange={([value]) =>
                  onFieldChange("customChatbotTemperature", value)
                }
                disabled={!canEdit}
                className="py-2"
              />
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Precise</span>
                <span>Balanced</span>
                <span>Creative</span>
              </div>
              <p className="text-xs text-gray-500">
                Controls how varied the bot's wording is. Low = consistent, predictable
                answers. High = more creative phrasing, less repetitive.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customChatbotMaxTokens">Max Reply Length</Label>
              <Input
                id="customChatbotMaxTokens"
                type="number"
                min={100}
                max={4000}
                step={100}
                value={formData.customChatbotMaxTokens ?? ""}
                onChange={(e) =>
                  onFieldChange(
                    "customChatbotMaxTokens",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="800"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-500">
                Maximum length of a single reply, in tokens (~4 characters each). 800 is
                about a short paragraph. Higher costs more per message.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings — raw JSON merged onto custom-<module>/settings.json.
          Covers fields with no dedicated form control (maxToolHops, rate
          limits, privacyPolicyUrl, rateLimitedMessage, sessionTooLongMessage,
          intakeQuestions, etc). Widget look & feel keys are stripped server-side. */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Advanced Settings
          </CardTitle>
          <p className="text-sm text-gray-500">
            Raw JSON merged onto the module's settings.json on every save. Fields
            defined above always win over the same key here. Widget appearance
            (colors, icon, title, quick replies) is never accepted here.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="customChatbotAdvancedSettings">Advanced Settings (JSON)</Label>
            <div
              className={cn(
                "border rounded-md overflow-hidden",
                advancedSettingsError && "border-red-500",
              )}
            >
              <Editor
                height="220px"
                defaultLanguage="json"
                theme="vs-light"
                value={advancedSettingsText}
                onChange={(value) => {
                  const text = value ?? ""
                  setAdvancedSettingsText(text)
                  if (text.trim() === "") {
                    setAdvancedSettingsError(null)
                    onFieldChange("customChatbotAdvancedSettings", {})
                    return
                  }
                  try {
                    const parsed = JSON.parse(text)
                    if (
                      typeof parsed !== "object" ||
                      parsed === null ||
                      Array.isArray(parsed)
                    ) {
                      setAdvancedSettingsError("Must be a JSON object, e.g. { \"maxToolHops\": 6 }")
                      return
                    }
                    setAdvancedSettingsError(null)
                    onFieldChange("customChatbotAdvancedSettings", parsed)
                  } catch (e) {
                    setAdvancedSettingsError(e instanceof Error ? e.message : "Invalid JSON")
                  }
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  readOnly: !canEdit,
                }}
              />
            </div>
            {advancedSettingsError ? (
              <p className="text-xs text-red-600">{advancedSettingsError}</p>
            ) : (
              <p className="text-xs text-gray-500">
                e.g. maxToolHops, maxMessageChars, privacyPolicyUrl, rateLimitedMessage,
                sessionTooLongMessage, intakeQuestions.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
