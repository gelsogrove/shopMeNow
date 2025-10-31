/**
 * Agent Edit Slide Panel
 *
 * Slide panel from right to left for editing agent configuration.
 * Wide layout similar to Orders page.
 *
 * Features:
 * - Slides in from right
 * - Wide layout (800px)
 * - Full agent edit form
 * - Save/Cancel actions
 */

import { Button } from "@/components/ui/button"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

interface Agent {
  id: string
  name: string
  systemPrompt: string
  temperature: number
  model: string
  maxTokens: number
  isActive: boolean
  order: number
  agentType: string
  icon?: string
}

interface AgentEditSlidePanelProps {
  agent: Agent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (agent: Agent) => Promise<void>
}

export function AgentEditSlidePanel({
  agent,
  open,
  onOpenChange,
  onSave,
}: AgentEditSlidePanelProps) {
  const [formData, setFormData] = useState<Agent | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Update form data when agent changes
  useEffect(() => {
    if (agent) {
      setFormData({ ...agent })
    }
  }, [agent])

  const handleSave = async () => {
    if (!formData) return

    setIsSaving(true)
    try {
      await onSave(formData)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save agent:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData(agent ? { ...agent } : null)
    onOpenChange(false)
  }

  if (!formData) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[1000px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Agent: {formData.name}</SheetTitle>
          <SheetDescription>
            Modify agent configuration, prompt, and behavior settings
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Agent Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Agent Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter agent name"
            />
          </div>

          {/* Agent Type (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="type">Agent Type</Label>
            <Input
              id="type"
              value={formData.agentType}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Agent type cannot be changed
            </p>
          </div>

          {/* Model, Temperature, Max Tokens - 3 columns on same row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model">LLM Model</Label>
              <Select
                value={formData.model}
                onValueChange={(value) =>
                  setFormData({ ...formData, model: value })
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {formData.model === "openrouter/google/gemini-2.0-flash-001"
                      ? "Gemini 2.0 Flash"
                      : formData.model ===
                        "openrouter/anthropic/claude-3.5-sonnet"
                      ? "Claude 3.5 Sonnet"
                      : formData.model === "openrouter/openai/gpt-4o-mini"
                      ? "GPT-4o Mini"
                      : formData.model === "openrouter/openai/gpt-4o"
                      ? "GPT-4o"
                      : formData.model ===
                        "openrouter/meta-llama/llama-3.1-70b-instruct"
                      ? "Llama 3.1 70B"
                      : formData.model}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter/google/gemini-2.0-flash-001">
                    Gemini 2.0 Flash
                  </SelectItem>
                  <SelectItem value="openrouter/anthropic/claude-3.5-sonnet">
                    Claude 3.5 Sonnet
                  </SelectItem>
                  <SelectItem value="openrouter/openai/gpt-4o-mini">
                    GPT-4o Mini
                  </SelectItem>
                  <SelectItem value="openrouter/openai/gpt-4o">
                    GPT-4o
                  </SelectItem>
                  <SelectItem value="openrouter/meta-llama/llama-3.1-70b-instruct">
                    Llama 3.1 70B
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Temperature Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature">Temperature</Label>
                <span className="text-sm font-medium">
                  {formData.temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                id="temperature"
                min={0}
                max={1}
                step={0.1}
                value={[formData.temperature]}
                onValueChange={([value]) =>
                  setFormData({ ...formData, temperature: value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Lower = more focused, Higher = more creative
              </p>
            </div>

            {/* Max Tokens Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <span className="text-sm font-medium">
                  {formData.maxTokens}
                </span>
              </div>
              <Slider
                id="maxTokens"
                min={100}
                max={4096}
                step={100}
                value={[formData.maxTokens]}
                onValueChange={([value]) =>
                  setFormData({ ...formData, maxTokens: value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum response length (tokens)
              </p>
            </div>
          </div>

          {/* Order */}
          <div className="space-y-2">
            <Label htmlFor="order">Display Order</Label>
            <Input
              id="order"
              type="number"
              value={formData.order}
              onChange={(e) =>
                setFormData({ ...formData, order: parseInt(e.target.value) })
              }
              min={1}
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Active Status</Label>
              <p className="text-xs text-muted-foreground">
                Enable or disable this agent
              </p>
            </div>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isActive: checked })
              }
            />
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={formData.systemPrompt}
              onChange={(e) =>
                setFormData({ ...formData, systemPrompt: e.target.value })
              }
              rows={12}
              className="font-mono text-sm"
              placeholder="Enter system prompt for this agent..."
            />
            <p className="text-xs text-muted-foreground">
              Instructions that define agent behavior and personality
            </p>
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
