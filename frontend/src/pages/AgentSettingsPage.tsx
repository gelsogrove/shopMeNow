/**
 * Agent Settings Dashboard
 *
 * Multi-Agent LLM Management Interface
 *
 * Features:
 * - Visual flow chart: Router → Sub-Agents → Safety → Customer
 * - CRUD operations: Edit prompt, model, temperature, max_tokens
 * - Timeline visualization with react-vertical-timeline
 * - Cards for each agent with inline editing
 *
 * Architecture:
 * Router Agent (order 0) → manages conversation history + function calling
 * Sub-Agents (order 1-90) → specialized: ProductSearch, CartManagement, OrderTracking
 * Safety Agent (order 99) → ALWAYS last, translates + validates PII/profanity
 *
 * @architecture Clean Component with shadcn/ui
 */

import { PageLayout } from "@/components/layout/PageLayout"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import MarkdownEditor from "@/components/ui/markdown-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { Agent, getAgents, updateAgent } from "@/services/agentApi"
import {
  Bot,
  Brain,
  CheckCircle,
  HelpCircle,
  Loader2,
  Save,
  Shield,
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
}

export function AgentSettingsPage() {
  const { workspace } = useWorkspace()
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingAgents, setEditingAgents] = useState<
    Record<string, AgentFormData>
  >({})
  const [savingAgents, setSavingAgents] = useState<Record<string, boolean>>({})

  // Redirect if no workspace
  useEffect(() => {
    if (!workspace) {
      logger.info("No workspace found in AgentSettingsPage, redirecting")
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
        const agentsData = await getAgents(workspace.id)

        // Sort by order
        const sortedAgents = agentsData.sort(
          (a, b) => (a.order || 0) - (b.order || 0)
        )
        setAgents(sortedAgents)

        // Initialize editing state
        const initialEditState: Record<string, AgentFormData> = {}
        sortedAgents.forEach((agent) => {
          initialEditState[agent.id] = {
            id: agent.id,
            name: agent.name,
            systemPrompt: agent.systemPrompt || agent.content || "",
            temperature: agent.temperature || 0.7,
            model: agent.model || "openai/gpt-4o-mini",
            maxTokens: agent.maxTokens || 1000,
            isActive: agent.isActive ?? true,
            order: agent.order || 0,
            agentType: agent.agentType || "ROUTER",
          }
        })
        setEditingAgents(initialEditState)

        logger.info(`Loaded ${sortedAgents.length} agents`)
      } catch (error) {
        logger.error("Error loading agents:", error)
        toast.error("Failed to load agents")
      } finally {
        setIsLoading(false)
      }
    }

    loadAgents()
  }, [workspace])

  // Save agent changes
  const handleSaveAgent = async (agentId: string) => {
    if (!workspace?.id) return

    const formData = editingAgents[agentId]
    if (!formData) return

    try {
      setSavingAgents((prev) => ({ ...prev, [agentId]: true }))
      logger.info("Saving agent:", agentId, formData)

      await updateAgent(workspace.id, agentId, {
        name: formData.name,
        systemPrompt: formData.systemPrompt,
        temperature: formData.temperature,
        model: formData.model,
        maxTokens: formData.maxTokens,
        isActive: formData.isActive,
      })

      // Update local state
      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                name: formData.name,
                systemPrompt: formData.systemPrompt,
                temperature: formData.temperature,
                model: formData.model,
                maxTokens: formData.maxTokens,
                isActive: formData.isActive,
              }
            : agent
        )
      )

      toast.success(`Agent "${formData.name}" saved successfully`)
    } catch (error) {
      logger.error("Error saving agent:", error)
      toast.error("Failed to save agent")
    } finally {
      setSavingAgents((prev) => ({ ...prev, [agentId]: false }))
    }
  }

  // Update form field
  const handleFieldChange = (
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

  // Get agent icon based on type
  const getAgentIcon = (agentType: string) => {
    switch (agentType) {
      case "ROUTER":
        return Brain
      case "PRODUCT_SEARCH":
      case "CART_MANAGEMENT":
      case "ORDER_TRACKING":
      case "CUSTOMER_SUPPORT":
        return Bot
      case "SAFETY_TRANSLATION":
        return Shield
      default:
        return Bot
    }
  }

  // Get agent color based on type
  const getAgentColor = (agentType: string) => {
    switch (agentType) {
      case "ROUTER":
        return "rgb(33, 150, 243)" // Blue
      case "PRODUCT_SEARCH":
        return "rgb(76, 175, 80)" // Green
      case "CART_MANAGEMENT":
        return "rgb(255, 152, 0)" // Orange
      case "ORDER_TRACKING":
        return "rgb(156, 39, 176)" // Purple
      case "CUSTOMER_SUPPORT":
        return "rgb(233, 30, 99)" // Pink
      case "SAFETY_TRANSLATION":
        return "rgb(244, 67, 54)" // Red
      default:
        return "rgb(158, 158, 158)" // Grey
    }
  }

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageHeader
        title="Agent Settings"
        description="Configure multi-agent LLM system: Router, Sub-Agents, and Safety Layer"
      />

      {/* Agent Cards - CRUD Interface */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Agent Configuration</h2>
        {agents.map((agent) => {
          const formData = editingAgents[agent.id]
          if (!formData) return null

          const Icon = getAgentIcon(agent.agentType || "ROUTER")
          const isSaving = savingAgents[agent.id]

          return (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-3 rounded-lg"
                      style={{
                        backgroundColor:
                          getAgentColor(agent.agentType || "ROUTER") + "20",
                      }}
                    >
                      <Icon
                        className="w-6 h-6"
                        style={{
                          color: getAgentColor(agent.agentType || "ROUTER"),
                        }}
                      />
                    </div>
                    <div>
                      <CardTitle>{agent.name}</CardTitle>
                      <CardDescription>
                        {agent.agentType} - Order {agent.order}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSaveAgent(agent.id)}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Model & Parameters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label
                      htmlFor={`model-${agent.id}`}
                      className="flex items-center gap-2"
                    >
                      LLM Model
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              OpenRouter model: openai/gpt-4o-mini,
                              anthropic/claude-3.5-sonnet, etc.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Select
                      value={formData.model}
                      onValueChange={(value) =>
                        handleFieldChange(agent.id, "model", value)
                      }
                    >
                      <SelectTrigger id={`model-${agent.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai/gpt-4o-mini">
                          GPT-4o Mini
                        </SelectItem>
                        <SelectItem value="openai/gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="anthropic/claude-3.5-sonnet">
                          Claude 3.5 Sonnet
                        </SelectItem>
                        <SelectItem value="anthropic/claude-3-haiku">
                          Claude 3 Haiku
                        </SelectItem>
                        <SelectItem value="google/gemini-pro-1.5">
                          Gemini Pro 1.5
                        </SelectItem>
                        <SelectItem value="meta-llama/llama-3.1-70b-instruct">
                          Llama 3.1 70B
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Temperature */}
                  <div className="space-y-2">
                    <Label
                      htmlFor={`temp-${agent.id}`}
                      className="flex items-center gap-2"
                    >
                      Temperature
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              0.0 = Deterministic, 1.0 = Creative. Router: 0.3,
                              Safety: 0.1
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id={`temp-${agent.id}`}
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={formData.temperature}
                      onChange={(e) =>
                        handleFieldChange(
                          agent.id,
                          "temperature",
                          parseFloat(e.target.value)
                        )
                      }
                    />
                  </div>

                  {/* Max Tokens */}
                  <div className="space-y-2">
                    <Label
                      htmlFor={`tokens-${agent.id}`}
                      className="flex items-center gap-2"
                    >
                      Max Tokens
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Maximum output length. Router: 500, Sub-agents:
                              1000
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id={`tokens-${agent.id}`}
                      type="number"
                      step="100"
                      min="100"
                      max="4000"
                      value={formData.maxTokens}
                      onChange={(e) =>
                        handleFieldChange(
                          agent.id,
                          "maxTokens",
                          parseInt(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>

                {/* Function Calls - Display only */}
                {agent.functions && agent.functions.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Available Function Calls
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Functions this agent can call to execute actions.
                              Configured in agent-function-mapping.ts
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {agent.functions.map((funcName) => (
                        <div
                          key={funcName}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                        >
                          <CheckCircle className="w-3 h-3" />
                          {funcName}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Total: {agent.functions.length} function
                      {agent.functions.length !== 1 ? "s" : ""} available
                    </p>
                  </div>
                )}

                {/* System Prompt */}
                <div className="space-y-2">
                  <Label
                    htmlFor={`prompt-${agent.id}`}
                    className="flex items-center gap-2"
                  >
                    System Prompt
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Markdown prompt with instructions. Use variables:{" "}
                            {"{"}
                            {"{"}nome{"}"}
                            {"}"}, {"{"}
                            {"{"}email{"}"}
                            {"}"}, etc.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <MarkdownEditor
                    value={formData.systemPrompt}
                    onChange={(value) =>
                      handleFieldChange(agent.id, "systemPrompt", value)
                    }
                  />
                </div>

                {/* Agent Info */}
                {agent.agentType === "ROUTER" && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Router Agent Special Features
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>
                        • Manages conversation history (10-minute rolling
                        window)
                      </li>
                      <li>• Function Calling with 9 available functions</li>
                      <li>• Max 5 function call iterations per message</li>
                      <li>
                        • Functions: searchProducts, addToCart, viewCart,
                        removeFromCart, updateCartQuantity, clearCart,
                        repeatLastOrder, getOrders, contactSupport
                      </li>
                    </ul>
                  </div>
                )}

                {agent.agentType === "SAFETY_TRANSLATION" && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Safety Layer - ALWAYS ACTIVE
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>
                        • Validates EVERY response before customer delivery
                      </li>
                      <li>
                        • Blocks: PII (email, phone, password), profanity,
                        phishing links, spam
                      </li>
                      <li>
                        • Translates to customer's language (IT/ES/EN/PT
                        supported)
                      </li>
                      <li>• If blocked: Returns safe fallback message</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Help Section */}
      <div className="mt-8 p-6 bg-muted rounded-lg">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5" />
          Database Commands
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <code className="bg-background px-2 py-1 rounded">
              npm run db:export
            </code>
            <p className="text-muted-foreground mt-1">
              Export all data to seed files
            </p>
          </div>
          <div>
            <code className="bg-background px-2 py-1 rounded">
              npm run seed
            </code>
            <p className="text-muted-foreground mt-1">
              Import all data from seed files
            </p>
          </div>
          <div>
            <code className="bg-background px-2 py-1 rounded">
              npm run update:prompts
            </code>
            <p className="text-muted-foreground mt-1">
              Sync prompts from docs/prompts/ to DB
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
