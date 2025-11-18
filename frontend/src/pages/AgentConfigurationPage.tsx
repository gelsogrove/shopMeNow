/**
 * Agent Configuration Dashboard
 *
 * Unified interface for managing all LLM agents in the multi-agent system.
 * Uses accordion-style collapsible panels with sliders for temperature and max tokens.
 *
 * Features:
 * - Horizontal collapsible panels (only one open at a time)
 * - Agent icon, title, temperature, model displayed in header
 * - Sliders for temperature (0.1-1) and max tokens (0-3500)
 * - Call functions list showing which functions each agent can use
 * - Markdown editor for system prompts
 * - Respects agent order (Router Agent always first)
 *
 * @architecture Clean Component with shadcn/ui Accordion
 */

import { PageLayout } from "@/components/layout/PageLayout"
import { AgentEditSlidePanel } from "@/components/shared/AgentEditSlidePanel"
import { PageHeader } from "@/components/shared/PageHeader"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import {
  Agent,
  getAgentConfigs,
  getAgents,
  updateAgent,
} from "@/services/agentApi"
import { api } from "@/services/api"
import {
  Bell,
  Bot,
  Brain,
  ChevronRight,
  Edit,
  GitBranch,
  Headphones,
  Loader2,
  LucideIcon,
  Package,
  Save,
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
}

// Get icon component from database icon name with colorful background
const getAgentIcon = (iconName: string | undefined, agentType: string) => {
  // Fallback to type-based icon if no icon name in database
  const Icon = iconName && iconMap[iconName] ? iconMap[iconName] : Settings

  // Normalize agent type (handle ROUTER, Router, router, etc.)
  const normalizedType = agentType.toLowerCase().replace(/_/g, "_")

  // Color mapping based on agent type - SAME AS MESSAGE FLOW TIMELINE
  // Solid background with white icon (timeline style)
  const colorConfig: Record<string, { bg: string }> = {
    router: { bg: "bg-purple-600" }, // Purple like timeline
    product_search: { bg: "bg-blue-600" }, // Blue
    cart_management: { bg: "bg-green-600" }, // Green
    order_tracking: { bg: "bg-orange-600" }, // Orange
    customer_support: { bg: "bg-pink-600" }, // Pink
    profile_management: { bg: "bg-slate-600" }, // Slate for profile + notifications
    safety_translation: { bg: "bg-red-600" }, // Red like timeline
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
  const [savingAgents, setSavingAgents] = useState<Record<string, boolean>>({})
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [isSlideOpen, setIsSlideOpen] = useState(false)

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

  const handleSaveFromSlide = async (updatedAgent: Agent) => {
    if (!workspace?.id) return

    try {
      const savedAgent = await updateAgent(workspace.id, updatedAgent.id, {
        name: updatedAgent.name,
        content: updatedAgent.systemPrompt || "",
        temperature: updatedAgent.temperature,
        model: updatedAgent.model,
        maxTokens: updatedAgent.maxTokens,
        isActive: updatedAgent.isActive,
        order: updatedAgent.order,
        agentType: updatedAgent.agentType,
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

  const handleSaveAgent = async (agentId: string) => {
    if (!workspace?.id) return

    const formData = editingAgents[agentId]
    if (!formData) return

    try {
      setSavingAgents((prev) => ({ ...prev, [agentId]: true }))

      logger.info(`Saving agent ${agentId}:`, formData)

      const updatedAgent = await updateAgent(workspace.id, agentId, {
        name: formData.name,
        content: formData.systemPrompt,
        temperature: formData.temperature,
        model: formData.model,
        maxTokens: formData.maxTokens,
        isActive: formData.isActive,
        order: formData.order,
        agentType: formData.agentType,
      })

      // Update local state
      setAgents((prev) =>
        prev.map((agent) => (agent.id === agentId ? updatedAgent : agent))
      )

      toast.success(`${formData.name} saved successfully`)
    } catch (error) {
      logger.error(`Failed to save agent ${agentId}:`, error)
      toast.error("Failed to save agent")
    } finally {
      setSavingAgents((prev) => ({ ...prev, [agentId]: false }))
    }
  }

  const updateAgentField = (
    agentId: string,
    field: keyof AgentFormData,
    value: any
  ) => {
    setEditingAgents((prev) => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [field]: value,
      },
    }))
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

        {agents.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-500">No agents found for this workspace.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full space-y-2">
              {agents.map((agent, index) => {
                const formData = editingAgents[agent.id]
                if (!formData) return null

                // ✅ Get real available functions from database
                const callFunctions = agentFunctions[agent.id] || []
                const isSaving = savingAgents[agent.id]

                // Normalize agent type to lowercase for display
                const normalizedType = formData.agentType.toLowerCase()

                // Agent hierarchy levels
                const isRouter = normalizedType === "router"
                const isSafety = normalizedType === "safety_translation"

                // Router (level 0), Specialists (level 1), Safety (level 99)
                const isSpecialistAgent = !isRouter && !isSafety
                const indentClass = isSpecialistAgent ? "ml-8" : ""
                const isProductSearch = normalizedType === "product_search"

                // Check if previous agent was Router (to add vertical line)
                const prevAgent = index > 0 ? agents[index - 1] : null
                const prevType = prevAgent?.agentType?.toLowerCase() || ""
                const isPrevRouter = prevType === "router"

                return (
                  <>
                    <AccordionItem
                      key={agent.id}
                      value={agent.id}
                      className={`border rounded-lg bg-white shadow-sm ${indentClass}`}
                    >
                      <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50">
                        <div className="flex items-center justify-between w-full pr-4">
                          {/* LEFT SIDE: Icon + Agent Info */}
                          <div className="flex items-center gap-3 flex-1">
                            {/* 🌳 Tree connector ONLY for Specialist agents (not Router, not Safety) */}
                            {isSpecialistAgent && (
                              <div className="flex items-center text-gray-500">
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

                          {/* CENTER: Call Functions or Routing Badge */}
                          <div className="flex items-center gap-1.5 flex-wrap mx-4">
                            {agent.agentType === "ROUTER" ? (
                              // Router Agent: Show only routing badge (hide CF list)
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                                🔀 Routes to sub-agents
                              </span>
                            ) : callFunctions.length > 0 ? (
                              // Other agents: Show CF badges
                              callFunctions.map((func) => (
                                <span
                                  key={func}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border rounded-full text-xs font-medium text-gray-700"
                                >
                                  <ChevronRight className="h-3 w-3 text-green-600" />
                                  {func}
                                </span>
                              ))
                            ) : agent.name === "safety_translation" ? (
                              // Safety Agent: Show routing badge
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                                🔀 Routes to sub-agents
                              </span>
                            ) : null}
                          </div>

                          {/* RIGHT SIDE: Edit Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEdit(agent)
                            }}
                            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                            title="Edit agent"
                          >
                            <Edit className="h-4 w-4 text-gray-600" />
                          </button>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-6 pb-6">
                        <div className="space-y-6 pt-4">
                          {/* First Row: Model, Temperature & Max Tokens */}
                          <div className="grid grid-cols-3 gap-6">
                            {/* Model Selection */}
                            <div className="space-y-2">
                              <Label
                                htmlFor={`model-${agent.id}`}
                                className="text-sm font-medium"
                              >
                                Model
                              </Label>
                              <Select
                                value={formData.model}
                                onValueChange={(value) =>
                                  updateAgentField(agent.id, "model", value)
                                }
                              >
                                <SelectTrigger id={`model-${agent.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="anthropic/claude-opus-4.1">
                                    Claude Opus 4.1 (Premium)
                                  </SelectItem>
                                  <SelectItem value="openai/gpt-4.1">
                                    GPT-4.1 (High-end)
                                  </SelectItem>
                                  <SelectItem value="google/gemini-2.5-pro">
                                    Gemini 2.5 Pro
                                  </SelectItem>
                                  <SelectItem value="google/gemini-2.0-flash-001">
                                    Gemini 2.0 Flash (Best quality)
                                  </SelectItem>
                                  <SelectItem value="openai/gpt-4">
                                    GPT-4
                                  </SelectItem>
                                  <SelectItem value="anthropic/claude-3.5-haiku">
                                    Claude 3.5 Haiku
                                  </SelectItem>
                                  <SelectItem value="x-ai/grok-4">
                                    Grok-4
                                  </SelectItem>
                                  <SelectItem value="openai/gpt-4-turbo">
                                    GPT-4 Turbo
                                  </SelectItem>
                                  <SelectItem value="openai/gpt-4o-mini">
                                    GPT-4o Mini
                                  </SelectItem>
                                  <SelectItem value="deepseek/deepseek-r1">
                                    DeepSeek R1
                                  </SelectItem>
                                  <SelectItem value="anthropic/claude-3.5-sonnet">
                                    Claude 3.5 Sonnet
                                  </SelectItem>
                                  <SelectItem value="LOCAL:llama3.2:3b">
                                    🏠 LOCAL: Llama 3.2 3B
                                  </SelectItem>
                                  <SelectItem value="LOCAL:qwen3-coder:480b-cloud">
                                    🏠 LOCAL: Qwen3 Coder
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Temperature Slider */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <Label
                                  htmlFor={`temperature-${agent.id}`}
                                  className="text-sm font-medium"
                                >
                                  Temperature
                                </Label>
                                <span className="text-sm font-bold text-gray-700">
                                  {formData.temperature.toFixed(1)}
                                </span>
                              </div>
                              <input
                                type="range"
                                id={`temperature-${agent.id}`}
                                min="0.1"
                                max="1"
                                step="0.1"
                                value={formData.temperature}
                                onChange={(e) =>
                                  updateAgentField(
                                    agent.id,
                                    "temperature",
                                    Number(e.target.value)
                                  )
                                }
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                              />
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>0.1</span>
                                <span>1.0</span>
                              </div>
                            </div>

                            {/* Max Tokens Slider */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <Label
                                  htmlFor={`maxTokens-${agent.id}`}
                                  className="text-sm font-medium"
                                >
                                  Max Tokens
                                </Label>
                                <span className="text-sm font-bold text-gray-700">
                                  {formData.maxTokens}
                                </span>
                              </div>
                              <input
                                type="range"
                                id={`maxTokens-${agent.id}`}
                                min="0"
                                max="3500"
                                step="100"
                                value={formData.maxTokens}
                                onChange={(e) =>
                                  updateAgentField(
                                    agent.id,
                                    "maxTokens",
                                    Number(e.target.value)
                                  )
                                }
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                              />
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>0</span>
                                <span>3500</span>
                              </div>
                            </div>
                          </div>

                          {/* System Prompt */}
                          <div className="space-y-2">
                            <Label
                              htmlFor={`prompt-${agent.id}`}
                              className="text-sm font-medium"
                            >
                              System Prompt
                            </Label>
                            <Textarea
                              id={`prompt-${agent.id}`}
                              value={formData.systemPrompt}
                              onChange={(e) =>
                                updateAgentField(
                                  agent.id,
                                  "systemPrompt",
                                  e.target.value
                                )
                              }
                              className="min-h-[300px] font-mono text-sm"
                              placeholder="Enter system prompt for this agent..."
                            />
                          </div>

                          {/* Save Button */}
                          <div className="flex justify-end pt-4 border-t">
                            <Button
                              onClick={() => handleSaveAgent(agent.id)}
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
                                  Save Configuration
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </>
                )
              })}
            </Accordion>
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
        />
      )}
    </PageLayout>
  )
}
