import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Switch } from "@/components/ui/switch"
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
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Info,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

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
}

export function FlowConfigSheet({
  open,
  onOpenChange,
  workspaceId,
  config,
  onSaved,
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
  const [isActive, setIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [allFunctions, setAllFunctions] = useState<CallingFunction[]>([])
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([])

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
      setIsActive(config.isActive)
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
      setIsActive(true)
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

    if (syntaxError || parsedFlows === null) {
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
          flows: parsedFlows,
          isActive,
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
          flows: parsedFlows,
          isActive,
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
      if (/flow|json|schema/i.test(message)) {
        setActiveTab("flow")
      }
    } finally {
      setIsSaving(false)
    }
  }

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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basics">Basics</TabsTrigger>
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              <TabsTrigger value="flow" className="relative">
                Flow JSON
                {hasBlockingErrors && (
                  <span className="ml-2 inline-block h-2 w-2 rounded-full bg-destructive" />
                )}
              </TabsTrigger>
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
                <div className="space-y-1">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={temperature}
                    onChange={(e) =>
                      setTemperature(parseFloat(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = deterministic, 1 = creative. 0.3 recommended.
                  </p>
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

              <div className="flex items-center gap-3 rounded-md border p-3">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <div className="flex-1">
                  <Label htmlFor="isActive">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive flows are ignored by the router even if the QR is
                    scanned.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ───── PROMPT ───── */}
            <TabsContent value="prompt" className="space-y-2 pt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <span className="text-xs text-muted-foreground">
                  Markdown · {systemPrompt.length} chars
                </span>
              </div>
              <div className="border rounded-md overflow-hidden">
                <Editor
                  height="420px"
                  defaultLanguage="markdown"
                  theme="vs-light"
                  value={systemPrompt}
                  onChange={(value) => setSystemPrompt(value || "")}
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
                Machine-specific instructions for this sub-LLM. Keep focused —
                mention machine model, behavior, edge cases. Leave the
                multi-language handling to the TranslationAgent.
              </p>
            </TabsContent>

            {/* ───── TOOLS ───── */}
            <TabsContent value="tools" className="space-y-3 pt-4">
              <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">Calling Functions</p>
                  <p className="text-xs text-muted-foreground">
                    Manage and define functions workspace-wide.
                  </p>
                </div>
                <Link
                  to="/settings?tab=calling-functions"
                  onClick={() => onOpenChange(false)}
                >
                  <Button type="button" variant="outline" size="sm">
                    Manage Functions
                    <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>

              <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">Agent Configuration</p>
                  <p className="text-xs text-muted-foreground">
                    Workspace-wide agent prompts and settings.
                  </p>
                </div>
                <Link to="/agents" onClick={() => onOpenChange(false)}>
                  <Button type="button" variant="outline" size="sm">
                    Open Agent Config
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>

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
                    {allFunctions.map((fn) => (
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
                            className="text-sm font-medium cursor-pointer"
                          >
                            {fn.functionName}
                            {fn.isSystemFunction && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-xs"
                              >
                                system
                              </Badge>
                            )}
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

            {/* ───── FLOW JSON ───── */}
            <TabsContent value="flow" className="space-y-3 pt-4">
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
            </TabsContent>
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
                disabled={isSaving || !!syntaxError || parsedFlows === null}
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
