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
 * @version 2.1.0 - History node + WhatsApp Queue panel
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import MarkdownEditor from "@/components/ui/markdown-editor"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { FlowConfigSheet } from "@/components/shared/FlowConfigSheet"
import { Agent, getAgents } from "@/services/agents-legacy-api"
import { updateAgentConfig } from "@/services/agent-config-api"
import { FlowConfig, getAllForWorkspace } from "@/services/flowConfigApi"
import { api } from "@/services/api"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Bot,
  Brain,
  Check,
  CheckCircle,
  ChevronsUpDown,
  Clock,
  Globe,
  HelpCircle,
  Inbox,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  Send,
  Shield,
  XCircle,
  Workflow,
} from "lucide-react"
import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

// ── Pipeline graph helpers ──────────────────────────────────────────────────

interface PipelineNodeProps {
  icon: React.ElementType
  label: string
  sublabel?: string
  color: string
  bg: string
  border: string
  bold?: boolean
  isActive?: boolean
  onClick?: () => void
}

function PipelineNode({ icon: Icon, label, sublabel, color, bg, border, bold, isActive, onClick }: PipelineNodeProps) {
  const isClickable = !!onClick
  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      className={`group relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl border-2 transition-all ${
        isClickable ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.99]' : ''
      }`}
      style={{ borderColor: border, backgroundColor: bg, minWidth: 190 }}
    >
      {/* Active/inactive dot */}
      {isActive !== undefined && (
        <span
          className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-white ${
            isActive ? 'bg-green-500' : 'bg-gray-300'
          }`}
        />
      )}
      <Icon className="w-4 h-4 shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm leading-tight ${bold ? 'font-semibold' : 'font-medium'}`} style={{ color }}>
          {label}
        </div>
        {sublabel && (
          <div className="text-[11px] text-muted-foreground">{sublabel}</div>
        )}
      </div>
      {/* Edit pencil on hover */}
      {isClickable && (
        <svg className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      )}
    </div>
  )
}

function VerticalConnector() {
  return (
    <div className="flex flex-col items-center gap-0">
      <div className="w-px h-4 bg-gray-300" />
      <svg width="10" height="8" viewBox="0 0 10 8">
        <polygon points="5,8 0,0 10,0" fill="#94a3b8" />
      </svg>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────

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
  const [modelComboOpen, setModelComboOpen] = useState<Record<string, boolean>>({})
  const [flowConfigs, setFlowConfigs] = useState<FlowConfig[]>([])
  const [flowSheetOpen, setFlowSheetOpen] = useState(false)
  const [selectedFlowConfig, setSelectedFlowConfig] = useState<FlowConfig | null>(null)
  const [highlightAgentId, setHighlightAgentId] = useState<string | null>(null)

  const isFlowWorkspace = workspace?.channelMode === 'FLOW'

  // Channel type helpers
  const channelType = workspace?.channelType
  const hasWhatsApp = !channelType || channelType === 'WHATSAPP'
  const hasWidget = channelType === 'WIDGET'
  const hasBoth = hasWhatsApp && hasWidget // always false today – ready for future BOTH enum

  // WhatsApp Queue mini-panel state
  interface QueueItem {
    id: string; customer: string; content: string
    status: 'pending' | 'sent' | 'error' | 'blocked'; createdAt: string
  }
  const [queuePanelOpen, setQueuePanelOpen] = useState(false)
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [queueDebugMode, setQueueDebugMode] = useState(false)
  const [channelView, setChannelView] = useState<'whatsapp' | 'widget'>('whatsapp')

  const OPENROUTER_MODELS = [
    { value: "openai/gpt-4o-mini",                label: "GPT-4o Mini" },
    { value: "openai/gpt-4o",                     label: "GPT-4o" },
    { value: "openai/gpt-4-turbo",                label: "GPT-4 Turbo" },
    { value: "openai/o1-mini",                    label: "o1 Mini" },
    { value: "anthropic/claude-3.5-sonnet",       label: "Claude 3.5 Sonnet" },
    { value: "anthropic/claude-3-haiku",          label: "Claude 3 Haiku" },
    { value: "anthropic/claude-3-opus",           label: "Claude 3 Opus" },
    { value: "google/gemini-2.0-flash-001",       label: "Gemini 2.0 Flash" },
    { value: "google/gemini-pro-1.5",             label: "Gemini Pro 1.5" },
    { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    { value: "meta-llama/llama-3.1-8b-instruct",  label: "Llama 3.1 8B" },
    { value: "mistralai/mistral-large",           label: "Mistral Large" },
    { value: "mistralai/mistral-7b-instruct",     label: "Mistral 7B" },
    { value: "deepseek/deepseek-chat",            label: "DeepSeek Chat" },
  ]

  // Redirect if no workspace
  useEffect(() => {
    if (!workspace) {
      logger.info("No workspace found in AgentSettingsPage, redirecting")
      navigate("/clients")
    }
  }, [workspace, navigate])

  // Load FlowNodeConfigs for FLOW workspaces
  const reloadFlowConfigs = () => {
    if (workspace?.id) {
      getAllForWorkspace(workspace.id).then(setFlowConfigs).catch((err) => {
        logger.error('Error loading flow configs:', err)
      })
    }
  }

  useEffect(() => {
    if (!isFlowWorkspace || !workspace?.id) return
    reloadFlowConfigs()
  }, [workspace, isFlowWorkspace])

  // Scroll to and highlight an agent card
  const handleNodeClick = (agentId: string) => {
    setHighlightAgentId(agentId)
    const el = document.getElementById(`agent-card-${agentId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setHighlightAgentId(null), 2500)
  }

  // Open FlowConfigSheet for a specific sub-LLM
  const handleFlowNodeClick = (fc: FlowConfig) => {
    setSelectedFlowConfig(fc)
    setFlowSheetOpen(true)
  }

  // Open FlowConfigSheet for creating a new sub-LLM
  const handleAddSubLLM = () => {
    setSelectedFlowConfig(null)
    setFlowSheetOpen(true)
  }

  // Fetch WhatsApp queue data for the mini-panel in the pipeline diagram
  const fetchQueueData = async () => {
    if (!workspace?.id) return
    setQueueLoading(true)
    try {
      const [queueRes, statusRes] = await Promise.all([
        api.get(`/workspaces/${workspace.id}/whatsapp-queue`),
        api.get(`/workspaces/${workspace.id}/whatsapp-queue/status`),
      ])
      const msgs = Array.isArray(queueRes.data) ? queueRes.data : []
      setQueueItems(
        msgs.slice(0, 15).map((m: any) => ({
          id: m.id,
          customer: m.customer?.name || m.phoneNumber || '?',
          content: (m.messageContent || '').substring(0, 55),
          status: m.status as QueueItem['status'],
          createdAt: m.createdAt,
        }))
      )
      if (statusRes.data.success) setQueueDebugMode(statusRes.data.debugMode ?? false)
    } catch (e) {
      logger.error('Failed to fetch queue data:', e)
    } finally {
      setQueueLoading(false)
    }
  }

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

      await updateAgentConfig(workspace.id, agentId, {
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

  // Derive sub-agents for pipeline display (exclude ROUTER, SECURITY, TRANSLATION)
  const pipelineSubAgents = agents.filter(
    (a) => a.agentType !== 'ROUTER' && a.agentType !== 'SECURITY' && a.agentType !== 'TRANSLATION'
  )
  const routerAgent = agents.find((a) => a.agentType === 'ROUTER')
  const translationAgent = agents.find((a) => a.agentType === 'TRANSLATION')
  const securityAgent = agents.find((a) => a.agentType === 'SECURITY')

  return (
    <PageLayout>
      <PageHeader
        title="Agent Settings"
        description="Configure multi-agent LLM system: Router, Sub-Agents, and Safety Layer"
      />

      {/* ── Visual Pipeline Graph ── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Agent Pipeline
            </span>
            {/* Channel tabs — shown only when workspace has both WhatsApp + Widget */}
            {hasBoth && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setChannelView('whatsapp')}
                  className={`px-3 py-1 flex items-center gap-1.5 transition-colors ${channelView === 'whatsapp' ? 'bg-green-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  <Send className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setChannelView('widget')}
                  className={`px-3 py-1 flex items-center gap-1.5 transition-colors ${channelView === 'widget' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  <Globe className="w-3.5 h-3.5" /> Widget
                </button>
              </div>
            )}
          </CardTitle>
          <CardDescription>
            Message flow through the multi-agent system
            {isFlowWorkspace && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                <Workflow className="w-3 h-3" />
                FLOW mode
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(() => {
            // Build the list of child nodes: standard sub-agents + FLOW sub-LLMs
            // Separate the "router" flow config (shown as History layer) from machine sub-LLMs
            const routerFlowConfig = isFlowWorkspace ? flowConfigs.find((fc) => fc.flowKey === 'router') : undefined
            const machineFlowConfigs = isFlowWorkspace ? flowConfigs.filter((fc) => fc.flowKey !== 'router') : []

            const childNodes: {
              id: string; label: string; sublabel?: string; color: string
              icon: React.ElementType; isFlow?: boolean; agentId?: string
              flowConfig?: FlowConfig; isActive?: boolean
            }[] = [
              ...pipelineSubAgents.map((a) => ({
                id: a.id,
                agentId: a.id,
                label: a.name,
                sublabel: editingAgents[a.id]?.model?.split('/')[1],
                color: getAgentColor(a.agentType || ''),
                icon: getAgentIcon(a.agentType || ''),
                isActive: a.isActive ?? true,
              })),
              ...(isFlowWorkspace ? machineFlowConfigs.map((fc) => ({
                id: fc.id,
                label: fc.flowLabel,
                sublabel: fc.model?.split('/')[1] || undefined,
                color: '#7c3aed',
                icon: Workflow,
                isFlow: true,
                flowConfig: fc,
                isActive: fc.isActive,
              })) : []),
            ]

            // If no child nodes, add a placeholder
            const hasChildren = childNodes.length > 0

            // Node width and spacing for child row
            const NODE_W = 140
            const NODE_H = 60
            const GAP = 12
            const addSlot = isFlowWorkspace ? 1 : 0
            const totalChildren = Math.max((hasChildren ? childNodes.length : 0) + addSlot, 1)
            const rowWidth = totalChildren * NODE_W + (totalChildren - 1) * GAP
            const svgWidth = Math.max(rowWidth, 200)
            const centerX = svgWidth / 2

            return (
              <div className="flex flex-col items-center gap-0 py-4 min-w-[300px]" style={{ width: svgWidth + 40 }}>

                {/* 1. Customer Message */}
                <PipelineNode
                  icon={MessageCircle}
                  label="Customer Message"
                  color="#64748b"
                  bg="#f8fafc"
                  border="#e2e8f0"
                />

                {/* Arrow down */}
                <VerticalConnector />

                {/* 2. Router */}
                <PipelineNode
                  icon={Brain}
                  label={routerAgent?.name || 'Router'}
                  sublabel="Intent Routing"
                  color={getAgentColor('ROUTER')}
                  bg={getAgentColor('ROUTER') + '18'}
                  border={getAgentColor('ROUTER')}
                  isActive={routerAgent?.isActive ?? true}
                  bold
                  onClick={routerAgent ? () => handleNodeClick(routerAgent.id) : undefined}
                />

                {/* Fan-out SVG lines from Router to children */}
                {hasChildren && (
                  <div style={{ width: svgWidth + 40, position: 'relative' }}>
                    <svg
                      width={svgWidth + 40}
                      height={48}
                      style={{ display: 'block' }}
                      overflow="visible"
                    >
                      {childNodes.map((_, i) => {
                        const childCenterX = 20 + (i * (NODE_W + GAP)) + NODE_W / 2
                        return (
                          <line
                            key={i}
                            x1={centerX + 20}
                            y1={0}
                            x2={childCenterX}
                            y2={48}
                            stroke="#cbd5e1"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                          />
                        )
                      })}
                    </svg>
                  </div>
                )}

                {/* 3. Children row (sub-agents + sub-LLMs) */}
                {(hasChildren || isFlowWorkspace) ? (
                  <div className="flex gap-3 flex-wrap justify-center" style={{ width: svgWidth + 40 }}>
                    {childNodes.map((node) => {
                      const Icon = node.icon
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => {
                            if (node.isFlow && node.flowConfig) handleFlowNodeClick(node.flowConfig)
                            else if (node.agentId) handleNodeClick(node.agentId)
                          }}
                          className="group relative flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2.5 text-center transition-all hover:shadow-md hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
                          style={{ width: NODE_W, minHeight: NODE_H, borderColor: node.color, backgroundColor: node.color + '15' }}
                        >
                          {/* active dot */}
                          {node.isActive !== undefined && (
                            <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-white ${node.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                          )}
                          {/* edit icon on hover */}
                          <svg className="absolute top-1.5 left-1.5 w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: node.color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <Icon className="w-4 h-4 mt-1" style={{ color: node.color }} />
                          <span className="text-xs font-semibold leading-tight" style={{ color: node.color }}>{node.label}</span>
                          {node.isFlow && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-200 text-violet-700 font-bold">Sub-LLM</span>
                          )}
                          {node.sublabel && !node.isFlow && (
                            <span className="text-[9px] text-muted-foreground leading-none">{node.sublabel}</span>
                          )}
                        </button>
                      )
                    })}

                    {/* + Add Sub-LLM button (FLOW workspaces only) */}
                    {isFlowWorkspace && (
                      <button
                        type="button"
                        onClick={handleAddSubLLM}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-violet-300 px-3 py-2.5 text-violet-400 hover:border-violet-500 hover:text-violet-600 hover:bg-violet-50 transition-all cursor-pointer"
                        style={{ width: NODE_W, minHeight: NODE_H }}
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">Add Sub-LLM</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-gray-300 text-xs text-gray-400">
                    <Bot className="w-3 h-3" />
                    No sub-agents configured
                  </div>
                )}

                {/* Fan-in SVG lines from children to History */}
                {hasChildren && (
                  <div style={{ width: svgWidth + 40, position: 'relative' }}>
                    <svg
                      width={svgWidth + 40}
                      height={48}
                      style={{ display: 'block' }}
                      overflow="visible"
                    >
                      {childNodes.map((_, i) => {
                        const childCenterX = 20 + (i * (NODE_W + GAP)) + NODE_W / 2
                        return (
                          <line
                            key={i}
                            x1={childCenterX}
                            y1={0}
                            x2={centerX + 20}
                            y2={48}
                            stroke="#cbd5e1"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                          />
                        )
                      })}
                    </svg>
                  </div>
                )}

                {!hasChildren && <VerticalConnector />}

                {/* 4. Conversation History / Router Flow Agent */}
                {routerFlowConfig ? (
                  <PipelineNode
                    icon={MessageCircle}
                    label="History"
                    sublabel={routerFlowConfig.flowLabel}
                    color="#f97316"
                    bg="#fff7ed"
                    border="#fed7aa"
                    isActive={routerFlowConfig.isActive}
                    bold
                    onClick={() => handleFlowNodeClick(routerFlowConfig)}
                  />
                ) : (
                  <PipelineNode
                    icon={MessageCircle}
                    label="Conversation History"
                    sublabel="Context accumulated"
                    color="#f97316"
                    bg="#fff7ed"
                    border="#fed7aa"
                  />
                )}

                <VerticalConnector />

                {/* 5. Translation Layer */}
                {translationAgent ? (
                  <PipelineNode
                    icon={Globe}
                    label={translationAgent.name}
                    sublabel="Translation Layer"
                    color={getAgentColor('TRANSLATION')}
                    bg={getAgentColor('TRANSLATION') + '18'}
                    border={getAgentColor('TRANSLATION')}
                    bold
                    isActive={translationAgent.isActive ?? true}
                    onClick={() => handleNodeClick(translationAgent.id)}
                  />
                ) : (
                  <PipelineNode
                    icon={Globe}
                    label="Translation Layer"
                    color="#0d9488"
                    bg="#f0fdfa"
                    border="#99f6e4"
                  />
                )}

                <VerticalConnector />

                {/* 6. Security Layer */}
                {securityAgent ? (
                  <PipelineNode
                    icon={Shield}
                    label={securityAgent.name}
                    sublabel="Security Layer"
                    color={getAgentColor('SECURITY')}
                    bg={getAgentColor('SECURITY') + '18'}
                    border={getAgentColor('SECURITY')}
                    bold
                    isActive={securityAgent.isActive ?? true}
                    onClick={() => handleNodeClick(securityAgent.id)}
                  />
                ) : (
                  <PipelineNode
                    icon={Shield}
                    label="Security Layer"
                    color="#ef4444"
                    bg="#fef2f2"
                    border="#fecaca"
                  />
                )}

                <VerticalConnector />

                {/* 7. WhatsApp Queue — only for WhatsApp channel view */}
                {hasWhatsApp && (!hasBoth || channelView === 'whatsapp') && (() => {
                  const pendingCount = queueItems.filter(i => i.status === 'pending').length
                  const sentCount = queueItems.filter(i => i.status === 'sent').length
                  const errorCount = queueItems.filter(i => i.status === 'error' || i.status === 'blocked').length

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (!queuePanelOpen) fetchQueueData()
                          setQueuePanelOpen(!queuePanelOpen)
                        }}
                        className="group relative flex flex-col items-center gap-1 rounded-xl border-2 px-5 py-2.5 text-center transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        style={{ minWidth: 160, borderColor: '#22c55e', backgroundColor: '#f0fdf4' }}
                      >
                        <span
                          className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-white ${queueDebugMode ? 'bg-yellow-400' : 'bg-green-500'}`}
                        />
                        <Inbox className="w-4 h-4 mt-0.5" style={{ color: '#16a34a' }} />
                        <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>WhatsApp Queue</span>
                        {queuePanelOpen && !queueLoading && (
                          <span className="flex gap-2 text-[10px] mt-0.5">
                            <span className="text-yellow-600">⏳{pendingCount}</span>
                            <span className="text-green-600">✅{sentCount}</span>
                            <span className="text-red-500">❌{errorCount}</span>
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground">{queuePanelOpen ? '▲ close' : '▼ view queue'}</span>
                      </button>

                      {/* Expandable queue mini-panel */}
                      {queuePanelOpen && (
                        <div
                          className="w-full rounded-xl border border-green-200 bg-white shadow-sm overflow-hidden"
                          style={{ maxWidth: svgWidth + 40 }}
                        >
                          {/* Header row */}
                          <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border-b border-green-100">
                            <span className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                              <Inbox className="w-3.5 h-3.5" />
                              WhatsApp Queue
                            </span>
                            <div className="flex items-center gap-2 text-xs text-green-700">
                              <span>{queueDebugMode ? '🐛 Debug mode' : '● Active'}</span>
                              <Switch
                                checked={!queueDebugMode}
                                onCheckedChange={async (val) => {
                                  if (!workspace?.id) return
                                  try {
                                    await api.put(`/workspaces/${workspace.id}/whatsapp-queue/debug-mode`, { debugMode: !val })
                                    setQueueDebugMode(!val)
                                    toast.success(val ? 'Queue activated' : 'Debug mode on', { duration: 2000 })
                                  } catch (e) { toast.error('Failed to update queue mode') }
                                }}
                              />
                            </div>
                          </div>

                          {/* Stats row */}
                          {!queueLoading && (
                            <div className="flex gap-3 px-4 py-2 border-b border-gray-100 text-xs">
                              <span className="flex items-center gap-1 text-yellow-700 font-medium">
                                <Clock className="w-3 h-3" /> {pendingCount} Pending
                              </span>
                              <span className="flex items-center gap-1 text-green-700 font-medium">
                                <Send className="w-3 h-3" /> {sentCount} Sent
                              </span>
                              <span className="flex items-center gap-1 text-red-600 font-medium">
                                <XCircle className="w-3 h-3" /> {errorCount} Failed
                              </span>
                            </div>
                          )}

                          {/* Message list */}
                          {queueLoading ? (
                            <div className="flex items-center justify-center py-4 gap-2 text-xs text-muted-foreground">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                            </div>
                          ) : queueItems.length === 0 ? (
                            <div className="flex items-center justify-center py-4 gap-2 text-xs text-muted-foreground">
                              <CheckCircle className="w-3.5 h-3.5 text-green-400" /> Queue is empty
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                              {queueItems.map((item) => (
                                <div key={item.id} className="flex items-center gap-2 px-4 py-1.5 text-xs hover:bg-gray-50">
                                  <span
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                                      item.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                                      item.status === 'sent' ? 'bg-green-50 text-green-700' :
                                      'bg-red-50 text-red-600'
                                    }`}
                                  >
                                    {item.status === 'pending' ? <Clock className="w-2.5 h-2.5" /> :
                                     item.status === 'sent' ? <Send className="w-2.5 h-2.5" /> :
                                     <XCircle className="w-2.5 h-2.5" />}
                                    {item.status}
                                  </span>
                                  <span className="font-medium text-gray-700 shrink-0 w-24 truncate">{item.customer}</span>
                                  <span className="text-gray-400 truncate">{item.content}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )
                })()}

                <VerticalConnector />

                {/* 8. Response to Customer */}
                <PipelineNode
                  icon={MessageCircle}
                  label="Response to Customer"
                  color="#64748b"
                  bg="#f8fafc"
                  border="#e2e8f0"
                />

              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Agent Cards - CRUD Interface */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Agent Configuration</h2>
          <p className="text-xs text-muted-foreground">Click a node in the pipeline above to jump to its config</p>
        </div>
        {agents.map((agent) => {
          const formData = editingAgents[agent.id]
          if (!formData) return null

          const Icon = getAgentIcon(agent.agentType || "ROUTER")
          const isSaving = savingAgents[agent.id]

          return (
            <Card
              key={agent.id}
              id={`agent-card-${agent.id}`}
              className={`transition-all duration-500 ${highlightAgentId === agent.id ? 'ring-2 ring-primary ring-offset-2 shadow-lg' : ''}`}
            >
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
                    <Popover
                      open={!!modelComboOpen[agent.id]}
                      onOpenChange={(open) =>
                        setModelComboOpen((prev) => ({ ...prev, [agent.id]: open }))
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal"
                        >
                          <span className="truncate">
                            {OPENROUTER_MODELS.find((m) => m.value === formData.model)?.label ||
                              formData.model ||
                              "Select model..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0">
                        <Command>
                          <CommandInput placeholder="Search model..." />
                          <CommandList>
                            <CommandEmpty>No model found.</CommandEmpty>
                            <CommandGroup>
                              {OPENROUTER_MODELS.map((m) => (
                                <CommandItem
                                  key={m.value}
                                  value={m.value}
                                  onSelect={(val) => {
                                    handleFieldChange(agent.id, "model", val)
                                    setModelComboOpen((prev) => ({ ...prev, [agent.id]: false }))
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      formData.model === m.value ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{m.label}</span>
                                    <span className="text-xs text-muted-foreground">{m.value}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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

      {/* FlowConfigSheet — opened when clicking a Sub-LLM node or "+ Add Sub-LLM" */}
      {workspace?.id && (
        <FlowConfigSheet
          open={flowSheetOpen}
          onOpenChange={setFlowSheetOpen}
          workspaceId={workspace.id}
          config={selectedFlowConfig}
          onSaved={reloadFlowConfigs}
        />
      )}

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
