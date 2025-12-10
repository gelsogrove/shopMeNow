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
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { Check, ChevronDown, ChevronRight, Code, Copy, Eye, FileText, Loader2, Save, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

// Variable categories for the sidebar panel
const VARIABLE_CATEGORIES = [
  {
    name: "Workspace",
    description: "Workspace configuration",
    variables: [
      { name: "workspaceName", desc: "Workspace name" },
      { name: "workspaceUrl", desc: "Workspace URL" },
      { name: "toneOfVoice", desc: "Bot tone of voice" },
      { name: "botIdentityResponse", desc: "Bot identity response" },
      { name: "language", desc: "Primary language" },
      { name: "currency", desc: "Currency (EUR, USD...)" },
      { name: "sellsProductsAndServices", desc: "Sells products/services (bool)" },
      { name: "hasHumanSupport", desc: "Has human support (bool)" },
      { name: "hasSalesAgents", desc: "Has sales agents (bool)" },
      { name: "hasSuppliers", desc: "Has suppliers (bool)" },
      { name: "humanSupportInstructions", desc: "Human support instructions" },
      { name: "operatorContactMethod", desc: "Operator contact method" },
      { name: "operatorWhatsappNumber", desc: "Operator WhatsApp number" },
      { name: "allowedExternalLinks", desc: "Allowed external links" },
      { name: "customAiRules", desc: "Custom AI rules" },
      { name: "adminEmail", desc: "Admin email" },
      { name: "address", desc: "Workspace address" },
    ],
  },
  {
    name: "Customer",
    description: "Customer data",
    variables: [
      { name: "customerName", desc: "Customer name" },
      { name: "customerEmail", desc: "Customer email" },
      { name: "customerPhone", desc: "Customer phone" },
      { name: "customerDiscount", desc: "Customer discount %" },
      { name: "pushNotificationsConsent", desc: "Push notifications consent (bool)" },
      { name: "languageUser", desc: "Customer language" },
      { name: "lastOrderCode", desc: "Last order code" },
    ],
  },
  {
    name: "Sales Agent",
    description: "Assigned sales agent data",
    variables: [
      { name: "agentName", desc: "Agent name" },
      { name: "agentPhone", desc: "Agent phone" },
      { name: "agentEmail", desc: "Agent email" },
    ],
  },
  {
    name: "Dynamic Data",
    description: "Content from database",
    variables: [
      { name: "products", desc: "Active products list" },
      { name: "services", desc: "Active services list" },
      { name: "categories", desc: "Available categories" },
      { name: "offers", desc: "Active offers" },
      { name: "faq", desc: "Frequently asked questions" },
      { name: "lastOrder", desc: "Last order details" },
    ],
  },
  {
    name: "Counters",
    description: "Numbers and statistics",
    variables: [
      { name: "faqCount", desc: "FAQ count" },
      { name: "productsCount", desc: "Products count" },
      { name: "offersActive", desc: "Active offers count" },
    ],
  },
]

const CONDITIONAL_SYNTAX = [
  { syntax: "{{#if variable}}...{{/if}}", desc: "If variable is true/present" },
  { syntax: "{{#unless variable}}...{{/unless}}", desc: "If variable is false/absent" },
  { syntax: "{{else}}", desc: "Otherwise (inside if/unless)" },
]

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Workspace", "Dynamic Data"]))
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset prompt when dialog opens with new agent
  useEffect(() => {
    if (open) {
      setPrompt(initialPrompt)
      setActiveTab("edit")
    }
  }, [open, initialPrompt])

  // Save handler
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await onSave(prompt)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save prompt:", error)
    } finally {
      setIsSaving(false)
    }
  }, [prompt, onSave, onOpenChange])

  // Handle Tab key to insert spaces instead of changing focus
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget
    
    // Tab key - insert 2 spaces
    if (e.key === "Tab") {
      e.preventDefault()
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      
      // Insert 2 spaces at cursor position
      const newValue = prompt.substring(0, start) + "  " + prompt.substring(end)
      setPrompt(newValue)
      
      // Move cursor after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
    
    // Ctrl+S or Cmd+S - save
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault()
      if (!isSaving) {
        handleSave()
      }
    }
  }, [prompt, isSaving, handleSave])

  // Toggle category expansion
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName)
      } else {
        newSet.add(categoryName)
      }
      return newSet
    })
  }

  // Copy variable to clipboard
  const copyVariable = async (variableName: string) => {
    const textToCopy = `{{${variableName}}}`
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopiedVariable(variableName)
      toast.success(`Copied: ${textToCopy}`)
      setTimeout(() => setCopiedVariable(null), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  // Copy conditional syntax
  const copySyntax = async (syntax: string) => {
    try {
      await navigator.clipboard.writeText(syntax)
      toast.success(`Copied: ${syntax}`)
    } catch {
      toast.error("Failed to copy")
    }
  }

  const handleCancel = () => {
    setPrompt(initialPrompt)
    onOpenChange(false)
  }

  // Enhanced preview with conditional block visualization
  const renderPreview = () => {
    const lines = prompt.split("\n")
    const elements: JSX.Element[] = []
    let conditionalStack: { type: "if" | "unless"; variable: string; depth: number }[] = []
    let currentDepth = 0
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      
      // Detect {{#if variable}}
      const ifMatch = trimmedLine.match(/^\{\{#if\s+(\w+)\}\}$/)
      if (ifMatch) {
        conditionalStack.push({ type: "if", variable: ifMatch[1], depth: currentDepth })
        elements.push(
          <div 
            key={index} 
            className="flex items-center gap-2 my-2 py-1 px-3 bg-blue-50 border-l-4 border-blue-400 rounded-r"
            style={{ marginLeft: `${currentDepth * 16}px` }}
          >
            <Code className="h-4 w-4 text-blue-600" />
            <span className="text-blue-700 font-mono text-sm">
              IF <span className="font-semibold text-blue-900">{ifMatch[1]}</span> is true:
            </span>
          </div>
        )
        currentDepth++
        return
      }
      
      // Detect {{#unless variable}}
      const unlessMatch = trimmedLine.match(/^\{\{#unless\s+(\w+)\}\}$/)
      if (unlessMatch) {
        conditionalStack.push({ type: "unless", variable: unlessMatch[1], depth: currentDepth })
        elements.push(
          <div 
            key={index} 
            className="flex items-center gap-2 my-2 py-1 px-3 bg-orange-50 border-l-4 border-orange-400 rounded-r"
            style={{ marginLeft: `${currentDepth * 16}px` }}
          >
            <Code className="h-4 w-4 text-orange-600" />
            <span className="text-orange-700 font-mono text-sm">
              UNLESS <span className="font-semibold text-orange-900">{unlessMatch[1]}</span> (if false):
            </span>
          </div>
        )
        currentDepth++
        return
      }
      
      // Detect {{else}}
      if (trimmedLine === "{{else}}") {
        const current = conditionalStack[conditionalStack.length - 1]
        elements.push(
          <div 
            key={index} 
            className="flex items-center gap-2 my-2 py-1 px-3 bg-gray-100 border-l-4 border-gray-400 rounded-r"
            style={{ marginLeft: `${Math.max(0, currentDepth - 1) * 16}px` }}
          >
            <Code className="h-4 w-4 text-gray-600" />
            <span className="text-gray-700 font-mono text-sm">
              ELSE ({current?.variable ? `${current.variable} is ${current.type === "if" ? "false" : "true"}` : "otherwise"}):
            </span>
          </div>
        )
        return
      }
      
      // Detect {{/if}} or {{/unless}}
      if (trimmedLine === "{{/if}}" || trimmedLine === "{{/unless}}") {
        const popped = conditionalStack.pop()
        currentDepth = Math.max(0, currentDepth - 1)
        elements.push(
          <div 
            key={index} 
            className="flex items-center gap-2 my-1 py-0.5 px-3 text-gray-400 text-xs"
            style={{ marginLeft: `${currentDepth * 16}px` }}
          >
            <span className="font-mono">END {popped?.type?.toUpperCase() || "BLOCK"}</span>
          </div>
        )
        return
      }
      
      // Calculate indentation for content inside conditionals
      const indent = currentDepth * 16
      
      // Headers
      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={index} className="text-2xl font-bold text-green-700 mt-4 mb-2" style={{ marginLeft: `${indent}px` }}>
            {formatInlineText(line.substring(2))}
          </h1>
        )
        return
      }
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={index} className="text-xl font-semibold text-green-600 mt-3 mb-2" style={{ marginLeft: `${indent}px` }}>
            {formatInlineText(line.substring(3))}
          </h2>
        )
        return
      }
      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={index} className="text-lg font-medium text-gray-800 mt-2 mb-1" style={{ marginLeft: `${indent}px` }}>
            {formatInlineText(line.substring(4))}
          </h3>
        )
        return
      }
      
      // Bullet points
      if (line.trimStart().startsWith("- ") || line.trimStart().startsWith("* ")) {
        const content = line.trimStart().substring(2)
        elements.push(
          <div key={index} className="flex items-start gap-2 my-0.5" style={{ marginLeft: `${indent + 16}px` }}>
            <span className="text-green-600 mt-1">•</span>
            <span>{formatInlineText(content)}</span>
          </div>
        )
        return
      }
      
      // Numbered lists
      const numberedMatch = line.trimStart().match(/^(\d+)\.\s(.+)/)
      if (numberedMatch) {
        elements.push(
          <div key={index} className="flex items-start gap-2 my-0.5" style={{ marginLeft: `${indent + 16}px` }}>
            <span className="text-green-600 font-medium min-w-[20px]">{numberedMatch[1]}.</span>
            <span>{formatInlineText(numberedMatch[2])}</span>
          </div>
        )
        return
      }
      
      // Code blocks
      if (trimmedLine.startsWith("```")) {
        elements.push(
          <div key={index} className="bg-gray-100 px-2 py-1 font-mono text-sm rounded mt-2" style={{ marginLeft: `${indent}px` }} />
        )
        return
      }
      
      // Empty lines
      if (trimmedLine === "") {
        elements.push(<div key={index} className="h-2" />)
        return
      }
      
      // Regular paragraph (with conditional background if inside a block)
      const bgClass = currentDepth > 0 ? "bg-gray-50/50" : ""
      elements.push(
        <p key={index} className={`my-1 leading-relaxed ${bgClass}`} style={{ marginLeft: `${indent}px` }}>
          {formatInlineText(line)}
        </p>
      )
    })
    
    return <div className="prose prose-sm max-w-none dark:prose-invert">{elements}</div>
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
            Edit the system prompt for this agent. <span className="text-gray-500">Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Tab</kbd> to indent, <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">⌘S</kbd> to save.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Main Editor/Preview Area */}
          <div className="flex-1 flex flex-col min-h-0">
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
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-full min-h-[60vh] font-mono text-sm leading-relaxed resize-none tabular-nums"
                  placeholder="Enter the system prompt for this agent..."
                  spellCheck={false}
                />
              </TabsContent>

              <TabsContent value="preview" className="flex-1 mt-4 overflow-auto border rounded-lg p-6 bg-white min-h-0">
                {renderPreview()}
              </TabsContent>
            </Tabs>
          </div>

          {/* Variables Sidebar Panel */}
          <div className="w-72 flex-shrink-0 border-l pl-4">
            <div className="sticky top-0">
              <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Available Variables
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Click to copy
              </p>
              
              <ScrollArea className="h-[calc(95vh-280px)]">
                <div className="space-y-2 pr-3">
                  {/* Variable Categories */}
                  {VARIABLE_CATEGORIES.map((category) => (
                    <div key={category.name} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleCategory(category.name)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left"
                      >
                        <div>
                          <span className="font-medium text-sm text-gray-800">{category.name}</span>
                          <span className="text-xs text-gray-500 ml-2">({category.variables.length})</span>
                        </div>
                        {expandedCategories.has(category.name) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                      
                      {expandedCategories.has(category.name) && (
                        <div className="p-2 space-y-1 bg-white">
                          {category.variables.map((variable) => (
                            <button
                              key={variable.name}
                              onClick={() => copyVariable(variable.name)}
                              className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-green-50 text-left group transition-colors"
                              title={variable.desc}
                            >
                              <div className="flex-1 min-w-0">
                                <code className="text-xs font-mono text-green-700 bg-green-50 px-1 rounded">
                                  {`{{${variable.name}}}`}
                                </code>
                                <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                  {variable.desc}
                                </p>
                              </div>
                              {copiedVariable === variable.name ? (
                                <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0 ml-1" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0 ml-1" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Conditional Syntax Section */}
                  <div className="border rounded-lg overflow-hidden mt-4">
                    <div className="px-3 py-2 bg-blue-50">
                      <span className="font-medium text-sm text-blue-800">Conditional Syntax</span>
                    </div>
                    <div className="p-2 space-y-1 bg-white">
                      {CONDITIONAL_SYNTAX.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => copySyntax(item.syntax)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-blue-50 text-left group transition-colors"
                          title={item.desc}
                        >
                          <div className="flex-1 min-w-0">
                            <code className="text-xs font-mono text-blue-700 break-all">
                              {item.syntax}
                            </code>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {item.desc}
                            </p>
                          </div>
                          <Copy className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0 ml-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <div className="flex items-center gap-2 w-full justify-end">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
