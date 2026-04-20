/**
 * AgentFlowDiagram - Full-screen visual representation of multi-agent architecture
 * 
 * Features:
 * - Beautiful visual flow diagram showing agent hierarchy
 * - Click on agent to edit prompt (slide panel)
 * - Help icon for each agent with explanation
 * - Hardcoded agents shown but not editable
 * - Reset to defaults button
 * - E-commerce agents filtered based on workspace type
 * 
 * @architecture Visual component for Agent Configuration page
 * @security All operations validated by workspaceId + agentId + token
 */
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Editor from "@monaco-editor/react"
import {
  GitBranch,
  Search,
  User,
  MessageSquare,
  HelpCircle,
  Edit3,
  Lock,
  ChevronDown,
  ChevronsUpDown,
  Check,
  Save,
  X,
  RefreshCcw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Download,
  Calendar,
  Star,
  Wrench,
  DollarSign,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { FlowConfigSheet } from "@/components/shared/FlowConfigSheet"
import { CallingFunctionSheet, CallingFunctionSheetItem } from "@/components/shared/CallingFunctionSheet"
import { HelpPanel } from "@/components/settings/HelpPanel"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/lib/toast"
import { logger } from "@/lib/logger"
import { api } from "@/services/api"
import { flowConfigApi, type FlowConfig } from "@/services/flowConfigApi"
import { callingFunctionsApi } from "@/services/callingFunctionApi"

// Types
interface AgentConfig {
  id: string
  name: string
  type: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  model: string
  order: number
  availableFunctions?: string[]
}

interface QueueMessage {
  id: string
  workspaceId: string
  customerId: string
  phoneNumber: string
  messageContent: string
  status: "pending" | "sent" | "error" | "blocked"
  errorMessage: string | null
  messageType?: "MESSAGE" | "PUSH"
  createdAt: string
  deliveredAt: string | null
  customer: { name: string; email: string | null }
}

interface AgentFlowDiagramProps {
  isEcommerce: boolean
  channelMode?: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'
  channelType?: 'WHATSAPP' | 'WIDGET' | null
  enableWelcomeMessage?: boolean
  hasHumanSupport?: boolean
  needRegistration?: boolean
  hasProductCatalog?: boolean
  hasCart?: boolean
  hasOrderTracking?: boolean
  enableCalendarBooking?: boolean
  agents: AgentConfig[]
  workspaceId: string
  onSaveAgent: (agentId: string, data: Partial<AgentConfig>) => Promise<void>
  onResetToDefaults: () => Promise<void>
  isLoading?: boolean
  className?: string
  flowConfigs?: FlowConfig[]
  onFlowConfigSaved?: () => void
  allCallingFunctions?: { functionName: string; description?: string; isSystemFunction?: boolean; executionType?: string; webhookUrl?: string | null; responseInstructions?: string | null }[]
}

// Available LLM Models with cost and performance ratings
const AVAILABLE_MODELS = [
  {
    id: "google/gemma-2-9b-it",
    label: "Gemma 2 9B",
    costStars: 1,
    performanceStars: 2,
  },
  {
    id: "deepseek/deepseek-chat",
    label: "DeepSeek Chat",
    costStars: 1,
    performanceStars: 3,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    costStars: 1,
    performanceStars: 3,
  },
  {
    id: "qwen/qwen-72b-chat",
    label: "Qwen 72B Chat",
    costStars: 2,
    performanceStars: 3,
  },
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    label: "Llama 3.1 70B",
    costStars: 2,
    performanceStars: 3,
  },
  {
    id: "mistral/mistral-large",
    label: "Mistral Large",
    costStars: 2,
    performanceStars: 4,
  },
  {
    id: "xai/grok-beta",
    label: "Grok Beta",
    costStars: 3,
    performanceStars: 4,
  },
  {
    id: "openai/gpt-4-turbo",
    label: "GPT-4 Turbo",
    costStars: 4,
    performanceStars: 4,
  },
  {
    id: "google/gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    costStars: 4,
    performanceStars: 4,
  },
  {
    id: "anthropic/claude-3-opus",
    label: "Claude 3 Opus",
    costStars: 4,
    performanceStars: 5,
  },
  {
    id: "anthropic/claude-3-5-sonnet",
    label: "Claude 3.5 Sonnet",
    costStars: 5,
    performanceStars: 5,
  },
]

// Helper component to render star ratings
const StarRating = ({ stars, maxStars = 5 }: { stars: number; maxStars?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: maxStars }).map((_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${i < stars ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
      />
    ))}
  </div>
)

// ─── Agent Metadata ─────────────────────────────────────────────────────────
// Each entry defines an LLM Agent with its visual representation and purpose.
//
// 🧠 AGENT = LLM with editable prompt, model, temperature, max tokens.
//    Users can click on agent nodes to edit these settings.
//
// ⚡ CALLING FUNCTION = Backend utility (no LLM). Rendered as amber/yellow blocks.
//    Calling functions are managed via "Available to this flow" checkboxes,
//    not via prompt editing.
//
// RESPONSIBILITIES PER LLM:
//   ROUTER - Brain: classifies intent, delegates to specialist agents. Needs: routing rules only.
//   PRODUCT_SEARCH - Catalog: searches products by name/category/certifications. Needs: {{products}}, {{categories}}.
//   CART_MANAGEMENT - Cart: add/remove items, checkout. Needs: cart context.
//   ORDER_TRACKING - Orders: track shipments, order history. Needs: order context.
//   CUSTOMER_SUPPORT - Escalation: handles complaints, transfers to human. Needs: {{faqs}}, escalation rules.
//   PROFILE_MANAGEMENT - Profile: updates customer info (address, email). Needs: customer data.
//   CONVERSATION_HISTORY - Humanizer: adds personality, remembers context. Needs: {{chatbotName}}, {{toneOfVoice}}.
//   TRANSLATION - Translator: translates to customer language. Needs: {{languageUser}}.
//   WIDGET_SECURITY - Sanitizer: blocks unsafe content for widget. Needs: security rules.
//   CALENDAR_BOOKING - Scheduler: books appointments. Needs: calendar config.
//
// ⚠️ Variables: Each agent should ONLY receive variables relevant to its responsibility.
//    Don't inject {{products}} into TRANSLATION (waste of tokens).
//    Don't inject {{faqs}} into CART_MANAGEMENT (irrelevant context).
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_METADATA: Record<string, {
  name: string
  icon: any
  color: string
  gradientFrom: string
  gradientTo: string
  borderColor: string
  description: string
  details: string
  whenUsed: string
  example: string
  ecommerceOnly?: boolean
  widgetOnly?: boolean
  isSubAgent?: boolean
  isHardcoded?: boolean
  availableFunctions?: string[]
}> = {
  ROUTER: {
    name: "Router Agent",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "The brain of the system",
    details: "Analyzes customer messages and decides which specialist agent to call. It reads the conversation history and context to make intelligent routing decisions.",
    whenUsed: "Every message goes through Router first",
    example: '"What products do you have?" → Routes to Product Search',
    availableFunctions: ["productSearchAgent", "cartManagementAgent", "orderTrackingAgent", "customerSupportAgent", "profileManagementAgent", "RESET_ACTIVE_AGENT"],
  },
  PRODUCT_SEARCH: {
    name: "Product Search",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "Searches products and catalog",
    details: "Handles product queries, searches the catalog, filters by certifications (Bio, DOP, IGP), shows categories and availability.",
    whenUsed: "Customer asks about products, prices, or availability",
    example: '"Do you have parmesan?" → Shows product list with details',
    ecommerceOnly: true,
    availableFunctions: ["getProductDetails", "getServiceDetails", "searchProductByCertifications"],
  },
  CART_MANAGEMENT: {
    name: "Cart Management",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "Manages shopping cart",
    details: "Adds/removes items from cart, applies discounts, calculates totals, guides through checkout process.",
    whenUsed: "Customer wants to add to cart, view cart, or checkout",
    example: '"Add 2 units" → Updates cart and shows summary',
    ecommerceOnly: true,
    availableFunctions: ["addToCart", "viewCart", "removeFromCart", "updateCartQuantity", "clearCart", "checkout"],
  },
  ORDER_TRACKING: {
    name: "Order Tracking",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "Tracks orders and shipments",
    details: "Shows order history, tracks shipments, provides delivery updates and estimated arrival times.",
    whenUsed: "Customer asks about their orders or delivery status",
    example: '"Where is my order?" → Shows order status with tracking',
    ecommerceOnly: true,
    availableFunctions: ["getOrderHistory", "getLastOrders", "getOrderDetails", "trackOrderStatus", "sendInvoice", "repeatLastOrder"],
  },
  CUSTOMER_SUPPORT: {
    name: "Customer Support",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "Handles support requests",
    details: "Answers FAQs, handles complaints, and escalates to human operators when the customer is frustrated or needs human help.",
    whenUsed: "Customer needs help, has questions, or wants to speak with a human",
    example: '"I have a problem with my order" → Provides support or escalates',
    availableFunctions: ["contactOperator"],
  },
  SUMMARY_AGENT: {
    name: "Summary Agent",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "Creates conversation summaries",
    details: "When a customer is transferred to a human operator, this agent creates a concise summary of the conversation to help the operator understand the situation quickly.",
    whenUsed: "When customer is transferred to a human operator",
    example: "Customer frustrated about delayed order → Summary for operator",
    isSubAgent: true,
    availableFunctions: [],
  },
  PROFILE_MANAGEMENT: {
    name: "Profile Management",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "Manages customer profiles",
    details: "Updates customer information: delivery address, email, phone, preferences, and notification settings.",
    whenUsed: "Customer wants to update their information",
    example: '"Change my delivery address" → Updates profile',
    availableFunctions: [],
  },
  CONVERSATION_HISTORY: {
    name: "Conversation History",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "Humanizes responses",
    details: "Adds personality and context-awareness to responses. Remembers previous interactions and maintains conversation tone for a more human feel.",
    whenUsed: "Applied to every response before sending",
    example: "Adds appropriate greetings and context-aware touches",
    availableFunctions: [],
  },
  TRANSLATION: {
    name: "Translation Layer",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "Translates responses to the customer language",
    details: "Translates responses to the customer's language while preserving formatting, links, and technical terms.",
    whenUsed: "Applied before final delivery",
    example: "Italian response → Translated to Spanish",
    availableFunctions: [],
  },
  WIDGET_SECURITY: {
    name: "Widget Security Layer",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "Validates safety for widget responses",
    details: "Applies security checks and blocks unsafe content. Uses the same prompt as WhatsApp scheduler security checks.",
    whenUsed: "Widget-only step after translation",
    example: "Blocks unsafe content for widget customers",
    widgetOnly: true,
    isHardcoded: false,
    availableFunctions: [],
  },
  SECURITY: {
    name: "Security Agent",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "Security validation (hidden)",
    details: "Validates all messages for security threats. This agent is hardcoded and not visible to users for security reasons.",
    whenUsed: "Always active in background",
    example: "Blocks malicious content before processing",
    isHardcoded: true,
    availableFunctions: ["sendAlertEmail"],
  },
  CALENDAR_BOOKING: {
    name: "Calendar Booking",
    icon: Sparkles,
    color: "purple",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
    borderColor: "border-purple-400",
    description: "Manages appointment scheduling",
    details: "Handles appointment booking: shows available slots, books appointments, cancels appointments, and shows customer's upcoming appointments. Requires customer to be registered.",
    whenUsed: "Customer wants to book, cancel, or view appointments",
    example: '"I want to book an appointment" → Shows available slots and books',
    availableFunctions: ["listAvailableSlots", "bookAppointment", "cancelAppointment", "getCustomerAppointments"],
  },
}

const INFO_AGENT_METADATA = {
  ...AGENT_METADATA.CUSTOMER_SUPPORT,
  name: "Info Agent",
  description: "Answers FAQs and informational requests",
  details: "Single agent for informational channels. Handles FAQ and knowledge requests and can call functions for human support or profile updates.",
  whenUsed: "Every message in informational channels",
  example: '"What are your hours?" → Answers from FAQ or knowledge',
  availableFunctions: ["contactOperator", "getProfileLink", "handlePushNotifications"],
}

// Agent Node Component
function AgentNode({
  agent,
  metadata,
  displayName,
  isEditable,
  isActive,
  onClick,
  size = "normal",
  className,
}: {
  agent?: AgentConfig
  metadata: typeof AGENT_METADATA.ROUTER
  displayName?: string
  isEditable: boolean
  isActive: boolean
  onClick?: () => void
  size?: "small" | "normal" | "large"
  className?: string
}) {
  const Icon = metadata.icon
  const name = displayName || metadata.name
  
  const sizeClasses = {
    small: { box: "px-3 py-2 h-[44px]", icon: "h-4 w-4", text: "text-xs" },
    normal: { box: "px-4 py-3 h-[52px]", icon: "h-5 w-5", text: "text-sm" },
    large: { box: "px-6 py-4 h-[56px]", icon: "h-6 w-6", text: "text-base" },
  }
  
  const classes = sizeClasses[size]
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={!isActive}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl border-2 transition-all duration-200",
              classes.box,
              isActive
                ? `bg-gradient-to-r ${metadata.gradientFrom} ${metadata.gradientTo} text-white shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer`
                : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50",
              metadata.borderColor,
              className,
            )}
          >
            {/* Icon */}
            <div className={cn(
              "p-1.5 rounded-lg",
              isActive ? "bg-white/20" : "bg-gray-200",
            )}>
              <Icon className={cn(classes.icon, isActive ? "text-white" : "text-gray-400")} />
            </div>
            
            {/* Name */}
            <span className={cn("font-semibold", classes.text)}>
              {name}
            </span>
            
            {/* Edit or Lock icon */}
            {isActive && (
              <div className="ml-auto flex items-center gap-1">
                {metadata.isHardcoded ? (
                  <Lock className="h-3 w-3 opacity-70" />
                ) : isEditable ? (
                  <Edit3 className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                ) : null}
                <HelpCircle className="h-3 w-3 opacity-50 group-hover:opacity-100" />
              </div>
            )}
            
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs p-4">
          <div className="space-y-2">
            <p className="font-semibold flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {name}
            </p>
            <p className="text-sm text-gray-600">{metadata.description}</p>
            <div className="text-xs text-gray-500 border-t pt-2 mt-2">
              <p><strong>When used:</strong> {metadata.whenUsed}</p>
              <p className="text-blue-600 mt-1"><strong>Example:</strong> {metadata.example}</p>
            </div>
            {metadata.isHardcoded && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
                <Lock className="h-3 w-3" />
                Hardcoded - Not editable
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Connector Arrow
function ConnectorArrow({ 
  direction = "down",
  className,
}: { 
  direction?: "down" | "left" | "right"
  className?: string 
}) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      {direction === "down" && (
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-6 bg-gradient-to-b from-gray-300 to-gray-400" />
          <ChevronDown className="h-4 w-4 text-gray-400 -mt-1" />
        </div>
      )}
    </div>
  )
}

// Horizontal Branch Line
function BranchLine({ className }: { className?: string }) {
  return (
    <div className={cn("h-0.5 bg-gradient-to-r from-gray-300 to-gray-400", className)} />
  )
}

// Main Component
export function AgentFlowDiagram({
  isEcommerce,
  channelMode,
  channelType,
  enableWelcomeMessage = true,
  hasHumanSupport = true,
  needRegistration = true,
  hasProductCatalog = true,
  hasCart = true,
  hasOrderTracking = true,
  enableCalendarBooking = false,
  agents,
  workspaceId,
  onSaveAgent,
  onResetToDefaults,
  isLoading = false,
  className,
  flowConfigs = [],
  onFlowConfigSaved,
  allCallingFunctions = [],
}: AgentFlowDiagramProps) {
  const isFlow = channelMode === 'FLOW'
  const navigate = useNavigate()
  
  // Mapping from calling function name to agent type
  const functionToAgentMap: Record<string, string> = {
    'productSearchAgent': 'PRODUCT_SEARCH',
    'cartManagementAgent': 'CART_MANAGEMENT',
    'orderTrackingAgent': 'ORDER_TRACKING',
    'customerSupportAgent': 'CUSTOMER_SUPPORT',
    'profileManagementAgent': 'PROFILE_MANAGEMENT',
    'calendarBookingAgent': 'CALENDAR_BOOKING',
  }
  
  // Generic metadata for calling functions (NOT agents — use amber/yellow palette to distinguish)
  // Calling functions are backend utilities that perform a specific action (no LLM involved).
  // They are visually distinct from Agent nodes (which are LLMs with editable prompts).
  const getCallingFunctionMetadata = (functionName: string) => {
    const functionMeta: Record<string, any> = {
      'changeLanguage': {
        name: 'Change Language',
        icon: Wrench,
        color: 'amber',
        gradientFrom: 'from-amber-400',
        gradientTo: 'to-yellow-500',
        borderColor: 'border-amber-300',
        description: 'Changes customer preferred language. No LLM — direct DB update.',
      },
      'manageNotifications': {
        name: 'Notifications',
        icon: Wrench,
        color: 'amber',
        gradientFrom: 'from-amber-400',
        gradientTo: 'to-yellow-500',
        borderColor: 'border-amber-300',
        description: 'Manage push notification preferences. No LLM — direct DB update.',
      },
      'getProfileLink': {
        name: 'Profile Link',
        icon: Wrench,
        color: 'amber',
        gradientFrom: 'from-amber-400',
        gradientTo: 'to-yellow-500',
        borderColor: 'border-amber-300',
        description: 'Generates a secure registration link. No LLM — token generation.',
      },
      'contactOperator': {
        name: 'Contact Operator',
        icon: Wrench,
        color: 'amber',
        gradientFrom: 'from-amber-400',
        gradientTo: 'to-yellow-500',
        borderColor: 'border-amber-300',
        description: 'Escalates to human operator. No LLM — sends notification email.',
      },
    }
    
    return functionMeta[functionName] || {
      name: functionName,
      icon: Wrench,
      color: 'amber',
      gradientFrom: 'from-amber-400',
      gradientTo: 'to-yellow-500',
      borderColor: 'border-amber-300',
      description: 'Calling function (no LLM)',
    }
  }
  
  // State
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null)
  const [editedPrompt, setEditedPrompt] = useState("")
  const [editedTemperature, setEditedTemperature] = useState(0.7)
  const [editedMaxTokens, setEditedMaxTokens] = useState(1000)
  const [editedModel, setEditedModel] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [helpAgent, setHelpAgent] = useState<string | null>(null)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  
  // Editable calling functions for agent
  const [editedFunctions, setEditedFunctions] = useState<string[]>([])

  // FLOW workspace state
  const [flowSheetOpen, setFlowSheetOpen] = useState(false)
  const [selectedFlowConfig, setSelectedFlowConfig] = useState<FlowConfig | null>(null)
  const [deleteFlowConfig, setDeleteFlowConfig] = useState<FlowConfig | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [callingFunctionSheetOpen, setCallingFunctionSheetOpen] = useState(false)
  const [editingCallingFunction, setEditingCallingFunction] = useState<CallingFunctionSheetItem | null>(null)
  const [addPopoverOpen, setAddPopoverOpen] = useState(false)
  const [deleteCallingFunctionName, setDeleteCallingFunctionName] = useState<string | null>(null)
  const [isDeletingCallingFunction, setIsDeletingCallingFunction] = useState(false)

  // WhatsApp Queue panel state
  const [queuePanelOpen, setQueuePanelOpen] = useState(false)
  const [queueMessages, setQueueMessages] = useState<QueueMessage[]>([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueFilter, setQueueFilter] = useState<"all" | "pending" | "sent" | "error">("all")
  const [queueSearch, setQueueSearch] = useState("")

  const fetchQueueMessages = async () => {
    if (!workspaceId) return
    setQueueLoading(true)
    try {
      const response = await api.get(`/workspaces/${workspaceId}/whatsapp-queue`)
      setQueueMessages(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      logger.error("Failed to fetch queue messages:", error)
    } finally {
      setQueueLoading(false)
    }
  }

  useEffect(() => {
    if (!queuePanelOpen) return
    fetchQueueMessages()
    const interval = setInterval(fetchQueueMessages, 5000)
    return () => clearInterval(interval)
  }, [queuePanelOpen, workspaceId])

  const getResolvedMeta = (type: string) => {
    if (!isEcommerce && type === "INFO_AGENT") {
      return INFO_AGENT_METADATA
    }
    return AGENT_METADATA[type]
  }

  const getAgentDisplayName = (type: string, meta: typeof AGENT_METADATA[keyof typeof AGENT_METADATA]): string => {
    if (!isEcommerce && type === "INFO_AGENT") {
      return "Info Agent"
    }
    return meta.name
  }

  const normalizeAgentType = (type: string) => {
    return type.toUpperCase() === "WIDGET_SECURITY" ? "SECURITY" : type
  }

  // Get agent by type (Widget Security maps to SECURITY config)
  const getAgent = (type: string): AgentConfig | undefined => {
    const normalized = normalizeAgentType(type)
    const agent = agents.find(
      (a) => a.type.toUpperCase() === normalized.toUpperCase()
    )

    if (!agent) return undefined

    if (type.toUpperCase() === "WIDGET_SECURITY") {
      return {
        ...agent,
        type: "WIDGET_SECURITY",
        name: "Security Layer",
      }
    }

    return agent
  }

  // Check if agent exists in database
  const agentExists = (type: string): boolean => {
    return !!getAgent(type)
  }

  // Check if agent should be shown (exists in DB and passes filters)
  const shouldShowAgent = (type: string): boolean => {
    // Must exist in database
    if (!agentExists(type)) return false
    
    const meta = getResolvedMeta(type)
    if (!meta) return false
    if (meta.ecommerceOnly && !isEcommerce) return false
    // ROUTER hidden for non-ecommerce; PROFILE_MANAGEMENT controlled by needRegistration
    if (!isEcommerce && !isFlow && type === "ROUTER") return false
    if (type === "PROFILE_MANAGEMENT" && !needRegistration) return false
    if (type === "CUSTOMER_SUPPORT" && !hasHumanSupport) return false
    if (type === "SECURITY") return false // Always hidden
    return true
  }

  // Handle agent click - only if agent exists in database
  const handleAgentClick = (type: string) => {
    const meta = getResolvedMeta(type)
    if (!meta) return
    
    // If hardcoded, show help instead of edit
    if (meta.isHardcoded) {
      setHelpAgent(type)
      setIsHelpOpen(true)
      return
    }
    
    const agent = getAgent(type)
    if (!agent) {
      toast.error(`${getAgentDisplayName(type, meta)} is not configured. Use "Reset to Defaults" to create missing agents.`)
      return
    }
    
    setSelectedAgent(agent)
    setEditedPrompt(agent.systemPrompt || "")
    setEditedTemperature(agent.temperature || 0.7)
    setEditedMaxTokens(agent.maxTokens || 1000)
    setEditedModel(agent.model || "mistral/mistral-large")
    setEditedFunctions(agent.availableFunctions || [])
  }

  // Handle calling function click — open CallingFunctionSheet in EDIT mode
  const handleCallingFunctionClick = (functionName: string) => {
    const fn = allCallingFunctions.find((f) => f.functionName === functionName)
    if (fn) {
      setEditingCallingFunction({
        functionName: fn.functionName,
        description: fn.description || "",
        executionType: (fn as any).executionType || "INTERNAL",
        webhookUrl: (fn as any).webhookUrl || null,
        responseInstructions: (fn as any).responseInstructions || null,
      })
    } else {
      // System function or missing metadata — open with minimal info
      setEditingCallingFunction({
        functionName,
        description: "",
        executionType: "INTERNAL",
      })
    }
    setCallingFunctionSheetOpen(true)
  }

  // Handle save
  const handleSave = async () => {
    if (!selectedAgent) return

    try {
      setIsSaving(true)
      await onSaveAgent(selectedAgent.id, {
        systemPrompt: editedPrompt,
        temperature: editedTemperature,
        maxTokens: editedMaxTokens,
        model: editedModel,
        availableFunctions: editedFunctions,
      })
      setSelectedAgent(null)
    } catch (error) {
      logger.error("Failed to save agent:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle reset
  const handleReset = async () => {
    try {
      setIsResetting(true)
      await onResetToDefaults()
      // Toast shown by parent component
      setIsResetDialogOpen(false)
    } catch (error) {
      logger.error("Failed to reset prompts:", error)
      toast.error("Failed to reset prompts")
    } finally {
      setIsResetting(false)
    }
  }

  // Handle download - exports all agent prompts as JSON backup
  const handleDownloadPrompts = () => {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        workspaceId,
        workspaceType: isEcommerce ? "ecommerce" : "informational",
        agents: agents.map(agent => ({
          type: agent.type,
          name: isFlow
            ? agent.name
            : !isEcommerce && (agent.type.toUpperCase() === "CUSTOMER_SUPPORT" || agent.type.toUpperCase() === "INFO_AGENT")
            ? "Info Agent"
            : agent.name,
          systemPrompt: agent.systemPrompt,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
        }))
      }
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `agent-prompts-${isEcommerce ? "ecommerce" : "info"}-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success("Prompts downloaded successfully!")
    } catch (error) {
      logger.error("Failed to download prompts:", error)
      toast.error("Failed to download prompts")
    }
  }

  // Handle flow node click - open FlowConfigSheet for editing
  const handleFlowNodeClick = (fc: FlowConfig) => {
    setSelectedFlowConfig(fc)
    setFlowSheetOpen(true)
  }

  // Handle add new flow config (Sub-LLM agent)
  const handleAddFlowConfig = () => {
    setAddPopoverOpen(false)
    setSelectedFlowConfig(null)
    setFlowSheetOpen(true)
  }

  // Handle add new calling function (CREATE mode)
  const handleAddCallingFunction = () => {
    setAddPopoverOpen(false)
    setEditingCallingFunction(null) // null = create mode
    setCallingFunctionSheetOpen(true)
  }

  // Handle calling function saved from sheet (create or edit)
  const handleCallingFunctionSaved = async () => {
    setCallingFunctionSheetOpen(false)
    setEditingCallingFunction(null)
    onFlowConfigSaved?.()
  }

  // Handle delete calling function from Router's availableFunctions
  const handleDeleteCallingFunction = async () => {
    if (!deleteCallingFunctionName || !routerFlowConfig) return
    setIsDeletingCallingFunction(true)
    try {
      const updatedFunctions = ((routerFlowConfig.availableFunctions as string[]) || []).filter(
        (f) => f !== deleteCallingFunctionName
      )
      await flowConfigApi.update(workspaceId, routerFlowConfig.id, {
        availableFunctions: updatedFunctions,
      })
      toast.success(`Removed "${deleteCallingFunctionName}" from Router`)
      setDeleteCallingFunctionName(null)
      onFlowConfigSaved?.()
    } catch (error) {
      logger.error("Error removing calling function:", error)
      toast.error("Failed to remove calling function")
    } finally {
      setIsDeletingCallingFunction(false)
    }
  }

  // Handle flow config saved (create or update)
  // Backend FlowSyncService handles cascade: auto-create calling function + add to Router
  const handleFlowConfigSaved = async () => {
    onFlowConfigSaved?.()
  }

  // Handle delete flow config — backend FlowSyncService handles cascade cleanup
  const handleDeleteFlowConfig = async () => {
    if (!deleteFlowConfig) return
    
    setIsDeleting(true)
    try {
      await flowConfigApi.remove(workspaceId, deleteFlowConfig.id)
      
      toast.success(`Deleted Sub-LLM "${deleteFlowConfig.flowLabel}" and its calling function`)
      setDeleteFlowConfig(null)
      onFlowConfigSaved?.()
    } catch (error) {
      logger.error("Error deleting flow config:", error)
      toast.error("Failed to delete Sub-LLM")
    } finally {
      setIsDeleting(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-96", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const selectedMeta = selectedAgent ? getResolvedMeta(selectedAgent.type.toUpperCase()) : null
  const helpMeta = helpAgent ? getResolvedMeta(helpAgent) : null
  const routerFlowConfig = isFlow
    ? flowConfigs.find((fc) => fc.flowKey === "router")
    : undefined
  
  return (
    <div className={cn("bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 rounded-2xl p-8 border border-slate-200 shadow-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl">
              <GitBranch className="h-6 w-6 text-white" />
            </div>
            {isFlow ? "Flow Agent Pipeline" : isEcommerce ? "E-commerce Agent Flow" : "Informational Agent Flow"}
          </h2>
          <p className="text-gray-500 mt-1">
            {isFlow
              ? "Deterministic flow engine with per-flow Sub-LLM configuration"
              : isEcommerce 
              ? "Full e-commerce flow with product search, cart, and order management"
              : "Streamlined flow for FAQ and customer support"
            }
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-sm px-3 py-1.5 rounded-full flex items-center gap-2 font-medium",
            isFlow
              ? "bg-violet-100 text-violet-700"
              : isEcommerce 
              ? "bg-green-100 text-green-700"
              : "bg-blue-100 text-blue-700"
          )}>
            {isFlow ? "⚙️ Flow Mode" : isEcommerce ? "🛒 E-commerce Mode" : "ℹ️ Info-only mode"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPrompts}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Prompts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsResetDialogOpen(true)}
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
        </div>
      </div>

      {/* Flow Diagram */}
      <div className="flex flex-col items-center py-8">
        
        {/* Customer Message */}
        <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-full border-2 border-gray-300 shadow-sm">
          <MessageSquare className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-700">Customer Message</span>
        </div>
        
        <ConnectorArrow />
        
        {/* Router — For FLOW: opens FlowConfigSheet (router config), for others: opens agent edit */}
        <div className="relative">
          <AgentNode
            agent={isFlow ? undefined : (getAgent(isEcommerce ? "ROUTER" : "INFO_AGENT") || getAgent("CUSTOMER_SUPPORT"))}
            metadata={isFlow ? {
              ...AGENT_METADATA.ROUTER,
              name: "Router",
              gradientFrom: "from-violet-500",
              gradientTo: "to-purple-600",
              borderColor: "border-violet-400",
            } : getResolvedMeta(isEcommerce ? "ROUTER" : "INFO_AGENT")}
            displayName={
              isFlow
                ? "Router"
                : isEcommerce
                  ? "Router Agent"
                  : getAgentDisplayName("INFO_AGENT", INFO_AGENT_METADATA)
            }
            isEditable={true}
            isActive={true}
            onClick={() => {
              if (isFlow && routerFlowConfig) {
                handleFlowNodeClick(routerFlowConfig)
              } else {
                handleAgentClick(isEcommerce ? "ROUTER" : (getAgent("INFO_AGENT") ? "INFO_AGENT" : "CUSTOMER_SUPPORT"))
              }
            }}
            size="large"
          />
          {/* FLOW only: Add button floating on bottom-right of Router */}
          {isFlow && (
            <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className="absolute -bottom-2.5 -right-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-violet-500 text-white shadow-md hover:bg-violet-600 hover:scale-110 transition-all duration-200 cursor-pointer z-10 border-2 border-white"
                  title="Add Sub-LLM or Calling Function"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end" side="bottom">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={handleAddFlowConfig}
                    className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-violet-50 transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Agent (Sub-LLM)</div>
                      <div className="text-[11px] text-gray-500">AI agent with prompt &amp; model</div>
                    </div>
                  </button>
                  <button
                    onClick={handleAddCallingFunction}
                    className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-amber-50 transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500">
                      <Wrench className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Calling Function</div>
                      <div className="text-[11px] text-gray-500">Webhook, internal or delegate</div>
                    </div>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        
        <ConnectorArrow />

        {/* FLOW Sub-LLMs Branch (machine configs only — excludes flowKey="router"). Branches directly from Router. */}
        {isFlow && (() => {
          const machineFlowConfigs = flowConfigs.filter(fc => fc.flowKey !== 'router')
          
          // In FLOW mode, read availableFunctions from Router FlowNodeConfig, not AgentConfig
          const routerFlowConfig = flowConfigs.find(fc => fc.flowKey === 'router')
          const routerFunctions = (routerFlowConfig?.availableFunctions as string[]) || []
          
          // Get flowKeys to exclude them from calling functions
          const flowKeys = flowConfigs.map(fc => fc.flowKey)
          
          // Separate Router's availableFunctions into:
          // - agentFunctions: functions that delegate to an Agent LLM (editable prompt/model)
          // - callingFunctions: utility functions (no LLM, just backend logic)
          // - Exclude RESET_ACTIVE_AGENT (internal)
          // - Exclude flowKeys (already shown as Sub-LLMs)
          const agentFunctions: string[] = []
          const callingFunctions: string[] = []
          
          routerFunctions.forEach(funcName => {
            if (funcName === 'RESET_ACTIVE_AGENT') return
            if (flowKeys.includes(funcName)) return
            
            // Check if this function maps to an Agent (LLM with editable prompt)
            if (functionToAgentMap[funcName]) {
              agentFunctions.push(funcName)
            } else {
              callingFunctions.push(funcName)
            }
          })
          
          return (
          <>
            <div className="relative w-full max-w-5xl">
              {/* Horizontal line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] h-0.5 bg-gradient-to-r from-transparent via-violet-300 to-transparent" />
              
              {/* Flow config nodes + Agent nodes + Calling functions + Add button */}
              <div className="flex items-end justify-center gap-3 pt-6 flex-wrap">
                {/* Sub-LLMs (flowConfigs) */}
                {machineFlowConfigs.map((fc) => (
                  <div key={fc.id} className="flex flex-col items-center">
                    <div className="w-0.5 h-4 bg-violet-300 -mt-4" />
                    <div className="relative group/node">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleFlowNodeClick(fc)}
                              className={cn(
                                "relative flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 h-[52px] transition-all duration-200",
                                fc.isActive
                                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer border-violet-400"
                                  : "bg-gray-100 text-gray-400 border-gray-200 cursor-pointer opacity-60 hover:opacity-80"
                              )}
                            >
                              <div className={cn("p-1.5 rounded-lg", fc.isActive ? "bg-white/20" : "bg-gray-200")}>
                                <Sparkles className={cn("h-4 w-4", fc.isActive ? "text-white" : "text-gray-400")} />
                              </div>
                              <div className="flex flex-col items-start">
                                <span className="font-semibold text-xs">{fc.flowLabel}</span>
                                <span className={cn("text-[10px] font-mono", fc.isActive ? "text-white/70" : "text-gray-400")}>
                                  {fc.flowKey}
                                </span>
                              </div>
                              <Edit3 className="h-3 w-3 opacity-50 group-hover/node:opacity-100 ml-1" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs p-3">
                            <div className="space-y-1.5">
                              <p className="font-semibold text-sm">{fc.flowLabel}</p>
                              <p className="text-xs text-gray-500">Key: <code className="bg-gray-100 px-1 rounded">{fc.flowKey}</code></p>
                              <p className="text-xs text-gray-500">Model: {fc.model || "default"}</p>
                              <p className="text-xs text-blue-600 mt-1">Click to edit</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {/* Delete button — appears on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteFlowConfig(fc)
                        }}
                        className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover/node:opacity-100 transition-opacity shadow-md hover:bg-red-600 z-10"
                        title="Delete Sub-LLM"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Agent LLMs (editable prompt/model) — dynamically from Router's availableFunctions */}
                {agentFunctions.map((funcName) => {
                  const agentType = functionToAgentMap[funcName]
                  if (!agentType) return null
                  
                  // Must exist in database to be clickable/editable
                  if (!agentExists(agentType)) return null
                  
                  // Check visibility rules
                  if (agentType === 'CUSTOMER_SUPPORT' && !hasHumanSupport) return null
                  if (agentType === 'PROFILE_MANAGEMENT' && !needRegistration) return null
                  
                  const meta = AGENT_METADATA[agentType]
                  if (!meta) return null
                  
                  return (
                    <div key={funcName} className="flex flex-col items-center">
                      <div className="w-0.5 h-4 bg-violet-300 -mt-4" />
                      <AgentNode
                        agent={getAgent(agentType)}
                        metadata={meta}
                        isEditable={true}
                        isActive={true}
                        onClick={() => handleAgentClick(agentType)}
                        size="normal"
                      />
                    </div>
                  )
                })}

                {/* Calling Functions (no LLM — backend utilities) — amber/yellow style */}
                {callingFunctions.map((funcName) => {
                  // getProfileLink is only shown when customer registration is enabled
                  if (funcName === 'getProfileLink' && !needRegistration) return null
                  // contactOperator is only shown when human support is enabled
                  if (funcName === 'contactOperator' && !hasHumanSupport) return null

                  const funcMeta = getCallingFunctionMetadata(funcName)
                  const FuncIcon = funcMeta.icon
                  
                  return (
                    <div key={funcName} className="flex flex-col items-center">
                      <div className="w-0.5 h-4 bg-violet-300 -mt-4" />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative group/cfnode">
                              <div
                                onClick={() => handleCallingFunctionClick(funcName)}
                                className="group relative flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 h-[52px] transition-all duration-200 bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-md border-amber-300 cursor-pointer hover:shadow-lg hover:scale-105"
                              >
                                <div className="p-1.5 rounded-lg bg-white/20">
                                  <FuncIcon className="h-4 w-4 text-white" />
                                </div>
                                <span className="font-semibold text-xs">{funcMeta.name}</span>
                                <Edit3 className="h-3 w-3 text-white opacity-50 group-hover:opacity-100 transition-opacity ml-1" />
                              </div>
                              {/* Delete button — appears on hover */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteCallingFunctionName(funcName)
                                }}
                                className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover/cfnode:opacity-100 transition-opacity shadow-md hover:bg-red-600 z-10"
                                title="Remove from Router"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs p-3">
                            <div className="space-y-1.5">
                              <p className="font-semibold text-sm flex items-center gap-2">
                                <FuncIcon className="h-4 w-4" />
                                {funcMeta.name}
                              </p>
                              <p className="text-xs text-gray-600">{funcMeta.description}</p>
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Calling Function</Badge>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )
                })}

              </div>
            </div>
            
            {/* Merge line */}
            <div className="w-[60%] max-w-md h-0.5 bg-gradient-to-r from-transparent via-violet-300 to-transparent mt-6" />
            
            <ConnectorArrow />
          </>
          )
        })()}
        
        {/* Specialists Branch (E-commerce only) - DYNAMIC based on Router's availableFunctions */}
        {isEcommerce && !isFlow && (() => {
          const routerAgent = getAgent("ROUTER")
          const routerFunctions = routerAgent?.availableFunctions || []
          
          if (routerFunctions.length === 0) return null
          
          return (
            <>
              <div className="relative w-full max-w-5xl">
                {/* Horizontal line */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] h-0.5 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                
                {/* Agent boxes - DYNAMIC from Router's availableFunctions */}
                <div className="flex items-end justify-center gap-2 pt-6 flex-wrap">
                  {routerFunctions.map((funcName) => {
                    // Skip RESET_ACTIVE_AGENT (internal function)
                    if (funcName === 'RESET_ACTIVE_AGENT') return null
                    
                    // Check if this function maps to an agent
                    const agentType = functionToAgentMap[funcName]
                    
                    if (agentType) {
                      // It's an agent - check if it exists and should be shown
                      if (!agentExists(agentType)) return null
                      if (!shouldShowAgent(agentType)) return null
                      
                      return (
                        <div key={funcName} className="flex flex-col items-center">
                          <div className="w-0.5 h-4 bg-gray-300 -mt-4" />
                          <AgentNode
                            agent={getAgent(agentType)}
                            metadata={AGENT_METADATA[agentType]}
                            isEditable={true}
                            isActive={true}
                            onClick={() => handleAgentClick(agentType)}
                            size="normal"
                          />
                        </div>
                      )
                    } else {
                      // It's a calling function (not an agent) — amber/yellow style, no LLM
                      const funcMeta = getCallingFunctionMetadata(funcName)
                      const FuncIcon = funcMeta.icon
                      
                      return (
                        <div key={funcName} className="flex flex-col items-center">
                          <div className="w-0.5 h-4 bg-gray-300 -mt-4" />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  onClick={() => handleCallingFunctionClick(funcName)}
                                  className="group relative flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 h-[52px] transition-all duration-200 bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-md border-amber-300 cursor-pointer hover:shadow-lg hover:scale-105"
                                >
                                  <div className="p-1.5 rounded-lg bg-white/20">
                                    <FuncIcon className="h-4 w-4 text-white" />
                                  </div>
                                  <span className="font-semibold text-xs">{funcMeta.name}</span>
                                  <Edit3 className="h-3 w-3 text-white opacity-50 group-hover:opacity-100 transition-opacity ml-1" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs p-3">
                                <div className="space-y-1.5">
                                  <p className="font-semibold text-sm flex items-center gap-2">
                                    <FuncIcon className="h-4 w-4" />
                                    {funcMeta.name}
                                  </p>
                                  <p className="text-xs text-gray-600">{funcMeta.description}</p>
                                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Calling Function</Badge>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )
                    }
                  })}
                </div>
              </div>
              
              {/* Merge line */}
              <div className="w-[60%] max-w-md h-0.5 bg-gradient-to-r from-transparent via-gray-300 to-transparent mt-6" />
              
              <ConnectorArrow />
            </>
          )
        })()}
        
        {/* Conversation History (E-commerce and FLOW) */}
        {(isEcommerce || isFlow) && (
          <>
            <div className="flex flex-col items-center gap-1">
              <AgentNode
                agent={getAgent("CONVERSATION_HISTORY")}
                metadata={AGENT_METADATA.CONVERSATION_HISTORY}
                isEditable={true}
                isActive={true}
                onClick={() => handleAgentClick("CONVERSATION_HISTORY")}
                size="large"
                className="w-[272px]"
              />
              <span className="text-xs text-amber-700">Humanization layer</span>
            </div>

            <ConnectorArrow />
          </>
        )}
        
        {/* Translation Layer */}
        <div className="flex flex-col items-center gap-1">
          <AgentNode
            agent={getAgent("TRANSLATION")}
            metadata={AGENT_METADATA.TRANSLATION}
            isEditable={true}
            isActive={true}
            onClick={() => handleAgentClick("TRANSLATION")}
            size="large"
            className="w-[272px]"
          />
        </div>

        <ConnectorArrow />

        {/* Security Layer */}
        <div className="flex flex-col items-center gap-1">
          <AgentNode
            agent={getAgent("WIDGET_SECURITY")}
            metadata={AGENT_METADATA.WIDGET_SECURITY}
            isEditable={true}
            isActive={true}
            onClick={() => handleAgentClick("WIDGET_SECURITY")}
            size="large"
            className="w-[272px]"
          />
        </div>
        
        <ConnectorArrow />

        {/* WhatsApp Queue — clickable, opens slide panel — shown for WhatsApp channels only */}
        {channelType !== 'WIDGET' && (
          <>
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => setQueuePanelOpen(true)}
                className="flex items-center gap-2.5 rounded-xl border-2 border-green-300 bg-green-50 px-5 py-3 shadow-sm hover:shadow-md hover:bg-green-100 hover:scale-105 transition-all duration-200 cursor-pointer w-[272px]"
              >
                <div className="p-1.5 rounded-lg bg-green-100">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-bold text-sm text-green-700">WhatsApp Queue</span>
                  <span className="text-[10px] text-green-600">Scheduler · 6s cooldown</span>
                </div>
                <Edit3 className="h-3 w-3 text-green-500 opacity-50 hover:opacity-100" />
              </button>
            </div>
            <ConnectorArrow />
          </>
        )}
        
        {/* Final Response */}
        <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span className="font-medium">Response to Customer</span>
        </div>

        <ConnectorArrow />

        {/* Recharge block */}
        <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-full shadow-lg">
          <DollarSign className="h-5 w-5" />
          <span className="font-medium">Recharge</span>
        </div>

        {/* Legend */}
        <div className="mt-8 w-full max-w-2xl">
          <div className="flex flex-wrap gap-4 items-center justify-center text-xs text-gray-500 border border-gray-200 rounded-xl px-6 py-3 bg-white/60">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600">
                <Edit3 className="h-3 w-3 text-white" />
              </div>
              <span>Click to edit</span>
            </div>
            {isEcommerce && (
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">E-commerce only</span>
              </div>
            )}
            {channelType === "WIDGET" && (
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">Widget only</span>
              </div>
            )}
          </div>
        </div>

        
      </div>



      {/* Enterprise Message — hidden for FLOW (they already have custom flows) */}
      {!isFlow && (
        <div className="flex items-center justify-center mt-8">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg px-4 py-2 text-sm text-purple-700">
            <Sparkles className="h-4 w-4 inline mr-2" />
            Want custom agent flows? <span className="font-semibold">Upgrade to Enterprise</span> for advanced customization.
          </div>
        </div>
      )}

      {/* Flow Config Summary removed */}

      {/* WhatsApp Queue Side Panel */}
      <Sheet open={queuePanelOpen} onOpenChange={setQueuePanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col overflow-hidden">
          <SheetHeader className="shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-green-100">
                <MessageSquare className="h-4 w-4 text-green-600" />
              </div>
              WhatsApp Queue
            </SheetTitle>
            <SheetDescription>Messages queued for delivery in this workspace</SheetDescription>
          </SheetHeader>

          {/* Filters */}
          <div className="shrink-0 flex flex-col gap-2 mt-4">
            <Input
              placeholder="Search by name, phone or content..."
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-1 flex-wrap">
              {(["all", "pending", "sent", "error"] as const).map((f) => {
                const labels: Record<string, string> = { all: "All", pending: "⏳ Pending", sent: "✅ Sent", error: "❌ Failed" }
                const colors: Record<string, string> = {
                  all: queueFilter === "all" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600",
                  pending: queueFilter === "pending" ? "bg-yellow-500 text-white" : "bg-yellow-50 text-yellow-700",
                  sent: queueFilter === "sent" ? "bg-green-600 text-white" : "bg-green-50 text-green-700",
                  error: queueFilter === "error" ? "bg-red-600 text-white" : "bg-red-50 text-red-700",
                }
                return (
                  <button
                    key={f}
                    onClick={() => setQueueFilter(f)}
                    className={cn("px-3 py-1 rounded-full text-xs font-medium transition-all", colors[f])}
                  >
                    {labels[f]}
                    {f !== "all" && (
                      <span className="ml-1 opacity-70">
                        ({queueMessages.filter(m => f === "error" ? (m.status === "error" || m.status === "blocked") : m.status === f).length})
                      </span>
                    )}
                  </button>
                )
              })}
              <button
                onClick={fetchQueueMessages}
                className="ml-auto px-2 py-1 rounded-full text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all flex items-center gap-1"
              >
                <RefreshCcw className="h-3 w-3" />
                Refresh
              </button>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto mt-3 space-y-2">
            {queueLoading && queueMessages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
              </div>
            ) : (() => {
              const filtered = queueMessages.filter((msg) => {
                const matchesSearch =
                  msg.customer.name.toLowerCase().includes(queueSearch.toLowerCase()) ||
                  msg.phoneNumber.includes(queueSearch) ||
                  msg.messageContent.toLowerCase().includes(queueSearch.toLowerCase())
                if (queueFilter === "all") return matchesSearch
                if (queueFilter === "error") return matchesSearch && (msg.status === "error" || msg.status === "blocked")
                return matchesSearch && msg.status === queueFilter
              })
              if (filtered.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
                    <CheckCircle className="h-8 w-8 text-gray-300" />
                    <span className="text-sm">No messages found</span>
                  </div>
                )
              }
              return filtered.map((msg) => (
                <div key={msg.id} className="rounded-lg border bg-white p-3 text-sm space-y-1.5 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800 truncate">{msg.customer.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {msg.messageType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">{msg.messageType}</span>
                      )}
                      {msg.status === "pending" && <Badge className="bg-yellow-50 text-yellow-700 border-yellow-300 text-[10px]">⏳ Pending</Badge>}
                      {msg.status === "sent" && <Badge className="bg-green-50 text-green-700 border-green-300 text-[10px]">✅ Sent</Badge>}
                      {msg.status === "error" && <Badge className="bg-red-50 text-red-700 border-red-300 text-[10px]">❌ Error</Badge>}
                      {msg.status === "blocked" && <Badge className="bg-red-100 text-red-800 border-red-400 text-[10px]">🚫 Blocked</Badge>}
                    </div>
                  </div>
                  <div className="text-gray-500 text-xs">{msg.phoneNumber}</div>
                  <div className="text-gray-700 text-xs line-clamp-2 bg-gray-50 rounded px-2 py-1">{msg.messageContent}</div>
                  {msg.errorMessage && (
                    <div className="text-red-600 text-xs bg-red-50 rounded px-2 py-1">⚠️ {msg.errorMessage}</div>
                  )}
                  <div className="text-gray-400 text-[10px]">
                    {new Date(msg.createdAt).toLocaleString()}
                    {msg.deliveredAt && ` · Delivered: ${new Date(msg.deliveredAt).toLocaleString()}`}
                  </div>
                </div>
              ))
            })()}
          </div>
        </SheetContent>
      </Sheet>

      {/* FlowConfigSheet for FLOW workspaces */}
      {isFlow && (
        <FlowConfigSheet
          open={flowSheetOpen}
          onOpenChange={setFlowSheetOpen}
          workspaceId={workspaceId}
          config={selectedFlowConfig}
          onSaved={handleFlowConfigSaved}
          enableWelcomeMessage={enableWelcomeMessage}
        />
      )}

      {/* CallingFunctionSheet for adding/editing calling functions from diagram */}
      {isFlow && (
        <CallingFunctionSheet
          open={callingFunctionSheetOpen}
          onOpenChange={(open) => {
            setCallingFunctionSheetOpen(open)
            if (!open) setEditingCallingFunction(null)
          }}
          workspaceId={workspaceId}
          onSaved={handleCallingFunctionSaved}
          callingFunction={editingCallingFunction}
        />
      )}

      {/* Edit Sheet */}
      <Sheet open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
        <SheetContent className="w-full sm:max-w-[1200px] overflow-y-auto">
          {selectedAgent && selectedMeta && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl bg-gradient-to-r", selectedMeta.gradientFrom, selectedMeta.gradientTo)}>
                    <selectedMeta.icon className="h-5 w-5 text-white" />
                  </div>
                  {getAgentDisplayName(selectedAgent.type.toUpperCase(), selectedMeta)}
                </SheetTitle>
                <SheetDescription>
                  {selectedMeta.description}
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Model Selection — Combobox with Cost & Performance Ratings */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">Model (OpenRouter)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        <div className="flex flex-col items-start text-left overflow-hidden">
                          <span className="font-medium text-sm">
                            {AVAILABLE_MODELS.find(m => m.id === editedModel)?.label ?? editedModel ?? "Select model…"}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[240px]">
                            {editedModel}
                          </span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0">
                      <Command>
                        <CommandInput placeholder="Search model…" />
                        <CommandList>
                          <CommandEmpty>No model found.</CommandEmpty>
                          <CommandGroup>
                            {AVAILABLE_MODELS.map((model) => (
                              <CommandItem
                                key={model.id}
                                value={`${model.label} ${model.id}`}
                                onSelect={() => setEditedModel(model.id)}
                                className="flex items-center justify-between py-3"
                              >
                                <div className="flex items-center gap-2">
                                  <Check className={cn("h-4 w-4 shrink-0", editedModel === model.id ? "opacity-100" : "opacity-0")} />
                                  <div>
                                    <div className="font-medium text-sm">{model.label}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{model.id}</div>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 ml-4 shrink-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-500 w-20">Cost:</span>
                                    <StarRating stars={model.costStars} />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-500 w-20">Performance:</span>
                                    <StarRating stars={model.performanceStars} />
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">Cost: ⭐ = cheaper · Performance: ⭐ = faster/smarter</p>
                </div>
                
                {/* Help Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">When is this agent used?</p>
                      <p className="text-sm text-blue-700 mt-1">{selectedMeta.whenUsed}</p>
                      <p className="text-xs text-blue-600 mt-2">
                        <strong>Example:</strong> {selectedMeta.example}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* System Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="prompt" className="flex items-center gap-2">
                    System Prompt
                    <span className="text-xs text-gray-400">
                      ({editedPrompt.length} characters)
                    </span>
                  </Label>
                  <div className="border rounded-md overflow-hidden">
                    <Editor
                      height="400px"
                      defaultLanguage="markdown"
                      theme="vs-light"
                      value={editedPrompt}
                      onChange={(value) => setEditedPrompt(value || "")}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        wordWrap: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        folding: true,
                        renderLineHighlight: "all",
                        tabSize: 2,
                        padding: { top: 8, bottom: 8 },
                      }}
                    />
                  </div>
                </div>
                
                {/* Temperature */}
                <div className="space-y-3">
                  <Label className="flex items-center justify-between">
                    <span>Temperature</span>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                      {editedTemperature.toFixed(1)}
                    </span>
                  </Label>
                  <Slider
                    value={[editedTemperature]}
                    onValueChange={(v) => setEditedTemperature(v[0])}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Precise (0.0)</span>
                    <span>Creative (1.0)</span>
                  </div>
                </div>
                
                {/* Max Tokens */}
                <div className="space-y-2">
                  <Label htmlFor="maxTokens">Max Tokens</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    value={editedMaxTokens}
                    onChange={(e) => setEditedMaxTokens(Number(e.target.value))}
                    min={100}
                    max={4000}
                  />
                </div>
                
                {/* Available Functions — editable checkboxes */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Available Functions
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      {editedFunctions.length}
                    </span>
                  </Label>
                  {allCallingFunctions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No calling functions found for this workspace.
                    </p>
                  ) : (
                    <div className="space-y-2 rounded-md border p-3 max-h-[280px] overflow-y-auto">
                      {allCallingFunctions.map((fn) => (
                        <div key={fn.functionName} className="flex items-start gap-3">
                          <Checkbox
                            id={`agent-fn-${fn.functionName}`}
                            checked={editedFunctions.includes(fn.functionName)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setEditedFunctions((prev) => [...prev, fn.functionName])
                              } else {
                                setEditedFunctions((prev) =>
                                  prev.filter((f) => f !== fn.functionName)
                                )
                              }
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <label
                              htmlFor={`agent-fn-${fn.functionName}`}
                              className="text-sm font-medium cursor-pointer font-mono"
                            >
                              {fn.functionName}
                              {fn.isSystemFunction && (
                                <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                  system
                                </span>
                              )}
                            </label>
                            {fn.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {fn.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Functions this agent can call during conversations. Add or remove as needed.
                  </p>
                </div>

                {/* Available Variables */}
                <HelpPanel
                  title="Available Variables"
                  description={`Template variables you can use in ${getAgentDisplayName(selectedAgent.type.toUpperCase(), selectedMeta)} system prompt`}
                  showVariables={true}
                  isEcommerce={isEcommerce}
                />
              </div>
              
              <SheetFooter className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => setSelectedAgent(null)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Help Dialog (for hardcoded agents) */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent>
          {helpMeta && helpAgent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl bg-gradient-to-r", helpMeta.gradientFrom, helpMeta.gradientTo)}>
                    <helpMeta.icon className="h-5 w-5 text-white" />
                  </div>
                  {getAgentDisplayName(helpAgent, helpMeta)}
                </DialogTitle>
                <DialogDescription>
                  {helpMeta.description}
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-4 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">{helpMeta.details}</p>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">This agent is hardcoded</p>
                      <p className="text-sm text-amber-700 mt-1">
                        For security and consistency, the prompt for this agent cannot be modified.
                        It uses a shared configuration across all workspaces.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-500">
                  <p><strong>When used:</strong> {helpMeta.whenUsed}</p>
                  <p className="mt-1"><strong>Example:</strong> {helpMeta.example}</p>
                </div>
              </div>
              
              <DialogFooter>
                <Button onClick={() => setIsHelpOpen(false)}>
                  Got it
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <RefreshCcw className="h-5 w-5" />
              Reset All Prompts to Defaults?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite all your custom prompts with the default values.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={isResetting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset to Defaults"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Calling Function Confirmation Dialog */}
      <AlertDialog open={!!deleteCallingFunctionName} onOpenChange={(open) => !open && setDeleteCallingFunctionName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Remove Calling Function?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will remove <strong>{deleteCallingFunctionName}</strong> from the Router&apos;s available functions.
              </p>
              <p className="text-red-600 font-medium">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCallingFunction}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCallingFunction}
              disabled={isDeletingCallingFunction}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingCallingFunction ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Sub-LLM Confirmation Dialog */}
      <AlertDialog open={!!deleteFlowConfig} onOpenChange={(open) => !open && setDeleteFlowConfig(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Sub-LLM?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently delete <strong>{deleteFlowConfig?.flowLabel}</strong> (key: <code className="bg-gray-100 px-1 rounded text-sm">{deleteFlowConfig?.flowKey}</code>).
              </p>
              <p>
                The associated calling function will also be removed from the Router.
              </p>
              <p className="text-red-600 font-medium">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFlowConfig}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
