/**
 * Agent Edit Slide Panel
 *
 * Compact slide panel for editing agent configuration.
 * Prompt editing is done via the fullscreen PromptEditorDialog.
 *
 * Features:
 * - Compact width (500px)
 * - Model, Temperature, Max Tokens settings
 * - Active/Inactive toggle
 * - No prompt editing (use Eye button for that)
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
import { Loader2, Save } from "lucide-react"
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
      <SheetContent side="right" className="w-[500px]">
        <SheetHeader>
          <SheetTitle>Edit Agent: {formData.name}</SheetTitle>
          <SheetDescription>
            Modify agent settings. Use the 👁️ button for prompt editing.
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
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google/gemini-2.0-flash-001">
                  Gemini 2.0 Flash (Best quality)
                </SelectItem>
                <SelectItem value="openai/gpt-4o-mini">
                  GPT-4o Mini
                </SelectItem>
                <SelectItem value="openai/gpt-4o">
                  GPT-4o
                </SelectItem>
                <SelectItem value="anthropic/claude-3.5-sonnet">
                  Claude 3.5 Sonnet
                </SelectItem>
                <SelectItem value="anthropic/claude-3.5-haiku">
                  Claude 3.5 Haiku
                </SelectItem>
                <SelectItem value="openai/gpt-4-turbo">
                  GPT-4 Turbo
                </SelectItem>
                <SelectItem value="deepseek/deepseek-r1">
                  DeepSeek R1
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Temperature & Max Tokens - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            {/* Temperature Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature">Temperature</Label>
                <span className="text-sm font-medium text-green-600">
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
                className="[&_[role=slider]]:bg-green-600"
              />
              <p className="text-xs text-muted-foreground">
                Lower = focused, Higher = creative
              </p>
            </div>

            {/* Max Tokens Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <span className="text-sm font-medium text-green-600">
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
                className="[&_[role=slider]]:bg-green-600"
              />
              <p className="text-xs text-muted-foreground">
                Max response length
              </p>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
            <div className="space-y-0.5">
              <Label htmlFor="isActive" className="text-base">Active Status</Label>
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
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
