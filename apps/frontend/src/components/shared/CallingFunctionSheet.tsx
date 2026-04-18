/**
 * CallingFunctionSheet — Sheet panel for creating calling functions from the Agent Flow Diagram.
 *
 * Provides a simplified form for creating custom calling functions directly
 * from the diagram's "Add" popover, without navigating to Settings > Custom Tools.
 *
 * Fields: functionName, description, executionType (WEBHOOK/INTERNAL/DELEGATE_TO_AGENT),
 * parameters (JSON), webhookUrl (conditional), responseInstructions.
 *
 * Backend FlowSyncService handles cascade: DELEGATE_TO_AGENT auto-added to Router.
 */

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"
import { logger } from "@/lib/logger"
import { callingFunctionsApi } from "@/services/callingFunctionApi"
import { Loader2, Wrench, Globe, Cpu, Sparkles } from "lucide-react"

interface CallingFunctionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onSaved: () => void
}

export function CallingFunctionSheet({
  open,
  onOpenChange,
  workspaceId,
  onSaved,
}: CallingFunctionSheetProps) {
  const [saving, setSaving] = useState(false)
  const [functionName, setFunctionName] = useState("")
  const [description, setDescription] = useState("")
  const [executionType, setExecutionType] = useState<"INTERNAL" | "WEBHOOK" | "DELEGATE_TO_AGENT">("INTERNAL")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [responseInstructions, setResponseInstructions] = useState("")

  const resetForm = () => {
    setFunctionName("")
    setDescription("")
    setExecutionType("INTERNAL")
    setWebhookUrl("")
    setResponseInstructions("")
  }

  const handleSave = async () => {
    if (!functionName.trim()) {
      toast.error("Function name is required")
      return
    }
    if (!description.trim()) {
      toast.error("Description is required")
      return
    }
    if (executionType === "WEBHOOK" && !webhookUrl.trim()) {
      toast.error("Webhook URL is required for WEBHOOK type")
      return
    }

    setSaving(true)
    try {
      await callingFunctionsApi.create(workspaceId, {
        functionName: functionName.trim(),
        description: description.trim(),
        executionType,
        parameters: { type: "object", properties: {} },
        isActive: true,
        webhookUrl: executionType === "WEBHOOK" ? webhookUrl.trim() : null,
        responseInstructions: responseInstructions.trim() || null,
      })

      toast.success(`Calling function "${functionName}" created`)
      resetForm()
      onSaved()
    } catch (error: any) {
      logger.error("Failed to create calling function:", error)
      if (error?.response?.status === 409) {
        toast.error("A function with this name already exists")
      } else {
        toast.error("Failed to create calling function")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetForm()
    onOpenChange(isOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            New Calling Function
          </SheetTitle>
          <SheetDescription>
            Create a custom tool that agents can invoke during conversations.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Function Name */}
          <div className="space-y-2">
            <Label htmlFor="cf-name">Function Name</Label>
            <Input
              id="cf-name"
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder="myCustomFunction"
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-gray-500">camelCase, no spaces. This is the identifier used by the AI.</p>
          </div>

          {/* Execution Type */}
          <div className="space-y-2">
            <Label>Execution Type</Label>
            <Select value={executionType} onValueChange={(v) => setExecutionType(v as "INTERNAL" | "WEBHOOK" | "DELEGATE_TO_AGENT")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNAL">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 text-blue-500" />
                    <span>Internal Logic</span>
                  </div>
                </SelectItem>
                <SelectItem value="WEBHOOK">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-green-500" />
                    <span>Webhook (External API)</span>
                  </div>
                </SelectItem>
                <SelectItem value="DELEGATE_TO_AGENT">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    <span>Delegate to Agent</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="cf-desc">Description</Label>
            <Textarea
              id="cf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this function does — the AI reads this to decide when to call it."
              rows={3}
            />
          </div>

          {/* Webhook URL (conditional) */}
          {executionType === "WEBHOOK" && (
            <div className="space-y-2">
              <Label htmlFor="cf-webhook">Webhook URL</Label>
              <Input
                id="cf-webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.example.com/webhook"
                type="url"
              />
            </div>
          )}

          {/* Response Instructions (optional) */}
          <div className="space-y-2">
            <Label htmlFor="cf-instructions">
              Response Instructions <span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="cf-instructions"
              value={responseInstructions}
              onChange={(e) => setResponseInstructions(e.target.value)}
              placeholder="How the AI should present the result to the user..."
              rows={2}
            />
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !functionName.trim() || !description.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Function"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
