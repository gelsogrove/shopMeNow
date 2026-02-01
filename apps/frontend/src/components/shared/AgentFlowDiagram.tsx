/**
 * AgentFlowDiagram - Full-screen visual representation of multi-agent architecture
 * 
 * Features:
 * - Beautiful visual flow diagram showing agent hierarchy
 * - Click on agent to edit prompt (slide panel)
 * - Help icon for each agent with explanation
 * - Hardcoded agents shown but not editable (Safety+Translation)
 * - Reset to defaults button
 * - E-commerce agents filtered based on workspace type
 * 
 * @architecture Visual component for Agent Configuration page
 * @security All operations validated by workspaceId + agentId + token
 */
import { useState, useEffect } from "react"
import Editor from "@monaco-editor/react"
import {
  GitBranch,
  Search,
  ShoppingCart,
  Package,
  Headphones,
  FileText,
  User,
  Globe,
  MessageSquare,
  HelpCircle,
  Edit3,
  Lock,
  ChevronDown,
  Save,
  X,
  RefreshCcw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
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
import { HelpPanel } from "@/components/settings/HelpPanel"
import { toast } from "@/lib/toast"
import { logger } from "@/lib/logger"

// Types
interface AgentConfig {
  id: string
  name: string
  type: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  model: string
  isActive: boolean
  order: number
  availableFunctions?: string[]
}

interface AgentFlowDiagramProps {
  sellsProductsAndServices: boolean
  agents: AgentConfig[]
  workspaceId: string
  onSaveAgent: (agentId: string, data: Partial<AgentConfig>) => Promise<void>
  onResetToDefaults: () => Promise<void>
  isLoading?: boolean
  className?: string
}

// Agent metadata with descriptions
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
    icon: GitBranch,
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
    icon: Search,
    color: "blue",
    gradientFrom: "from-blue-500",
    gradientTo: "to-blue-600",
    borderColor: "border-blue-400",
    description: "Searches products and catalog",
    details: "Handles product queries, searches the catalog, filters by certifications (Bio, DOP, IGP), shows categories and availability.",
    whenUsed: "Customer asks about products, prices, or availability",
    example: '"Do you have parmesan?" → Shows product list with details',
    ecommerceOnly: true,
    availableFunctions: ["getProductDetails", "getServiceDetails", "searchProductByCertifications"],
  },
  CART_MANAGEMENT: {
    name: "Cart Management",
    icon: ShoppingCart,
    color: "green",
    gradientFrom: "from-green-500",
    gradientTo: "to-green-600",
    borderColor: "border-green-400",
    description: "Manages shopping cart",
    details: "Adds/removes items from cart, applies discounts, calculates totals, guides through checkout process.",
    whenUsed: "Customer wants to add to cart, view cart, or checkout",
    example: '"Add 2 units" → Updates cart and shows summary',
    ecommerceOnly: true,
    availableFunctions: ["addToCart", "viewCart", "removeFromCart", "updateCartQuantity", "clearCart", "checkout"],
  },
  ORDER_TRACKING: {
    name: "Order Tracking",
    icon: Package,
    color: "orange",
    gradientFrom: "from-orange-500",
    gradientTo: "to-orange-600",
    borderColor: "border-orange-400",
    description: "Tracks orders and shipments",
    details: "Shows order history, tracks shipments, provides delivery updates and estimated arrival times.",
    whenUsed: "Customer asks about their orders or delivery status",
    example: '"Where is my order?" → Shows order status with tracking',
    ecommerceOnly: true,
    availableFunctions: ["getOrderHistory", "getLastOrders", "getOrderDetails", "trackOrderStatus", "sendInvoice", "repeatLastOrder"],
  },
  CUSTOMER_SUPPORT: {
    name: "Customer Support",
    icon: Headphones,
    color: "pink",
    gradientFrom: "from-pink-500",
    gradientTo: "to-pink-600",
    borderColor: "border-pink-400",
    description: "Handles support requests",
    details: "Answers FAQs, handles complaints, and escalates to human operators when the customer is frustrated or needs human help.",
    whenUsed: "Customer needs help, has questions, or wants to speak with a human",
    example: '"I have a problem with my order" → Provides support or escalates',
    availableFunctions: ["contactSupport"],
  },
  SUMMARY_AGENT: {
    name: "Summary Agent",
    icon: FileText,
    color: "pink",
    gradientFrom: "from-pink-400",
    gradientTo: "to-pink-500",
    borderColor: "border-pink-300",
    description: "Creates conversation summaries",
    details: "When a customer is transferred to a human operator, this agent creates a concise summary of the conversation to help the operator understand the situation quickly.",
    whenUsed: "When customer is transferred to a human operator",
    example: "Customer frustrated about delayed order → Summary for operator",
    isSubAgent: true,
    availableFunctions: [],
  },
  PROFILE_MANAGEMENT: {
    name: "Profile Management",
    icon: User,
    color: "slate",
    gradientFrom: "from-slate-500",
    gradientTo: "to-slate-600",
    borderColor: "border-slate-400",
    description: "Manages customer profiles",
    details: "Updates customer information: delivery address, email, phone, preferences, and notification settings.",
    whenUsed: "Customer wants to update their information",
    example: '"Change my delivery address" → Updates profile',
    availableFunctions: [],
  },
  CONVERSATION_HISTORY: {
    name: "Conversation History",
    icon: MessageSquare,
    color: "amber",
    gradientFrom: "from-amber-500",
    gradientTo: "to-amber-600",
    borderColor: "border-amber-400",
    description: "Humanizes responses",
    details: "Adds personality and context-awareness to responses. Remembers previous interactions and maintains conversation tone for a more human feel.",
    whenUsed: "Applied to every response before sending",
    example: "Adds appropriate greetings and context-aware touches",
    availableFunctions: [],
  },
  TRANSLATION: {
    name: "Safety + Translation",
    icon: Globe,
    color: "teal",
    gradientFrom: "from-teal-500",
    gradientTo: "to-teal-600",
    borderColor: "border-teal-400",
    description: "Translates and validates safety",
    details: "Translates responses to customer's language (IT/EN/ES/PT), blocks profanity and spam, validates external links. This is the final layer before sending.",
    whenUsed: "Final step - translates response and validates safety",
    example: "Italian response → Translated to Spanish for customer",
    widgetOnly: true,
    isHardcoded: true,
    availableFunctions: [],
  },
  SECURITY: {
    name: "Security Agent",
    icon: Lock,
    color: "red",
    gradientFrom: "from-red-500",
    gradientTo: "to-red-600",
    borderColor: "border-red-400",
    description: "Security validation (hidden)",
    details: "Validates all messages for security threats. This agent is hardcoded and not visible to users for security reasons.",
    whenUsed: "Always active in background",
    example: "Blocks malicious content before processing",
    isHardcoded: true,
    availableFunctions: ["sendAlertEmail"],
  },
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
}: {
  agent?: AgentConfig
  metadata: typeof AGENT_METADATA.ROUTER
  displayName?: string
  isEditable: boolean
  isActive: boolean
  onClick?: () => void
  size?: "small" | "normal" | "large"
}) {
  const Icon = metadata.icon
  const name = displayName || metadata.name
  
  const sizeClasses = {
    small: { box: "px-3 py-2", icon: "h-4 w-4", text: "text-xs" },
    normal: { box: "px-4 py-3", icon: "h-5 w-5", text: "text-sm" },
    large: { box: "px-6 py-4", icon: "h-6 w-6", text: "text-base" },
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
  sellsProductsAndServices,
  agents,
  workspaceId,
  onSaveAgent,
  onResetToDefaults,
  isLoading = false,
  className,
}: AgentFlowDiagramProps) {
  // State
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null)
  const [editedPrompt, setEditedPrompt] = useState("")
  const [editedTemperature, setEditedTemperature] = useState(0.7)
  const [editedMaxTokens, setEditedMaxTokens] = useState(1000)
  const [isSaving, setIsSaving] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [helpAgent, setHelpAgent] = useState<string | null>(null)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Get display name for agent - "Info Agent" for ROUTER in informational mode
  const getAgentDisplayName = (type: string, meta: typeof AGENT_METADATA[keyof typeof AGENT_METADATA]): string => {
    if (type === "ROUTER" && !sellsProductsAndServices) {
      return "Info Agent"
    }
    return meta.name
  }

  // Get agent by type
  const getAgent = (type: string): AgentConfig | undefined => {
    return agents.find(a => a.type.toUpperCase() === type.toUpperCase())
  }

  // Check if agent exists in database
  const agentExists = (type: string): boolean => {
    return !!getAgent(type)
  }

  // Check if agent should be shown (exists in DB and passes filters)
  const shouldShowAgent = (type: string): boolean => {
    // Must exist in database
    if (!agentExists(type)) return false
    
    const meta = AGENT_METADATA[type]
    if (!meta) return false
    if (meta.ecommerceOnly && !sellsProductsAndServices) return false
    if (type === "SECURITY") return false // Always hidden
    return true
  }

  // Handle agent click - only if agent exists in database
  const handleAgentClick = (type: string) => {
    const meta = AGENT_METADATA[type]
    if (!meta) return
    
    // If hardcoded, show help instead of edit
    if (meta.isHardcoded) {
      setHelpAgent(type)
      setIsHelpOpen(true)
      return
    }
    
    const agent = getAgent(type)
    if (!agent) {
      // Agent doesn't exist in database - show message
      toast.error(`${getAgentDisplayName(type, meta)} is not configured for this workspace`)
      return
    }
    
    setSelectedAgent(agent)
    setEditedPrompt(agent.systemPrompt || "")
    setEditedTemperature(agent.temperature || 0.7)
    setEditedMaxTokens(agent.maxTokens || 1000)
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
      })
      toast.success(`${selectedAgent.name} saved successfully!`)
      setSelectedAgent(null)
    } catch (error) {
      logger.error("Failed to save agent:", error)
      toast.error("Failed to save agent")
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
        workspaceType: sellsProductsAndServices ? "ecommerce" : "informational",
        agents: agents.map(agent => ({
          type: agent.type,
          name: agent.name,
          systemPrompt: agent.systemPrompt,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
        }))
      }
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `agent-prompts-${sellsProductsAndServices ? "ecommerce" : "info"}-${new Date().toISOString().split("T")[0]}.json`
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

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-96", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const selectedMeta = selectedAgent ? AGENT_METADATA[selectedAgent.type.toUpperCase()] : null
  const helpMeta = helpAgent ? AGENT_METADATA[helpAgent] : null
  
  // Filter available functions based on workspace type (ecommerce vs informational)
  const ecommerceFunctions = ["productSearchAgent", "cartManagementAgent", "orderTrackingAgent"]
  const getFilteredFunctions = (meta: typeof selectedMeta) => {
    if (!meta?.availableFunctions) return []
    if (sellsProductsAndServices) return meta.availableFunctions
    // Informational mode: filter out e-commerce specific functions
    return meta.availableFunctions.filter(fn => !ecommerceFunctions.includes(fn))
  }
  const filteredFunctions = selectedMeta ? getFilteredFunctions(selectedMeta) : []

  return (
    <div className={cn("bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 rounded-2xl p-8 border border-slate-200 shadow-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl">
              <GitBranch className="h-6 w-6 text-white" />
            </div>
            {sellsProductsAndServices ? "E-commerce Agent Flow" : "Informational Agent Flow"}
          </h2>
          <p className="text-gray-500 mt-1">
            {sellsProductsAndServices 
              ? "Full e-commerce flow with product search, cart, and order management"
              : "Streamlined flow for FAQ and customer support"
            }
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-sm px-3 py-1.5 rounded-full flex items-center gap-2 font-medium",
            sellsProductsAndServices 
              ? "bg-green-100 text-green-700"
              : "bg-blue-100 text-blue-700"
          )}>
            {sellsProductsAndServices ? "🛒 E-commerce Mode" : "ℹ️ Informational Mode"}
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
        
        {/* ROUTER - Shows as "Info Agent" in informational mode */}
        <AgentNode
          agent={getAgent("ROUTER")}
          metadata={AGENT_METADATA.ROUTER}
          displayName={sellsProductsAndServices ? "Router Agent" : "Info Agent"}
          isEditable={true}
          isActive={true}
          onClick={() => handleAgentClick("ROUTER")}
          size="large"
        />
        
        <ConnectorArrow />
        
        {/* Specialists Branch */}
        <div className="relative w-full max-w-5xl">
          {/* Horizontal line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] h-0.5 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
          
          {/* Agent boxes - ALL ON SAME ROW - Only show agents that exist in database */}
          <div className="flex items-start justify-center gap-2 pt-6">
            {/* E-commerce Agents - only if they exist */}
            {sellsProductsAndServices && agentExists("PRODUCT_SEARCH") && (
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-4 bg-gray-300 -mt-4" />
                <AgentNode
                  agent={getAgent("PRODUCT_SEARCH")}
                  metadata={AGENT_METADATA.PRODUCT_SEARCH}
                  isEditable={true}
                  isActive={shouldShowAgent("PRODUCT_SEARCH")}
                  onClick={() => handleAgentClick("PRODUCT_SEARCH")}
                  size="small"
                />
              </div>
            )}
            
            {sellsProductsAndServices && agentExists("CART_MANAGEMENT") && (
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-4 bg-gray-300 -mt-4" />
                <AgentNode
                  agent={getAgent("CART_MANAGEMENT")}
                  metadata={AGENT_METADATA.CART_MANAGEMENT}
                  isEditable={true}
                  isActive={shouldShowAgent("CART_MANAGEMENT")}
                  onClick={() => handleAgentClick("CART_MANAGEMENT")}
                  size="small"
                />
              </div>
            )}
            
            {sellsProductsAndServices && agentExists("ORDER_TRACKING") && (
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-4 bg-gray-300 -mt-4" />
                <AgentNode
                  agent={getAgent("ORDER_TRACKING")}
                  metadata={AGENT_METADATA.ORDER_TRACKING}
                  isEditable={true}
                  isActive={shouldShowAgent("ORDER_TRACKING")}
                  onClick={() => handleAgentClick("ORDER_TRACKING")}
                  size="small"
                />
              </div>
            )}
            
            {/* Customer Support */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-4 bg-gray-300 -mt-4" />
              <AgentNode
                agent={getAgent("CUSTOMER_SUPPORT")}
                metadata={AGENT_METADATA.CUSTOMER_SUPPORT}
                isEditable={true}
                isActive={true}
                onClick={() => handleAgentClick("CUSTOMER_SUPPORT")}
                size="small"
              />
            </div>
            
            {/* Profile Management */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-4 bg-gray-300 -mt-4" />
              <AgentNode
                agent={getAgent("PROFILE_MANAGEMENT")}
                metadata={AGENT_METADATA.PROFILE_MANAGEMENT}
                isEditable={true}
                isActive={true}
                onClick={() => handleAgentClick("PROFILE_MANAGEMENT")}
                size="small"
              />
            </div>
          </div>
        </div>
        
        {/* Merge line */}
        <div className="w-[60%] max-w-md h-0.5 bg-gradient-to-r from-transparent via-gray-300 to-transparent mt-6" />
        
        <ConnectorArrow />
        
        {/* Conversation History */}
        <AgentNode
          agent={getAgent("CONVERSATION_HISTORY")}
          metadata={AGENT_METADATA.CONVERSATION_HISTORY}
          isEditable={true}
          isActive={true}
          onClick={() => handleAgentClick("CONVERSATION_HISTORY")}
          size="normal"
        />
        
        <ConnectorArrow />
        
        {/* Safety + Translation (HARDCODED) */}
        <AgentNode
          metadata={AGENT_METADATA.TRANSLATION}
          isEditable={false}
          isActive={true}
          onClick={() => handleAgentClick("TRANSLATION")}
          size="normal"
        />
        
        <ConnectorArrow />
        
        {/* Final Response */}
        <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span className="font-medium">Response to Customer</span>
        </div>
        
      </div>

      {/* Enterprise Message */}
      <div className="flex items-center justify-center mt-8">
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg px-4 py-2 text-sm text-purple-700">
          <Sparkles className="h-4 w-4 inline mr-2" />
          Want custom agent flows? <span className="font-semibold">Upgrade to Enterprise</span> for advanced customization.
        </div>
      </div>

      {/* Edit Sheet */}
      <Sheet open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
        <SheetContent className="w-[1200px] sm:max-w-[1200px] overflow-y-auto">
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
                {/* Model (read-only) - FIRST */}
                <div className="space-y-2">
                  <Label htmlFor="model" className="flex items-center gap-2">
                    Model
                    <Lock className="h-3 w-3 text-gray-400" />
                  </Label>
                  <Input
                    id="model"
                    value={selectedAgent.model || "openai/gpt-4o-mini"}
                    disabled
                    className="bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    To change model, upgrade to Enterprise plan
                  </p>
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
                
                {/* Available Functions (read-only) - filtered by workspace type */}
                {filteredFunctions.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Available Functions
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        {filteredFunctions.length}
                      </span>
                      <Lock className="h-3 w-3 text-gray-400" />
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {filteredFunctions.map((fn, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 border border-gray-200 rounded-md text-xs font-mono text-gray-700"
                        >
                          ⚡ {fn}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Functions this agent can call during conversations (read-only)
                    </p>
                  </div>
                )}
                {filteredFunctions.length === 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Available Functions
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        0
                      </span>
                    </Label>
                    <p className="text-xs text-gray-500">
                      This agent doesn't call external functions - it processes context and generates responses directly.
                    </p>
                  </div>
                )}

                {/* Available Variables */}
                <HelpPanel
                  title="Available Variables"
                  description={`Template variables you can use in ${getAgentDisplayName(selectedAgent.type.toUpperCase(), selectedMeta)} system prompt`}
                  showVariables={true}
                  sellsProductsAndServices={sellsProductsAndServices}
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
    </div>
  )
}
