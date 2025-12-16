/**
 * Agent Configuration Dashboard
 *
 * Unified interface for managing all LLM agents in the multi-agent system.
 * Clickable rows that open a slide panel for editing.
 *
 * Features:
 * - Clickable agent rows with hover effect
 * - Slide panel from right for full agent editing
 * - Fullscreen prompt editor dialog for better readability
 * - Call functions list showing which functions each agent can use
 * - Respects agent order (Router Agent always first)
 *
 * @architecture Clean Component with shadcn/ui Sheet + Dialog
 */

import { PageLayout } from "@/components/layout/PageLayout"
import { AgentEditSlidePanel } from "@/components/shared/AgentEditSlidePanel"
import { PageHeader } from "@/components/shared/PageHeader"
import { PromptEditorDialog } from "@/components/shared/PromptEditorDialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import {
  exportAgentPrompts,
  getAgentConfigs,
  resetAgentPromptsToDefaults,
  updateAgentConfig,
} from "@/services/agent-config-api"
import { Agent, getAgents } from "@/services/agents-legacy-api"
import {
  Bell,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Download,
  Edit,
  Eye,
  FileText,
  GitBranch,
  Globe,
  Headphones,
  Loader2,
  LucideIcon,
  Package,
  RefreshCcw,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  User,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

interface AgentFormData {
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

// Map icon name from database to Lucide icon component
const iconMap: Record<string, LucideIcon> = {
  GitBranch,
  Search,
  ShoppingCart,
  Package,
  Headphones,
  Shield,
  Brain,
  Settings,
  Bot,
  User,
  Bell,
  FileText,
  Globe, // Translation Agent icon
}

// Get icon component from database icon name with colorful background
// 🎨 ALIGNED WITH MessageFlowDialog colors
const getAgentIcon = (iconName: string | undefined, agentType: string) => {
  // Normalize agent type
  const normalizedType = agentType.toLowerCase().replace(/_/g, "_")

  // Icon mapping based on agent type - SAME AS MESSAGE FLOW TIMELINE
  const iconByType: Record<string, LucideIcon> = {
    router: GitBranch,
    product_search: Search,
    cart_management: ShoppingCart,
    order_tracking: Package,
    customer_support: Headphones,
    summary_agent: FileText,
    profile_management: User,
    translation: Globe, // 🌐 Globe for Translation (not Shield)
    security: Shield,
    safety_translation: Shield,
  }

  // Use type-based icon, fallback to database icon, then Settings
  const Icon = iconByType[normalizedType] || (iconName && iconMap[iconName] ? iconMap[iconName] : Settings)

  // Color mapping based on agent type - EXACT SAME AS MESSAGE FLOW TIMELINE
  // Using hex colors converted to Tailwind classes
  const colorConfig: Record<string, { bg: string }> = {
    router: { bg: "bg-[#9333EA]" }, // Purple #9333EA
    product_search: { bg: "bg-[#3B82F6]" }, // Blue #3B82F6
    cart_management: { bg: "bg-[#10B981]" }, // Green #10B981
    order_tracking: { bg: "bg-[#F97316]" }, // Orange #F97316
    customer_support: { bg: "bg-[#EC4899]" }, // Pink #EC4899
    summary_agent: { bg: "bg-[#F472B6]" }, // Light Pink #F472B6
    profile_management: { bg: "bg-[#64748B]" }, // Slate #64748B
    translation: { bg: "bg-[#14B8A6]" }, // Teal #14B8A6 (NOT red!)
    security: { bg: "bg-[#DC2626]" }, // Red #DC2626
    safety_translation: { bg: "bg-[#DC2626]" }, // Red #DC2626
  }

  const colors = colorConfig[normalizedType] || { bg: "bg-gray-600" }

  return (
    <div className={`${colors.bg} p-2.5 rounded-full shadow-md`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
  )
}

// Agent type to color mapping for text - ALL GREEN
const getAgentColor = (agentType: string) => {
  // Tutti i titoli VERDI come richiesto da Andrea
  return "text-green-600"
}

export function AgentConfigurationPage() {
  const { workspace } = useWorkspace()
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentFunctions, setAgentFunctions] = useState<
    Record<string, string[]>
  >({}) // ✅ Real functions from API
  const [isLoading, setIsLoading] = useState(true)
  const [editingAgents, setEditingAgents] = useState<
    Record<string, AgentFormData>
  >({})
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [isSlideOpen, setIsSlideOpen] = useState(false)
  
  // Prompt Editor Dialog state
  const [promptEditorAgent, setPromptEditorAgent] = useState<Agent | null>(null)
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false)

  // Reset confirmation dialog state
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [useDynamicTemplates, setUseDynamicTemplates] = useState(true) // 🆕 Default to dynamic templates

  // Redirect if no workspace
  useEffect(() => {
    if (!workspace) {
      logger.info("No workspace found in AgentConfigurationPage, redirecting")
      navigate("/clients")
    }
  }, [workspace, navigate])

  // Load all agents
  useEffect(() => {
    const loadAgents = async () => {
      if (!workspace?.id) return

      try {
        setIsLoading(true)
        logger.info("Loading agents for workspace:", workspace.id)

        // ✅ Load agents AND their real available functions from database
        const [agentsData, configsData] = await Promise.all([
          getAgents(workspace.id),
          getAgentConfigs(workspace.id),
        ])

        // Sort by order field (Router Agent first with order=0)
        const sortedAgents = agentsData.sort((a, b) => a.order - b.order)
        setAgents(sortedAgents)

        // ✅ Map availableFunctions from database to agentId
        const functionsMap: Record<string, string[]> = {}
        configsData.agents.forEach((config) => {
          functionsMap[config.id] = config.availableFunctions || []
        })
        setAgentFunctions(functionsMap)
        logger.info("Agent functions loaded from database:", functionsMap)

        // Initialize editing state
        const initialEditing: Record<string, AgentFormData> = {}
        sortedAgents.forEach((agent) => {
          initialEditing[agent.id] = {
            id: agent.id,
            name: agent.name,
            systemPrompt: agent.content || "",
            temperature: agent.temperature || 0.7,
            model: agent.model || "openai/gpt-4.1-mini",
            maxTokens: agent.maxTokens || 1000,
            isActive: agent.isActive ?? true,
            order: agent.order || 0,
            agentType: agent.agentType || "router",
            icon: agent.icon,
          }
        })
        setEditingAgents(initialEditing)

        logger.info(`Loaded ${sortedAgents.length} agents`)
      } catch (error) {
        logger.error("Failed to load agents:", error)
        toast.error("Failed to load agents")
      } finally {
        setIsLoading(false)
      }
    }

    loadAgents()
  }, [workspace?.id])

  const handleOpenEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setIsSlideOpen(true)
  }

  // Open fullscreen prompt editor
  const handleOpenPromptEditor = (agent: Agent) => {
    setPromptEditorAgent(agent)
    setIsPromptEditorOpen(true)
  }

  // Save only the prompt from the prompt editor dialog
  const handleSavePromptOnly = async (newPrompt: string) => {
    if (!workspace?.id || !promptEditorAgent) return

    try {
      const savedAgent = await updateAgentConfig(workspace.id, promptEditorAgent.id, {
        systemPrompt: newPrompt,
      })

      // Update local state
      setAgents((prev) =>
        prev.map((agent) => (agent.id === promptEditorAgent.id ? savedAgent : agent))
      )

      // Update editing state
      setEditingAgents((prev) => ({
        ...prev,
        [promptEditorAgent.id]: {
          ...prev[promptEditorAgent.id],
          systemPrompt: newPrompt,
        },
      }))

      toast.success(`Prompt saved for ${promptEditorAgent.name}`)
    } catch (error) {
      logger.error("Failed to save prompt:", error)
      toast.error("Failed to save prompt")
      throw error
    }
  }

  const handleSaveFromSlide = async (updatedAgent: Agent) => {
    if (!workspace?.id) return

    try {
      const savedAgent = await updateAgentConfig(workspace.id, updatedAgent.id, {
        name: updatedAgent.name,
        systemPrompt: updatedAgent.systemPrompt || "",
        temperature: updatedAgent.temperature,
        model: updatedAgent.model,
        maxTokens: updatedAgent.maxTokens,
        isActive: updatedAgent.isActive,
        order: updatedAgent.order,
        type: updatedAgent.agentType,
      })

      // Update local state
      setAgents((prev) =>
        prev.map((agent) => (agent.id === updatedAgent.id ? savedAgent : agent))
      )

      // Update editing state
      setEditingAgents((prev) => ({
        ...prev,
        [updatedAgent.id]: {
          id: savedAgent.id,
          name: savedAgent.name,
          systemPrompt: savedAgent.content || "",
          temperature: savedAgent.temperature || 0.7,
          model: savedAgent.model || "openai/gpt-4.1-mini",
          maxTokens: savedAgent.maxTokens || 1000,
          isActive: savedAgent.isActive ?? true,
          order: savedAgent.order || 0,
          agentType: savedAgent.agentType || "router",
          icon: savedAgent.icon,
        },
      }))

      toast.success(`${updatedAgent.name} saved successfully`)
    } catch (error) {
      logger.error(`Failed to save agent:`, error)
      toast.error("Failed to save agent")
      throw error
    }
  }

  // Handle export prompts
  const handleExportPrompts = async () => {
    if (!workspace?.id) return

    try {
      setIsExporting(true)
      await exportAgentPrompts(workspace.id)
      toast.success("Prompts exported successfully!")
    } catch (error) {
      logger.error("Failed to export prompts:", error)
      toast.error("Failed to export prompts")
    } finally {
      setIsExporting(false)
    }
  }

  // Handle reset to defaults
  const handleResetToDefaults = async () => {
    if (!workspace?.id) return

    try {
      setIsResetting(true)
      const result = await resetAgentPromptsToDefaults(workspace.id, useDynamicTemplates)
      toast.success(`${result.resetCount} prompts reset to ${useDynamicTemplates ? 'dynamic' : 'legacy'} defaults`)
      
      // Reload agents to show updated prompts
      const [agentsData, configsData] = await Promise.all([
        getAgents(workspace.id),
        getAgentConfigs(workspace.id),
      ])
      
      const sortedAgents = agentsData.sort((a, b) => a.order - b.order)
      setAgents(sortedAgents)
      
      // Update functions map
      const functionsMap: Record<string, string[]> = {}
      configsData.agents.forEach((config) => {
        functionsMap[config.id] = config.availableFunctions || []
      })
      setAgentFunctions(functionsMap)
      
      // Update editing state
      const newEditing: Record<string, AgentFormData> = {}
      sortedAgents.forEach((agent) => {
        newEditing[agent.id] = {
          id: agent.id,
          name: agent.name,
          systemPrompt: agent.content || "",
          temperature: agent.temperature || 0.7,
          model: agent.model || "openai/gpt-4.1-mini",
          maxTokens: agent.maxTokens || 1000,
          isActive: agent.isActive ?? true,
          order: agent.order || 0,
          agentType: agent.agentType || "router",
          icon: agent.icon,
        }
      })
      setEditingAgents(newEditing)
      
      setIsResetDialogOpen(false)
    } catch (error) {
      logger.error("Failed to reset prompts:", error)
      toast.error("Failed to reset prompts to defaults")
    } finally {
      setIsResetting(false)
    }
  }

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    )
  }

  if (!workspace?.id) {
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <p className="text-red-500">
            No workspace selected. Please select a workspace first.
          </p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="flex-1 space-y-4 p-4 pt-2">
        <div className="flex items-center justify-between">
          <PageHeader
            title={
              <div className="flex items-center gap-2">
                <Bot className="h-6 w-6 text-green-600" />
                <span className="text-green-600">Agents Configuration</span>
              </div>
            }
            description="Configure your multi-agent LLM system"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPrompts}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export Prompts
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetDialogOpen(true)}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Load Defaults
            </Button>
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-500">No agents found for this workspace.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {agents
              .filter((agent) => {
                // 🔒 SECURITY: Hide Security Agent from UI - it's hardcoded for safety
                const agentType = agent.agentType?.toLowerCase()
                return agentType !== "security"
              })
              .map((agent) => {
              const formData = editingAgents[agent.id]
              if (!formData) return null

              // ✅ Get real available functions from database
              const callFunctions = agentFunctions[agent.id] || []

              // Normalize agent type to lowercase for display
              const normalizedType = formData.agentType.toLowerCase()

              // Agent hierarchy levels
              const isRouter = normalizedType === "router"
              const isSecurity = normalizedType === "security"
              const isSafety = normalizedType === "safety_translation"
              const isSummaryAgent = normalizedType === "summary_agent"

              // Router (level 0), Specialists (level 1), Sub-agents (level 2), Security (level 99)
              const isSpecialistAgent = !isRouter && !isSecurity && !isSafety && !isSummaryAgent
              const indentClass = isSpecialistAgent ? "ml-8" : isSummaryAgent ? "ml-16" : ""

              return (
                <div
                  key={agent.id}
                  onClick={() => handleOpenEdit(agent)}
                  className={`border rounded-lg bg-white shadow-sm ${indentClass} cursor-pointer hover:bg-gray-50 hover:border-green-300 transition-colors`}
                >
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between w-full">
                      {/* LEFT SIDE: Icon + Agent Info */}
                      <div className="flex items-center gap-3 flex-1">
                        {/* 🌳 Tree connector for Specialist agents and Summary sub-agent */}
                        {isSpecialistAgent && (
                          <div className="flex items-center text-gray-500">
                            <div className="w-8 h-0.5 bg-gray-400"></div>
                            <ChevronRight className="h-5 w-5 -ml-1" />
                          </div>
                        )}
                        {/* 🌳 Double-indented connector for Summary Agent (sub-agent of Customer Support) */}
                        {isSummaryAgent && (
                          <div className="flex items-center text-gray-500">
                            <div className="w-4 h-0.5 bg-gray-300"></div>
                            <div className="w-8 h-0.5 bg-gray-400"></div>
                            <ChevronRight className="h-5 w-5 -ml-1" />
                          </div>
                        )}
                        {getAgentIcon(formData.icon, formData.agentType)}
                        <div className="text-left">
                          <h3
                            className={`text-lg font-semibold ${getAgentColor(
                              formData.agentType
                            )}`}
                          >
                            {formData.name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-gray-500">
                              Temp: {formData.temperature.toFixed(1)}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="text-gray-500">
                              Max Tokens: {formData.maxTokens}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span
                              className="max-w-[200px] truncate text-gray-500"
                              title={formData.model}
                            >
                              {formData.model}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CENTER: Functions count badge (details in edit panel) */}
                      <div className="flex items-center gap-1.5 flex-wrap mx-4">
                        {agent.agentType === "ROUTER" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                            🔀 Routes to sub-agents
                          </span>
                        ) : callFunctions.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-xs font-medium text-green-700">
                            ⚡ {callFunctions.length} function{callFunctions.length > 1 ? 's' : ''}
                          </span>
                        ) : agent.name === "safety_translation" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                            🔀 Routes to sub-agents
                          </span>
                        ) : null}
                      </div>

                      {/* RIGHT SIDE: View Prompt + Edit Buttons */}
                      <div className="flex items-center gap-1">
                        {/* View Prompt - Fullscreen editor */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenPromptEditor(agent)
                          }}
                          className="p-2 hover:bg-blue-50 rounded-md transition-colors"
                          title="View & Edit Prompt (Fullscreen)"
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </button>
                        {/* Edit Agent - Slide panel */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEdit(agent)
                          }}
                          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                          title="Edit agent settings"
                        >
                          <Edit className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Slide Panel for Editing */}
      {editingAgent && (
        <AgentEditSlidePanel
          agent={editingAgent}
          open={isSlideOpen}
          onOpenChange={(open) => {
            setIsSlideOpen(open)
            if (!open) setEditingAgent(null)
          }}
          onSave={handleSaveFromSlide}
          availableFunctions={agentFunctions[editingAgent.id] || []}
        />
      )}

      {/* Fullscreen Prompt Editor Dialog */}
      {promptEditorAgent && (
        <PromptEditorDialog
          open={isPromptEditorOpen}
          onOpenChange={(open) => {
            setIsPromptEditorOpen(open)
            if (!open) setPromptEditorAgent(null)
          }}
          agentName={promptEditorAgent.name}
          agentType={promptEditorAgent.agentType}
          initialPrompt={promptEditorAgent.content || promptEditorAgent.systemPrompt || ""}
          onSave={handleSavePromptOnly}
          readOnly={true}
        />
      )}

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-600">
              ⚠️ Reset All Prompts to Defaults?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This action will <strong>overwrite all your custom prompts</strong> with the default values.
              </p>
              <p className="text-orange-600 font-medium">
                💡 We recommend exporting your current prompts first using the "Export Prompts" button.
              </p>
              
              {/* Template type selection */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="useDynamicTemplates" 
                    checked={useDynamicTemplates}
                    onCheckedChange={(checked) => setUseDynamicTemplates(checked === true)}
                  />
                  <Label htmlFor="useDynamicTemplates" className="text-sm font-medium cursor-pointer">
                    Use Dynamic Templates (recommended)
                  </Label>
                </div>
                <p className="mt-2 text-xs text-gray-500 ml-6">
                  {useDynamicTemplates 
                    ? "✅ Templates will adapt based on workspace settings (sellsProductsAndServices, hasHumanSupport, address, etc.)"
                    : "⚠️ Static templates without conditional logic"
                  }
                </p>
              </div>
              
              <p className="text-sm text-gray-500">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetToDefaults}
              disabled={isResetting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset All Prompts"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}