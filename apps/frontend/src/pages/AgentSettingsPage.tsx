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
  Globe,
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
      case "INFO_AGENT":
        return Bot
      case "SECURITY":
        return Shield
      case "TRANSLATION":
        return Globe
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
      case "INFO_AGENT":
        return "rgb(233, 30, 99)" // Pink
      case "SECURITY":
        return "rgb(244, 67, 54)" // Red
      case "TRANSLATION":
        return "rgb(0, 150, 136)" // Teal
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
                      <li>• Function Calling with available functions</li>
                      <li>• Max 5 function call iterations per message</li>
                      <li>
                        • Functions: searchProducts, addToCart, viewCart,
                        removeFromCart, updateCartQuantity, clearCart,
                        repeatLastOrder, getOrders, contactOperator,
                        getProfileLink, handlePushNotifications
                      </li>
                    </ul>
                  </div>
                )}

                {agent.agentType === "TRANSLATION" && (
                  <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Translation Layer - ALWAYS ACTIVE
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Translates every response to customer language</li>
                      <li>• Uses workspace settings for product/service names</li>
                      <li>• Runs for both WhatsApp and Widget channels</li>
                    </ul>
                  </div>
                )}

                {agent.agentType === "SECURITY" && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Widget Security Layer
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Validates responses before widget delivery</li>
                      <li>• Blocks unsafe content & phishing links</li>
                      <li>• WhatsApp security is handled by the scheduler</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Help Section */}
      <div className="mt-8 space-y-6">
        {/* Available Variables Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Available Variables for Prompts
            </CardTitle>
            <CardDescription>
              Use these variables in your system prompts. They will be replaced with actual customer data at runtime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* WhatsApp Variables */}
              <div className="space-y-3">
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp Channel Variables
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{nameUser}}"}</code>
                    <span className="text-muted-foreground">Customer name</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{email}}"}</code>
                    <span className="text-muted-foreground">Customer email</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{phone}}"}</code>
                    <span className="text-muted-foreground">Customer phone number</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{discountUser}}"}</code>
                    <span className="text-muted-foreground">Customer discount percentage</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{agentName}}"}</code>
                    <span className="text-muted-foreground">Assigned sales agent name</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{agentPhone}}"}</code>
                    <span className="text-muted-foreground">Assigned sales agent phone</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{agentEmail}}"}</code>
                    <span className="text-muted-foreground">Assigned sales agent email</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{lastordercode}}"}</code>
                    <span className="text-muted-foreground">Last order code (for repeat orders)</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{companyName}}"}</code>
                    <span className="text-muted-foreground">Company name</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{channelName}}"}</code>
                    <span className="text-muted-foreground">Workspace/channel name</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{languageUser}}"}</code>
                    <span className="text-muted-foreground">Customer preferred language (IT/ES/EN/PT)</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{adminEmail}}"}</code>
                    <span className="text-muted-foreground">Support/escalation email</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{TOKEN_DURATION}}"}</code>
                    <span className="text-muted-foreground">Link expiration time (e.g., "2 hours")</span>
                  </div>
                </div>
              </div>

              {/* Widget Variables */}
              <div className="space-y-3">
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Widget Channel Variables
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-yellow-800 font-medium">
                      ⚠️ Widget visitors are anonymous until registration
                    </p>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{nameUser}}"}</code>
                    <span className="text-muted-foreground">Visitor name (default: "Visitor XXXXX")</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{email}}"}</code>
                    <span className="text-muted-foreground">Visitor email (empty until registration)</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{phone}}"}</code>
                    <span className="text-muted-foreground">Visitor phone (empty until registration)</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{companyName}}"}</code>
                    <span className="text-muted-foreground">Company name</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{channelName}}"}</code>
                    <span className="text-muted-foreground">Workspace/channel name</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{languageUser}}"}</code>
                    <span className="text-muted-foreground">Visitor language (auto-detected from browser)</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <code className="text-xs bg-primary/10 px-2 py-1 rounded font-mono">{"{{adminEmail}}"}</code>
                    <span className="text-muted-foreground">Support/escalation email</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                    <p className="text-xs text-blue-800 font-medium mb-2">
                      💡 Widget-specific notes:
                    </p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• No discount, agent, or order variables (e-commerce disabled)</li>
                      <li>• Visitor data populated only after voluntary registration</li>
                      <li>• Language auto-detected from browser settings</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Translation + Security Variables */}
            <div className="mt-6 space-y-3">
              <h4 className="font-semibold text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-teal-600" />
                Translation & Widget Security Variables
              </h4>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-teal-800 font-medium">
                  ⚠️ These variables are used by the TRANSLATION and SECURITY agent prompts. They are replaced at runtime by the translation/security pipeline.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-sm">
                <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                  <code className="text-xs bg-teal-100 px-2 py-1 rounded font-mono whitespace-nowrap">{"{TARGET_LANGUAGE}"}</code>
                  <span className="text-muted-foreground">Target language for translation (e.g., "Italian", "Spanish"). Also accepts <code className="text-xs bg-primary/10 px-1 rounded">{"{{languageUser}}"}</code></span>
                </div>
                <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                  <code className="text-xs bg-teal-100 px-2 py-1 rounded font-mono whitespace-nowrap">{"{MESSAGE}"}</code>
                  <span className="text-muted-foreground">The AI response to translate/validate. Also accepts <code className="text-xs bg-primary/10 px-1 rounded">{"{{message}}"}</code></span>
                </div>
                <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                  <code className="text-xs bg-teal-100 px-2 py-1 rounded font-mono whitespace-nowrap">{"{CUSTOMER_NAME}"}</code>
                  <span className="text-muted-foreground">Customer name for personalization. Also accepts <code className="text-xs bg-primary/10 px-1 rounded">{"{{customerName}}"}</code></span>
                </div>
                <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                  <code className="text-xs bg-teal-100 px-2 py-1 rounded font-mono whitespace-nowrap">{"{ALLOWED_LINKS}"}</code>
                  <span className="text-muted-foreground">List of allowed domains/links the agent can include (Security Layer)</span>
                </div>
              </div>
            </div>

            {/* Usage Example */}
            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <h4 className="font-semibold mb-2">Example Usage:</h4>
              <code className="text-xs block bg-background p-3 rounded font-mono overflow-x-auto">
                {`Ciao {{nameUser}},\n\nGrazie per averci contattato! Hai uno sconto del {{discountUser}}%.\nPer assistenza, contatta {{agentName}} al {{agentPhone}}.\n\nLa tua lingua preferita è: {{languageUser}}\n\nLa {{companyName}} è qui per aiutarti! 😊`}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Database Commands */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Database Commands
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
