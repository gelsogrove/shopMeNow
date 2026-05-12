/**
 * @deprecated F50 — Andrea 2026-05-13 — Visual Flow Builder deprecated.
 * Replaced by code-based custom chatbot modules. Pending physical removal.
 */
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"
import {
  CallingFunction,
  callingFunctionsApi,
} from "@/services/callingFunctionApi"
import {
  CreateFlowConfigData,
  FlowConfig,
  FlowValidationResult,
  UpdateFlowConfigData,
  flowConfigApi,
} from "@/services/flowConfigApi"
import Editor from "@monaco-editor/react"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

// ─── Available prompt variables grouped by category ─────────────────────────
// Source of truth: PromptVariableBuilder.build() in backend
const PROMPT_VARIABLES = [
  {
    group: "Bot & Workspace",
    vars: [
      { name: "chatbotName", desc: "Bot name (from Settings > General)" },
      { name: "companyName", desc: "Workspace / company name" },
      { name: "toneOfVoice", desc: "Configured tone (friendly, formal…)" },
      { name: "botIdentityResponse", desc: "Answer to 'who are you?'" },
      { name: "channelMode", desc: "FLOW | ECOMMERCE | INFORMATIONAL" },
      { name: "address", desc: "Physical address" },
      { name: "workspaceUrl", desc: "Workspace URL" },
      { name: "websiteUrl", desc: "Website URL" },
      { name: "adminEmail", desc: "Admin / support email" },
      { name: "supportEmail", desc: "Support email" },
      { name: "customAiRules", desc: "Custom AI rules" },
      { name: "allowedExternalLinks", desc: "Allowed external links" },
    ],
  },
  {
    group: "Customer",
    vars: [
      { name: "customerName", desc: "Customer first/last name" },
      { name: "customerPhone", desc: "Customer WhatsApp number" },
      { name: "customerEmail", desc: "Customer email address" },
      { name: "customerDiscount", desc: "Discount percentage (0-100)" },
      { name: "languageUser", desc: "ITALIANO | ENGLISH | ESPAÑOL | PORTUGUÊS" },
    ],
  },
  {
    group: "Content (FLOW)",
    vars: [
      { name: "faqs", desc: "All active FAQs — Q: … A: … blocks" },
    ],
  },
  {
    group: "Content (Ecommerce)",
    vars: [
      { name: "products", desc: "Full product catalog" },
      { name: "categories", desc: "Product categories" },
      { name: "offers", desc: "Active offers" },
      { name: "services", desc: "Services list" },
    ],
  },
  {
    group: "Human Support",
    vars: [
      { name: "hasHumanSupport", desc: "true/false — human support enabled" },
      { name: "humanSupportInstructions", desc: "Escalation instructions" },
      { name: "operatorContactMethod", desc: "EMAIL | WHATSAPP" },
      { name: "operatorWhatsappNumber", desc: "Operator WhatsApp number" },
    ],
  },
  {
    group: "Sales Agent",
    vars: [
      { name: "salesAgentName", desc: "Assigned sales agent name" },
      { name: "salesAgentEmail", desc: "Assigned sales agent email" },
      { name: "salesAgentPhone", desc: "Assigned sales agent phone" },
    ],
  },
  {
    group: "Calendar",
    vars: [
      { name: "hasCalendarEnabled", desc: "true/false — calendar bookings enabled" },
      { name: "appointmentTypes", desc: "List of bookable appointment types" },
      { name: "customerUpcomingAppointments", desc: "Customer's upcoming appointments" },
    ],
  },
] as const

const AVAILABLE_MODELS = [
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini (fast, cheap)" },
  { value: "openai/gpt-4o", label: "GPT-4o (smart, pricier)" },
  { value: "openai/gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku (fast)" },
  { value: "anthropic/claude-3-sonnet", label: "Claude 3 Sonnet" },
  { value: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { value: "google/gemini-flash-1.5", label: "Gemini Flash 1.5" },
  { value: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B" },
]

const FLOW_JSON_PLACEHOLDER = `{
  "non_parte": {
    "step_0": {
      "type": "CHOICE",
      "prompt": "What does the display show?",
      "transitions": {
        "1": "non_parte.step_err_alm",
        "2": "non_parte.step_no_power"
      }
    }
  }
}`

interface FlowConfigSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  config?: FlowConfig | null
  onSaved: () => void
  enableWelcomeMessage?: boolean
}

export function FlowConfigSheet({
  open,
  onOpenChange,
  workspaceId,
  config,
  onSaved,
  enableWelcomeMessage = true,
}: FlowConfigSheetProps) {
  const isEdit = !!config

  const [activeTab, setActiveTab] = useState("basics")
  const [flowKey, setFlowKey] = useState("")
  const [flowLabel, setFlowLabel] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [model, setModel] = useState("openai/gpt-4o-mini")
  const [temperature, setTemperature] = useState(0.3)
  const [maxTokens, setMaxTokens] = useState(500)
  const [flowsJson, setFlowsJson] = useState("{}")
  const [syntaxError, setSyntaxError] = useState<string | null>(null)
  const [validationResult, setValidationResult] =
    useState<FlowValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [allFunctions, setAllFunctions] = useState<CallingFunction[]>([])
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([])
  const [showVarPanel, setShowVarPanel] = useState(false)
  const editorRef = useRef<any>(null)

  useEffect(() => {
    if (!workspaceId) return
    callingFunctionsApi
      .list(workspaceId)
      .then(setAllFunctions)
      .catch(() => {
        // Non-critical: silently fail
      })
  }, [workspaceId])

  useEffect(() => {
    if (config) {
      setFlowKey(config.flowKey)
      setFlowLabel(config.flowLabel)
      setSystemPrompt(config.systemPrompt || "")
      setModel(config.model || "openai/gpt-4o-mini")
      setTemperature(config.temperature ?? 0.3)
      setMaxTokens(config.maxTokens ?? 500)
      setFlowsJson(config.flows ? JSON.stringify(config.flows, null, 2) : "{}")
      const funcs = config.availableFunctions
      setSelectedFunctions(Array.isArray(funcs) ? (funcs as string[]) : [])
    } else {
      setFlowKey("")
      setFlowLabel("")
      setSystemPrompt("")
      setModel("openai/gpt-4o-mini")
      setTemperature(0.3)
      setMaxTokens(500)
      setFlowsJson("{}")
      setSelectedFunctions([])
    }
    setActiveTab("basics")
    setSyntaxError(null)
    setValidationResult(null)
  }, [config, open])

  // Live syntax check on flows JSON
  const parsedFlows = useMemo(() => {
    if (!flowsJson.trim()) {
      setSyntaxError(null)
      return {}
    }
    try {
      const parsed = JSON.parse(flowsJson)
      setSyntaxError(null)
      return parsed
    } catch (e: any) {
      setSyntaxError(e.message || "Invalid JSON")
      return null
    }
  }, [flowsJson])

  const runValidation = async () => {
    if (syntaxError || parsedFlows === null) {
      toast.error("Fix JSON syntax first")
      return
    }
    setIsValidating(true)
    try {
      const result = await flowConfigApi.validateFlows(workspaceId, parsedFlows)
      setValidationResult(result)
      if (result.valid) {
        toast.success(
          `Flow JSON valid — ${result.stats.totalFlows} flows, ${result.stats.totalNodes} nodes`
        )
      } else {
        toast.error(`Found ${result.errors.length} error(s)`)
      }
    } catch (e: any) {
      toast.error(e.message || "Validation failed")
    } finally {
      setIsValidating(false)
    }
  }

  const hasBlockingErrors =
    !!syntaxError ||
    parsedFlows === null ||
    (validationResult !== null && !validationResult.valid)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isRouter && (syntaxError || parsedFlows === null)) {
      toast.error("Flow JSON has syntax errors")
      setActiveTab("flow")
      return
    }

    setIsSaving(true)
    try {
      if (isEdit && config) {
        const updateData: UpdateFlowConfigData = {
          flowLabel,
          systemPrompt: systemPrompt || undefined,
          model: model || undefined,
          temperature,
          maxTokens,
          availableFunctions: selectedFunctions,
          flows: isRouter ? undefined : parsedFlows,
        }
        await flowConfigApi.update(workspaceId, config.id, updateData)
        toast.success("Flow config updated successfully")
      } else {
        const createData: CreateFlowConfigData = {
          flowKey,
          flowLabel,
          systemPrompt: systemPrompt || undefined,
          model: model || undefined,
          temperature,
          maxTokens,
          availableFunctions: selectedFunctions,
          flows: flowKey === 'router' ? undefined : parsedFlows,
        }
        await flowConfigApi.create(workspaceId, createData)
        toast.success("Flow config created successfully")
      }
      onSaved()
      onOpenChange(false)
    } catch (error: any) {
      logger.error("Error saving flow config:", error)
      // Surface backend validation errors on the Flow JSON tab
      const message = error.message || "Failed to save flow config"
      toast.error(message)
      if (!isRouter && /flow|json|schema/i.test(message)) {
        setActiveTab("flow")
      }
    } finally {
      setIsSaving(false)
    }
  }

  const isRouter = config?.flowKey === 'router'

  const allIssues = validationResult
    ? [
        ...validationResult.errors.map((e) => ({ ...e, kind: "error" as const })),
        ...validationResult.warnings.map((w) => ({ ...w, kind: "warning" as const })),
      ]
    : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[95%] sm:w-[700px] md:w-[75%] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Edit Flow Config" : "Add Flow Config"}
          </SheetTitle>
          <SheetDescription>
            Configure a sub-LLM flow for a specific machine or troubleshooting
            scenario. Each flow runs with its own prompt, model, tools, and
            decision tree.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid w-full ${isRouter ? 'grid-cols-3' : 'grid-cols-4'}`}>
              <TabsTrigger value="basics">Basics</TabsTrigger>
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              {!isRouter && (
                <TabsTrigger value="flow" className="relative">
                  Flow JSON
                  {hasBlockingErrors && (
                    <span className="ml-2 inline-block h-2 w-2 rounded-full bg-destructive" />
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {/* ───── BASICS ───── */}
            <TabsContent value="basics" className="space-y-4 pt-4">
              <div className="space-y-1">
                <Label htmlFor="flowKey">Flow Key</Label>
                <Input
                  id="flowKey"
                  value={flowKey}
                  onChange={(e) => setFlowKey(e.target.value)}
                  placeholder="e.g. washer_hs60xx"
                  disabled={isEdit}
                  required={!isEdit}
                />
                <p className="text-xs text-muted-foreground">
                  {isEdit
                    ? "Flow key cannot be changed after creation."
                    : "Unique identifier — used in QR payload START_FLOW_{N}_{flowKey}."}
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="flowLabel">Flow Label</Label>
                <Input
                  id="flowLabel"
                  value={flowLabel}
                  onChange={(e) => setFlowLabel(e.target.value)}
                  placeholder="e.g. Washer HS-60XX"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="model">Sub-LLM Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This LLM runs exclusively for this flow, independent of the
                  workspace default.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Temperature</span>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                      {temperature.toFixed(1)}
                    </span>
                  </Label>
                  <Slider
                    value={[temperature]}
                    onValueChange={(v) => setTemperature(v[0])}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Precise (0.0)</span>
                    <span>Creative (1.0)</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="maxTokens">Max Tokens</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min={50}
                    max={4000}
                    value={maxTokens}
                    onChange={(e) =>
                      setMaxTokens(parseInt(e.target.value, 10))
                    }
                  />
                </div>
              </div>


            </TabsContent>

            {/* ───── PROMPT ───── */}
            <TabsContent value="prompt" className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Markdown · {systemPrompt.length} chars
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowVarPanel(v => !v)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {showVarPanel ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {showVarPanel ? "Hide variables" : "Available variables"}
                  </button>
                </div>
              </div>

              {/* ── Variable reference panel ── */}
              {showVarPanel && (
                <div className="border rounded-md bg-slate-50 p-3 space-y-3 text-xs max-h-60 overflow-y-auto">
                  <p className="text-slate-500 text-[11px]">
                    Click a variable to insert it at the cursor position in the prompt.
                    All variables are replaced at runtime — injected by the backend before the LLM call.
                  </p>
                  {PROMPT_VARIABLES.map(group => (
                    <div key={group.group}>
                      <p className="font-semibold text-slate-700 mb-1">{group.group}</p>
                      <div className="flex flex-wrap gap-1">
                        {group.vars.map(v => (
                          <button
                            key={v.name}
                            type="button"
                            title={v.desc}
                            onClick={() => {
                              const tag = `{{${v.name}}}`
                              if (editorRef.current) {
                                const editor = editorRef.current
                                const position = editor.getPosition()
                                editor.executeEdits("insert-variable", [{
                                  range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: position.column,
                                    endLineNumber: position.lineNumber,
                                    endColumn: position.column,
                                  },
                                  text: tag,
                                }])
                                editor.focus()
                              } else {
                                // Fallback: append to prompt text
                                setSystemPrompt(prev => prev + tag)
                              }
                            }}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[10px] hover:bg-blue-100 cursor-pointer"
                          >
                            {`{{${v.name}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border rounded-md overflow-hidden">
                <Editor
                  height="380px"
                  defaultLanguage="markdown"
                  theme="vs-light"
                  value={systemPrompt}
                  onChange={(value) => setSystemPrompt(value || "")}
                  onMount={(editor) => { editorRef.current = editor }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    folding: true,
                    tabSize: 2,
                    padding: { top: 8, bottom: 8 },
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Machine-specific instructions for this sub-LLM. Use{" "}
                <code className="bg-muted px-1 rounded font-mono text-[11px]">{"{{chatbotName}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded font-mono text-[11px]">{"{{faqs}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded font-mono text-[11px]">{"{{toneOfVoice}}"}</code>{" "}
                and other variables above. Multilingual output is handled by TranslationAgent.
              </p>
            </TabsContent>

            {/* ───── TOOLS ───── */}
            <TabsContent value="tools" className="space-y-3 pt-4">
              <div>
                <p className="text-sm font-medium mb-2">
                  Available to this flow
                </p>
                {allFunctions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No calling functions found. Create one from Manage
                    Functions.
                  </p>
                ) : (
                  <div className="space-y-2 rounded-md border p-3 max-h-[360px] overflow-y-auto">
                    {/* Filter out DELEGATE_TO_AGENT functions that point TO this very flowKey — would cause an infinite loop */}
                    {/* Sorted: Agents first, then Calling Functions / Webhooks */}
                    {allFunctions.filter(fn =>
                      !(fn.executionType === "DELEGATE_TO_AGENT" && fn.attachedFlowKey === config?.flowKey) &&
                      !(fn.attachedLlm === "PROFILE_MANAGEMENT" && !enableWelcomeMessage)
                    ).sort((a, b) => {
                      const rank = (fn: CallingFunction) => fn.executionType === "DELEGATE_TO_AGENT" ? 0 : 1
                      return rank(a) - rank(b) || a.functionName.localeCompare(b.functionName)
                    }).map((fn) => (
                      <div
                        key={fn.functionName}
                        className="flex items-start gap-3"
                      >
                        <Checkbox
                          id={`fn-${fn.functionName}`}
                          checked={selectedFunctions.includes(fn.functionName)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedFunctions((prev) => [
                                ...prev,
                                fn.functionName,
                              ])
                            } else {
                              setSelectedFunctions((prev) =>
                                prev.filter((f) => f !== fn.functionName)
                              )
                            }
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={`fn-${fn.functionName}`}
                            className="text-sm font-medium cursor-pointer flex items-center gap-2"
                          >
                            {fn.functionName}
                            <Badge
                              variant="outline"
                              className={cn("text-[10px]", {
                                "bg-amber-50 text-amber-600 border-amber-200": fn.executionType === "DELEGATE_TO_AGENT",
                                "bg-purple-50 text-purple-600 border-purple-200": fn.executionType === "INTERNAL",
                                "bg-blue-50 text-blue-600 border-blue-200": fn.executionType === "WEBHOOK",
                              })}
                            >
                              {fn.executionType === "DELEGATE_TO_AGENT" ? "Agent" : fn.executionType === "INTERNAL" ? "Calling Function" : "Webhook"}
                            </Badge>
                          </label>
                          {fn.description && (
                            <p className="text-xs text-muted-foreground">
                              {fn.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Selected: {selectedFunctions.length} / {allFunctions.length}
                </p>
              </div>
            </TabsContent>

            {/* ───── FLOW JSON ───── (hidden for Router) */}
            {!isRouter && <TabsContent value="flow" className="space-y-3 pt-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label htmlFor="flowsJson">Decision Tree (JSON)</Label>
                  <p className="text-xs text-muted-foreground">
                    Top-level keys are flow IDs. Each flow must have{" "}
                    <code className="font-mono bg-muted px-1 rounded">
                      step_0
                    </code>{" "}
                    as entry node. Transitions target{" "}
                    <code className="font-mono bg-muted px-1 rounded">
                      flowId.nodeId
                    </code>
                    .
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={runValidation}
                  disabled={isValidating || !!syntaxError}
                >
                  {isValidating ? "Validating..." : "Validate"}
                </Button>
              </div>

              <div
                data-testid="flows-json-editor-wrapper"
                className={cn(
                  "border rounded-md overflow-hidden",
                  syntaxError && "border-destructive"
                )}
              >
                <Editor
                  height="380px"
                  defaultLanguage="json"
                  theme="vs-light"
                  value={flowsJson}
                  onChange={(value) => {
                    setFlowsJson(value || "")
                    setValidationResult(null)
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    folding: true,
                    tabSize: 2,
                    padding: { top: 8, bottom: 8 },
                    formatOnPaste: true,
                  }}
                />
              </div>

              {flowsJson.trim() === "{}" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFlowsJson(FLOW_JSON_PLACEHOLDER)}
                >
                  Insert example
                </Button>
              )}

              {/* Status panel */}
              {syntaxError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-destructive">
                      JSON syntax error
                    </p>
                    <p className="text-xs text-destructive/80 font-mono break-all">
                      {syntaxError}
                    </p>
                  </div>
                </div>
              )}

              {!syntaxError && validationResult && (
                <div
                  className={cn(
                    "rounded-md border p-3 space-y-2",
                    validationResult.valid
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-destructive/50 bg-destructive/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {validationResult.valid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <p className="text-sm font-medium">
                      {validationResult.valid
                        ? "Flow JSON valid"
                        : `${validationResult.errors.length} error(s), ${validationResult.warnings.length} warning(s)`}
                    </p>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {validationResult.stats.totalFlows} flows ·{" "}
                      {validationResult.stats.totalNodes} nodes ·{" "}
                      {validationResult.stats.terminalNodes} terminal
                    </span>
                  </div>
                  {allIssues.length > 0 && (
                    <ul className="space-y-1 max-h-48 overflow-y-auto">
                      {allIssues.map((issue, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs"
                        >
                          {issue.kind === "error" ? (
                            <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                          ) : (
                            <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                          )}
                          <span className="font-mono text-muted-foreground">
                            {issue.path}
                          </span>
                          <span>{issue.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {!syntaxError && !validationResult && (
                <p className="text-xs text-muted-foreground">
                  Click <strong>Validate</strong> to check the decision tree
                  against the schema before saving.
                </p>
              )}
            </TabsContent>}
          </Tabs>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {hasBlockingErrors ? (
                <span className="text-destructive">
                  Resolve flow JSON errors before saving.
                </span>
              ) : (
                "All changes will be applied to the live flow on save."
              )}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || (!isRouter && (!!syntaxError || parsedFlows === null))}
              >
                {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
