/**
 * Prompt Editor Dialog
 *
 * Fullscreen dialog for editing agent prompts with better readability.
 * Split view: Editor on left, Preview on right.
 *
 * Features:
 * - Fullscreen modal for maximum editing space
 * - Monospace font for code-like content
 * - Line numbers (optional)
 * - Save only the prompt (not the whole agent)
 * - Markdown-style formatting hints
 */

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Eye, FileText, Loader2, Save, X } from "lucide-react"
import { useEffect, useState } from "react"

interface PromptEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentName: string
  agentType: string
  initialPrompt: string
  onSave: (newPrompt: string) => Promise<void>
}

export function PromptEditorDialog({
  open,
  onOpenChange,
  agentName,
  agentType,
  initialPrompt,
  onSave,
}: PromptEditorDialogProps) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit")

  // Reset prompt when dialog opens with new agent
  useEffect(() => {
    if (open) {
      setPrompt(initialPrompt)
      setActiveTab("edit")
    }
  }, [open, initialPrompt])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(prompt)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save prompt:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setPrompt(initialPrompt)
    onOpenChange(false)
  }

  // Simple markdown-like preview (basic formatting)
  const renderPreview = () => {
    // Split by lines and process each
    const lines = prompt.split("\n")
    
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        {lines.map((line, index) => {
          // Headers
          if (line.startsWith("# ")) {
            return (
              <h1 key={index} className="text-2xl font-bold text-green-700 mt-4 mb-2">
                {line.substring(2)}
              </h1>
            )
          }
          if (line.startsWith("## ")) {
            return (
              <h2 key={index} className="text-xl font-semibold text-green-600 mt-3 mb-2">
                {line.substring(3)}
              </h2>
            )
          }
          if (line.startsWith("### ")) {
            return (
              <h3 key={index} className="text-lg font-medium text-gray-800 mt-2 mb-1">
                {line.substring(4)}
              </h3>
            )
          }
          
          // Bullet points
          if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
              <div key={index} className="flex items-start gap-2 ml-4 my-0.5">
                <span className="text-green-600 mt-1">•</span>
                <span>{formatInlineText(line.substring(2))}</span>
              </div>
            )
          }
          
          // Numbered lists
          const numberedMatch = line.match(/^(\d+)\.\s(.+)/)
          if (numberedMatch) {
            return (
              <div key={index} className="flex items-start gap-2 ml-4 my-0.5">
                <span className="text-green-600 font-medium min-w-[20px]">{numberedMatch[1]}.</span>
                <span>{formatInlineText(numberedMatch[2])}</span>
              </div>
            )
          }
          
          // Code blocks (simple detection)
          if (line.startsWith("```")) {
            return <div key={index} className="bg-gray-100 px-2 py-1 font-mono text-sm rounded mt-2" />
          }
          
          // Empty lines
          if (line.trim() === "") {
            return <div key={index} className="h-2" />
          }
          
          // Regular paragraph
          return (
            <p key={index} className="my-1 leading-relaxed">
              {formatInlineText(line)}
            </p>
          )
        })}
      </div>
    )
  }

  // Format inline text (bold, italic, code, emoji)
  const formatInlineText = (text: string) => {
    // Simple regex replacements for inline formatting
    const parts: (string | JSX.Element)[] = []
    let remaining = text
    let keyIndex = 0

    // Process **bold**
    while (remaining.includes("**")) {
      const start = remaining.indexOf("**")
      const end = remaining.indexOf("**", start + 2)
      if (end === -1) break

      if (start > 0) {
        parts.push(remaining.substring(0, start))
      }
      parts.push(
        <strong key={`bold-${keyIndex++}`} className="font-bold text-gray-900">
          {remaining.substring(start + 2, end)}
        </strong>
      )
      remaining = remaining.substring(end + 2)
    }

    // Process `code`
    if (remaining.includes("`")) {
      const tempParts: (string | JSX.Element)[] = []
      let tempRemaining = remaining
      
      while (tempRemaining.includes("`")) {
        const start = tempRemaining.indexOf("`")
        const end = tempRemaining.indexOf("`", start + 1)
        if (end === -1) break

        if (start > 0) {
          tempParts.push(tempRemaining.substring(0, start))
        }
        tempParts.push(
          <code key={`code-${keyIndex++}`} className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-pink-600">
            {tempRemaining.substring(start + 1, end)}
          </code>
        )
        tempRemaining = tempRemaining.substring(end + 1)
      }
      
      if (tempRemaining) {
        tempParts.push(tempRemaining)
      }
      
      if (tempParts.length > 0) {
        parts.push(...tempParts)
        remaining = ""
      }
    }

    if (remaining) {
      parts.push(remaining)
    }

    return parts.length > 0 ? parts : text
  }

  // Count lines and characters
  const lineCount = prompt.split("\n").length
  const charCount = prompt.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            <span>System Prompt: {agentName}</span>
            <span className="text-sm font-normal text-gray-500">({agentType})</span>
          </DialogTitle>
          <DialogDescription>
            Edit the system prompt for this agent. Use Markdown formatting for better readability.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "preview")} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between flex-shrink-0">
            <TabsList>
              <TabsTrigger value="edit" className="gap-2">
                <FileText className="h-4 w-4" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>
            
            <div className="text-sm text-gray-500">
              {lineCount} lines • {charCount.toLocaleString()} characters
            </div>
          </div>

          <TabsContent value="edit" className="flex-1 mt-4 min-h-0">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-full min-h-[60vh] font-mono text-sm leading-relaxed resize-none"
              placeholder="Enter the system prompt for this agent..."
              spellCheck={false}
            />
          </TabsContent>

          <TabsContent value="preview" className="flex-1 mt-4 overflow-auto border rounded-lg p-6 bg-white min-h-0">
            {renderPreview()}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <div className="flex items-center gap-2 w-full justify-between">
            <div className="text-xs text-gray-400">
              💡 Tip: Use **bold**, `code`, # headers, and - bullet points for better formatting
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Prompt
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
