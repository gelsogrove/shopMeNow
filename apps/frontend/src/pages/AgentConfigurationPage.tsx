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
import { AgentFlowDiagram } from "@/components/shared/AgentFlowDiagram"
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
  getAgentConfigs,
  resetAgentPromptsToDefaults,
  updateAgentConfig,
} from "@/services/agent-config-api"
import { Agent, getAgents } from "@/services/agents-legacy-api"
import {
  Bell,
  Bot,
  Brain,
  AlertTriangle,
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
  >({})  // ✅ Real functions from API // ✅ Real functions from API
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
        </div>

        {/* ⚠️ Warning banner */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Sensitive area — system administrator only</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Modifying agent prompts and configurations can affect the entire chatbot behavior. Only make changes if you know what you are doing.
            </p>
          </div>
        </div>

        {/* 🎨 Agent Flow Diagram - Visual representation of multi-agent architecture */}
        <AgentFlowDiagram 
          isEcommerce={workspace?.channelMode === 'ECOMMERCE'}
          agents={agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            type: agent.agentType || "router",
            systemPrompt: agent.content || agent.systemPrompt || "",
            temperature: agent.temperature || 0.7,
            maxTokens: agent.maxTokens || 1000,
            model: agent.model || "openai/gpt-4.1-mini",
            isActive: agent.isActive ?? true,
            order: agent.order || 0,
            availableFunctions: agentFunctions[agent.id] || [],
          }))}
          workspaceId={workspace.id}
          onSaveAgent={async (agentId, data) => {
            const agent = agents.find(a => a.id === agentId)
            if (!agent) return
            
            await handleSaveFromSlide({
              ...agent,
              systemPrompt: data.systemPrompt ?? agent.systemPrompt ?? agent.content ?? "",
              temperature: data.temperature ?? agent.temperature ?? 0.7,
              maxTokens: data.maxTokens ?? agent.maxTokens ?? 1000,
            } as Agent)
          }}
          onResetToDefaults={handleResetToDefaults}
          isLoading={isLoading}
          className="mb-6"
        />

      </div>

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
                    ? "✅ Templates will adapt based on workspace settings (channelMode, hasHumanSupport, address, etc.)"
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