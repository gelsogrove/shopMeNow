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
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { callingFunctionsApi, CallingFunction } from "@/services/callingFunctionApi"
import {
  FlowConfig,
  CreateFlowConfigData,
  UpdateFlowConfigData,
  flowConfigApi,
} from "@/services/flowConfigApi"
import { useEffect, useState } from "react"

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

  const [flowKey, setFlowKey] = useState("")
  const [flowLabel, setFlowLabel] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [model, setModel] = useState("openai/gpt-4o-mini")
  const [temperature, setTemperature] = useState(0.3)
  const [maxTokens, setMaxTokens] = useState(500)
  const [flowsJson, setFlowsJson] = useState("{}")
  const [flowsError, setFlowsError] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  // Available functions from workspace calling functions
  const [allFunctions, setAllFunctions] = useState<CallingFunction[]>([])
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([])

  // Load calling functions list when workspace changes
  useEffect(() => {
    if (!workspaceId) return
    callingFunctionsApi.list(workspaceId).then(setAllFunctions).catch(() => {
      // Non-critical: silently fail (no functions will be shown)
    })
  }, [workspaceId])

  // Populate form when editing an existing config
  useEffect(() => {
    if (config) {
      setFlowKey(config.flowKey)
      setFlowLabel(config.flowLabel)
      setSystemPrompt(config.systemPrompt || "")
      setModel(config.model || "openai/gpt-4o-mini")
      setTemperature(config.temperature ?? 0.3)
      setMaxTokens(config.maxTokens ?? 500)
      setFlowsJson(
        config.flows ? JSON.stringify(config.flows, null, 2) : "{}"
      )
      setFlowsError(null)
      setIsActive(config.isActive)
      // Load selected functions from config
      const funcs = config.availableFunctions
      if (Array.isArray(funcs)) {
        setSelectedFunctions(funcs as string[])
      } else {
        setSelectedFunctions([])
      }
    } else {
      // Reset for new config
      setFlowKey("")
      setFlowLabel("")
      setSystemPrompt("")
      setModel("openai/gpt-4o-mini")
      setTemperature(0.3)
      setMaxTokens(500)
      setFlowsJson("{}")
      setFlowsError(null)
      setIsActive(true)
      setSelectedFunctions([])
    }
  }, [config, open])

  const validateFlowsJson = (value: string): boolean => {
    if (!value.trim()) {
      setFlowsError(null)
      return true
    }
    try {
      JSON.parse(value)
      setFlowsError(null)
      return true
    } catch {
      setFlowsError("Invalid JSON — please fix before saving")
      return false
    }
  }

  const handleFlowsChange = (value: string) => {
    setFlowsJson(value)
    validateFlowsJson(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Block save if flows JSON is invalid
    if (!validateFlowsJson(flowsJson)) {
      toast.error("Please fix the JSON validation error before saving")
      return
    }

    let parsedFlows: any = {}
    try {
      parsedFlows = flowsJson.trim() ? JSON.parse(flowsJson) : {}
    } catch {
      toast.error("Invalid JSON in flows field")
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
      toast.error(error.message || "Failed to save flow config")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[90%] sm:w-[600px] md:w-[75%] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Edit Flow Config" : "Add Flow Config"}
          </SheetTitle>
          <SheetDescription>
            Configure a flow for a specific machine or troubleshooting scenario.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Flow Key — read-only in edit mode */}
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
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                Flow key cannot be changed after creation.
              </p>
            )}
          </div>

          {/* Flow Label */}
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

          {/* Model */}
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
              This LLM is used exclusively for this flow (independent of the workspace default model).
            </p>
          </div>

          {/* Temperature + MaxTokens */}
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
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min={50}
                max={4000}
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          {/* System Prompt */}
          <div className="space-y-1">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter the system prompt for this flow agent..."
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {/* Flows JSON */}
          <div className="space-y-1">
            <Label htmlFor="flowsJson">Flows (JSON)</Label>
            <p className="text-xs text-muted-foreground">
              Decision tree definition. Top-level keys are flow IDs (e.g. <code className="font-mono bg-muted px-1 rounded">non_parte</code>), each containing nodes keyed by node ID starting from <code className="font-mono bg-muted px-1 rounded">step_0</code>.
            </p>
            <Textarea
              id="flowsJson"
              value={flowsJson}
              onChange={(e) => handleFlowsChange(e.target.value)}
              placeholder='{ "non_parte": { "step_0": { "type": "CHOICE", "prompt": "..." } } }'
              rows={12}
              className="font-mono text-sm"
            />
            {flowsError && (
              <p className="text-sm text-destructive">{flowsError}</p>
            )}
          </div>

          {/* Available Functions */}
          <div className="space-y-2">
            <Label>Available Functions</Label>
            <p className="text-xs text-muted-foreground">
              Select which calling functions this flow agent can invoke.
            </p>
            {allFunctions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No calling functions found for this workspace.
              </p>
            ) : (
              <div className="space-y-2 rounded-md border p-3">
                {allFunctions.map((fn) => (
                  <div key={fn.functionName} className="flex items-start gap-3">
                    <Checkbox
                      id={`fn-${fn.functionName}`}
                      checked={selectedFunctions.includes(fn.functionName)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedFunctions((prev) => [...prev, fn.functionName])
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
                          <Badge variant="outline" className="ml-2 text-xs">
                            system
                          </Badge>
                        )}
                      </label>
                      {fn.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {fn.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* isActive toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !!flowsError}>
              {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
