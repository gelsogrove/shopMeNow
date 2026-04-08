import {
  ChevronRight,
  Copy,
  Calendar,
  Database,
  FileText,
  GitBranch,
  Globe,
  Headphones,
  MessageSquare,
  Package,
  Search,
  Send,
  Settings,
  Shield,
  ShoppingCart,
  User,
  X,
} from "lucide-react"

// WhatsApp icon SVG component
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from "react-vertical-timeline-component"
import "react-vertical-timeline-component/style.min.css"

interface DebugStep {
  type:
    | "router"
    | "function_call"
    | "function_result"
    | "safety"
    | "sub_agent"
    | "summary_agent"
    | "operator_message"
    | "user"
    | "token-replacement"
  agent?: string
  model?: string
  temperature?: number
  timestamp: string
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  input?: {
    userMessage?: string
    conversationHistory?: any[]
    functionResult?: any
  }
  output?: {
    decision?: string
    functionCall?: { name: string; arguments: any } | string
    textResponse?: string
    result?: any
    executionTimeMs?: number
  }
  duration?: number
  functionName?: string
  functionArguments?: any
}

interface MessageFlowDialogProps {
  isOpen: boolean
  onClose: () => void
  debugInfo: {
    steps: DebugStep[]
    totalTokens: number
    totalCost: number
    executionTimeMs: number
  }
}

export default function MessageFlowDialog({
  isOpen,
  onClose,
  debugInfo,
}: MessageFlowDialogProps) {
  if (!isOpen) return null

  const getAgentColor = (type: string, agent?: string): string => {
    if (type === "user" || agent === "Customer") return "#6B7280" // Gray
    if (type === "operator_message") return "#3B82F6" // Blue for operator
    if (type === "router") return "#9333EA" // Purple
    if (agent?.includes("Info Agent")) return "#9333EA" // Purple for Info Agent
    if (agent?.includes("Widget Security Layer")) return "#14B8A6" // Teal for widget security
    if (agent?.includes("Translation")) return "#14B8A6" // Teal for Translation
    if (type === "safety") return "#DC2626" // Red
    if (agent === "Security Check") return "#DC2626" // Red for security check
    if (agent === "Send to WhatsApp") return "#22C55E" // Green for successful send
    if (agent?.includes("Save to History")) return "#F59E0B" // Orange/Amber for database save
    if (agent?.includes("WhatsApp Queue")) return "#0EA5E9" // Sky blue for queue

    // 🆕 7 AGENTS ARCHITECTURE (Router + 5 specialists + Profile Management + Safety)
    if (agent?.includes("Product")) return "#3B82F6" // Blue (Product & Services Search)
    if (agent?.includes("Cart Management")) return "#10B981" // Green
    if (agent?.includes("Order Tracking")) return "#F97316" // Orange
    if (agent?.includes("Customer Support")) return "#EC4899" // Pink
    if (agent?.includes("Summary")) return "#F472B6" // Light Pink (sub-agent of Customer Support)
    if (agent?.includes("Profile Management")) return "#64748B" // Slate (includes notifications)
    if (agent?.includes("Calendar") || agent?.includes("Appointment")) return "#8B5CF6" // Violet (Calendar Booking)

    return "#3B82F6" // Blue for generic sub-agents
  }

  const getAgentIcon = (type: string, agent?: string): React.ReactNode => {
    // Customer
    if (type === "user") return <User className="w-5 h-5" />

    // 👨‍💼 Human Operator
    if (type === "operator_message") return <Headphones className="w-5 h-5" />

    // 🆕 System Notification (Admin Triggered) - NO robot icon, use Settings
    if (agent?.includes("System Notification"))
      return <Settings className="w-5 h-5" />

    // Router Agent
    if (type === "router" || agent?.includes("Router"))
      return <GitBranch className="w-5 h-5" />

    // Info Agent
    if (agent?.includes("Info Agent"))
      return <GitBranch className="w-5 h-5" />

    // Translation Agent - Globe icon
    if (agent?.includes("Widget Security Layer"))
      return <Shield className="w-5 h-5" />
    if (agent?.includes("Translation"))
      return <Globe className="w-5 h-5" />

    // Safety Agent - Shield icon
    if (type === "safety" || agent?.includes("Safety"))
      return <Shield className="w-5 h-5" />

    // 🆕 7 AGENTS ARCHITECTURE - Specialist agents
    if (agent?.includes("Product")) return <Search className="w-5 h-5" /> // Product & Services Search
    if (agent?.includes("Cart Management"))
      return <ShoppingCart className="w-5 h-5" />
    if (agent?.includes("Order Tracking"))
      return <Package className="w-5 h-5" />
    if (agent?.includes("Customer Support"))
      return <Headphones className="w-5 h-5" />
    if (agent?.includes("Summary")) return <FileText className="w-5 h-5" /> // ✅ Summary Agent
    if (agent?.includes("Profile Management"))
      return <User className="w-5 h-5" /> // Profile + Notifications
    if (agent?.includes("Calendar") || agent?.includes("Appointment"))
      return <Calendar className="w-5 h-5" /> // Calendar Booking

    // Infrastructure steps
    if (agent?.includes("Save to History"))
      return <Database className="w-5 h-5" />
    if (agent?.includes("WhatsApp Queue")) return <Send className="w-5 h-5" />

    // 🆕 Scheduler steps (Security Check + Send to WhatsApp)
    if (agent === "Security Check") return <Shield className="w-5 h-5" />
    if (agent === "Send to WhatsApp") return <WhatsAppIcon className="w-5 h-5" />

    // Default
    return <Settings className="w-5 h-5" />
  }

  const formatJSON = (obj: any): string => {
    if (obj === null || obj === undefined) return "N/A"
    return JSON.stringify(obj, null, 2)
  }

  /**
   * Format input/output as readable text (not JSON)
   */
  const formatReadable = (obj: any, type: 'input' | 'output', agentName?: string): string => {
    if (!obj || Object.keys(obj).length === 0) return ""

    const lines: string[] = []

    // INPUT formatting
    if (type === 'input') {
      // 🆕 Direct text content (no JSON parsing needed)
      if (obj.textContent) return obj.textContent
      if (obj.userMessage) lines.push(`User Message: ${obj.userMessage}`)
      if (obj.messageContent) lines.push(`Message: ${obj.messageContent}`)
      if (obj.previousResponse) lines.push(`Previous Response: ${obj.previousResponse}`)
      if (obj.targetLanguage) lines.push(`Target Language: ${obj.targetLanguage.toUpperCase()}`)
      if (obj.phoneNumber) lines.push(`Phone: ${obj.phoneNumber}`)
      if (obj.customerId) lines.push(`Customer ID: ${obj.customerId}`)
      if (obj.queueId) lines.push(`Queue ID: ${obj.queueId}`)
      if (obj.conversationHistory?.length) lines.push(`History: ${obj.conversationHistory.length} messages`)
      if (obj.systemPrompt) lines.push(`Prompt: ${obj.systemPrompt.substring(0, 300)}${obj.systemPrompt.length > 300 ? '...' : ''}`)
      if (obj.prompt && !obj.systemPrompt) lines.push(`Prompt: ${typeof obj.prompt === 'string' ? obj.prompt.substring(0, 300) + (obj.prompt.length > 300 ? '...' : '') : JSON.stringify(obj.prompt)}`)
      if (obj.textToSave) lines.push(`Text: ${obj.textToSave.substring(0, 200)}${obj.textToSave.length > 200 ? '...' : ''}`)
      if (obj.functionResult) lines.push(`Function Result: ${typeof obj.functionResult === 'string' ? obj.functionResult.substring(0, 200) : JSON.stringify(obj.functionResult).substring(0, 200)}...`)
    }

    // OUTPUT formatting
    if (type === 'output') {
      // 🆕 Direct text content (no JSON parsing needed)
      if (obj.textContent) return obj.textContent
      if (obj.textResponse) lines.push(`Response: ${obj.textResponse}`)
      if (obj.translatedText) lines.push(`Translated: ${obj.translatedText.substring(0, 300)}${obj.translatedText.length > 300 ? '...' : ''}`)
      if (obj.decision) lines.push(`Decision: ${obj.decision}`)
      if (obj.result) {
        if (typeof obj.result === 'object') {
          if (obj.result.safe !== undefined) lines.push(`Safe: ${obj.result.safe ? '✅ Yes' : '🚫 No'}`)
          if (obj.result.blockedReason) lines.push(`Blocked Reason: ${obj.result.blockedReason}`)
          if (obj.result.success !== undefined) lines.push(`Success: ${obj.result.success ? '✅ Yes' : '❌ No'}`)
          if (obj.result.phone) lines.push(`Sent to: ${obj.result.phone}`)
          if (obj.result.deliveredAt) lines.push(`Delivered: ${new Date(obj.result.deliveredAt).toLocaleTimeString()}`)
        } else {
          lines.push(`Result: ${obj.result}`)
        }
      }
      if (obj.responseText) lines.push(`Response: ${obj.responseText.substring(0, 300)}${obj.responseText.length > 300 ? '...' : ''}`)
      if (obj.executionTimeMs) lines.push(`Duration: ${obj.executionTimeMs}ms`)
      if (obj.message) lines.push(`Message: ${obj.message.substring(0, 200)}${obj.message.length > 200 ? '...' : ''}`)
    }

    return lines.length > 0 ? lines.join('\n') : ""
  }

  const formatFunctionCall = (step: DebugStep): string => {
    try {
      const functionName = step.functionName
      const functionArgs = step.functionArguments

      if (!functionName) return "N/A"

      if (!functionArgs || Object.keys(functionArgs).length === 0) {
        return `${functionName}()`
      }

      // Format arguments as a readable string
      const argsStr = Object.entries(functionArgs)
        .map(([key, value]) => {
          if (typeof value === "string") return `"${value}"`
          if (typeof value === "object") return JSON.stringify(value)
          return String(value)
        })
        .join(", ")

      return `${functionName}(${argsStr})`
    } catch (error) {
      console.error("Error formatting function call:", error)
      return "Error formatting function call"
    }
  }

  const shouldHideStep = (step: DebugStep): boolean => {
    const agentName = step.agent || ""
    if (agentName.includes("Conversation History")) return true
    if (agentName.includes("Skipped")) return true
    if ((step as any).skipped === true) return true
    if ((step as any).type === "humanization") return true
    return false
  }

  // 🆕 ORGANIZZA TUTTI GLI STEP IN ORDINE CRONOLOGICO
  const allSteps = (debugInfo?.steps || []).filter((step) => !shouldHideStep(step))

  // Router steps: TUTTE le iterazioni (iteration 1 delega, iteration 2 riceve risposta)
  const routerSteps = allSteps.filter(
    (s) => s.type === "router" && !(s as any).isSubAgent
  )

  // Sub-agent step (delegation execution) - check BOTH type and flag
  const subAgentSteps = allSteps.filter(
    (s) => s.type === "sub_agent" || (s as any).isSubAgent
  )

  // Summary Agent steps (internal service)
  const summaryAgentSteps = allSteps.filter((s) => s.type === "summary_agent")

  // Operator Message steps (human operator messages)
  const operatorMessageSteps = allSteps.filter((s) => s.type === "operator_message")

  // Link Replacement step
  const linkReplacementSteps = allSteps.filter(
    (s) => s.type === "token-replacement"
  )

  // 🔥 FIX: Check if this is a System Notification (Admin Triggered)
  const isSystemNotification = routerSteps[0]?.agent?.includes(
    "System Notification"
  )

  // 🆕 Check if this is an operator message flow
  const hasOperatorMessage = operatorMessageSteps.length > 0

  // Estrai messaggio utente dal primo step (ONLY if NOT system notification AND NOT operator message)
  const userMessage =
    routerSteps[0]?.input?.userMessage ||
    routerSteps[0]?.input?.conversationHistory?.[0]?.content ||
    "User message"

  // Step iniziale con domanda utente (SKIP if system notification OR operator message)
  const userStep: DebugStep | null = 
    isSystemNotification || hasOperatorMessage
      ? null
      : {
          type: "user",
          agent: "Customer",
          timestamp: routerSteps[0]?.timestamp || new Date().toISOString(),
          input: { userMessage },
        }

  // Estrai il messaggio finale dal Translation Layer (output.translatedText)
  // Fallback: Widget Security output, poi Translation output, poi Router output
  const translationStep = allSteps.find(
    (s) => s.agent?.includes("Translation") && !s.agent?.includes("Widget")
  )
  const widgetSecurityStep = allSteps.find((s) =>
    s.agent?.includes("Widget Security Layer")
  )
  const finalMessage =
    widgetSecurityStep?.output?.textResponse ||
    translationStep?.output?.translatedText ||
    routerSteps[routerSteps.length - 1]?.output?.textResponse ||
    "Message delivered"

  // 💾 Step: Save to History (BEFORE WhatsApp send)
  const saveToHistoryStep: any = {
    type: "function_call",
    agent: "💾 Save to History",
    timestamp: new Date(
      new Date(widgetSecurityStep?.timestamp || translationStep?.timestamp || new Date()).getTime() + 100
    ).toISOString(),
    input: {
      textContent: `Message from ${translationStep ? "Translation Layer" : "Router Agent"}:\n\n${finalMessage}`,
    },
    output: {
      textContent: "✅ Message saved to database (status: pending)",
    },
  }

  // 📤 Step: Add to WhatsApp Queue (BEFORE actual send)
  const queueStep: any = {
    type: "function_call",
    agent: "📤 Add to WhatsApp Queue",
    timestamp: new Date(
      new Date(widgetSecurityStep?.timestamp || translationStep?.timestamp || new Date()).getTime() + 150
    ).toISOString(),
    input: {
      textContent: `Message to send:\n\n${finalMessage}`,
    },
    output: {
      textContent: "✅ Message queued for WhatsApp delivery",
    },
  }

  // 🆕 TIMELINE COMPLETA: Ordina TUTTI gli step per timestamp
  // Include Security Check e Send to WhatsApp aggiunti dallo scheduler
  const securityCheckSteps = allSteps.filter(
    (s) => s.agent === "Security Check"
  )
  const sendToWhatsAppSteps = allSteps.filter(
    (s) => s.agent === "Send to WhatsApp"
  )

  // Filtra sub-agent steps ESCLUDENDO quelli speciali (Security Check, Send to WhatsApp)
  const regularSubAgentSteps = subAgentSteps.filter(
    (s) =>
      s.agent !== "Security Check" &&
      s.agent !== "Send to WhatsApp"
  )

  // Costruisci la sequenza base (SENZA userStep - mostrato come header separato)
  // ⚠️ ORDINE FISSO - NON usare sorting per timestamp perché i mock step
  // e gli step dello scheduler hanno timestamp che non riflettono l'ordine logico
  const timelineSequence = [
    // userStep RIMOSSO - ora mostrato come H1 centrato sopra la timeline
    ...operatorMessageSteps, // STEP 1 (alternative): Operator message input
    routerSteps[0], // STEP 2: Router iteration 1 (delega a sub-agent)
    ...regularSubAgentSteps, // STEP 3: Sub-agent execution (regular ones)
    ...summaryAgentSteps, // STEP 3.5: Summary Agent execution (if present)
    routerSteps[1], // STEP 4: Router iteration 2 (riceve risposta)
    linkReplacementSteps[0], // STEP 5: Link Replacement (BEFORE Translation) ✅
    translationStep, // STEP 6: Translation Layer ✅
    widgetSecurityStep, // STEP 7: Widget Security Layer ✅
    saveToHistoryStep, // STEP 7: Save to history
    queueStep, // STEP 8: Add to WhatsApp Queue
    ...securityCheckSteps, // STEP 9: Security Check (from scheduler) ✅
    ...sendToWhatsAppSteps, // STEP 10: Send to WhatsApp (from scheduler) ✅
  ].filter(Boolean) // Rimuovi undefined

  // 📋 Copy all timeline content to clipboard
  const copyAllToClipboard = () => {
    const lines: string[] = []
    
    // Header
    lines.push('='.repeat(60))
    lines.push('MESSAGE FLOW TIMELINE')
    lines.push('='.repeat(60))
    lines.push('')
    
    // User message
    if (userMessage && userMessage !== 'User message') {
      lines.push(`👤 CUSTOMER MESSAGE: "${userMessage}"`)
      lines.push('')
    }
    
    // Summary
    lines.push(`📊 Summary: ${timelineSequence.length} steps | ${debugInfo.totalTokens?.toLocaleString() || 0} tokens | $${debugInfo.totalCost?.toFixed(4) || '0.0000'} | ${(debugInfo.executionTimeMs / 1000).toFixed(2)}s`)
    lines.push('')
    lines.push('-'.repeat(60))
    
    // Each step
    timelineSequence.forEach((step, index) => {
      lines.push('')
      lines.push(`[STEP ${index + 1}] ${step.agent || step.type}`)
      if (step.model) lines.push(`Model: ${step.model}`)
      if (step.timestamp) {
        const date = new Date(step.timestamp)
        lines.push(`Time: ${date.toLocaleTimeString()}`)
      }
      
      // Prompt
      if ((step as any).systemPrompt) {
        lines.push('')
        lines.push('📋 PROMPT:')
        lines.push((step as any).systemPrompt)
      }
      
      // Input
      if (step.input && Object.keys(step.input).length > 0) {
        lines.push('')
        lines.push('📥 INPUT:')
        if ((step.input as any).textContent) {
          lines.push((step.input as any).textContent)
        } else {
          lines.push(JSON.stringify(step.input, null, 2))
        }
      }
      
      // Output
      if (step.output && Object.keys(step.output).length > 0) {
        lines.push('')
        lines.push('📤 OUTPUT:')
        if ((step.output as any).textContent) {
          lines.push((step.output as any).textContent)
        } else if ((step.output as any).textResponse) {
          lines.push((step.output as any).textResponse)
        } else if ((step.output as any).translatedText) {
          lines.push((step.output as any).translatedText)
        } else {
          lines.push(JSON.stringify(step.output, null, 2))
        }
      }
      
      // Tokens
      if (step.tokenUsage?.totalTokens) {
        lines.push('')
        lines.push(`Tokens: ${step.tokenUsage.totalTokens.toLocaleString()}`)
      }
      
      lines.push('')
      lines.push('-'.repeat(60))
    })
    
    const textContent = lines.join('\n')
    navigator.clipboard.writeText(textContent).then(() => {
      // Show brief feedback (could add toast here)
      alert('✅ Timeline copied to clipboard!')
    }).catch(err => {
      console.error('Failed to copy:', err)
      alert('❌ Failed to copy to clipboard')
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between border-b border-gray-700">
          <h2 className="text-xl font-bold">Message Flow Timeline</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAllToClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              title="Copy all logs to clipboard"
            >
              <Copy className="w-4 h-4" />
              Copy All
            </button>
            <button
              onClick={onClose}
              className="hover:bg-gray-700 rounded-full p-1 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex gap-6 text-sm">
          <div>
            <span className="text-gray-500">Steps:</span>{" "}
            <span className="font-semibold">{timelineSequence.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Tokens:</span>{" "}
            <span className="font-semibold">
              {debugInfo.totalTokens?.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Cost:</span>{" "}
            <span className="font-semibold">
              ${debugInfo.totalCost?.toFixed(4)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Time:</span>{" "}
            <span className="font-semibold">
              {(debugInfo.executionTimeMs / 1000).toFixed(2)}s
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto">
          {/* 🆕 User Message Header - Centrato sopra la timeline */}
          {userMessage && !isSystemNotification && !hasOperatorMessage && (
            <div className="text-center py-8 px-6 bg-gradient-to-b from-gray-100 to-white">
              <div className="inline-flex items-center gap-2 text-sm text-gray-500 mb-3">
                <User className="w-4 h-4" />
                <span>Customer Message</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 max-w-3xl mx-auto">
                "{userMessage}"
              </h1>
            </div>
          )}

          <VerticalTimeline lineColor="#E5E7EB">
            {timelineSequence.map((step, index) => {
              const color = getAgentColor(step.type, step.agent)
              const icon = getAgentIcon(step.type, step.agent)

              return (
                <VerticalTimelineElement
                  key={index}
                  className={`vertical-timeline-element ${
                    (step as any).isNested ? "nested-step" : ""
                  }`}
                  contentStyle={{
                    background: "#fff",
                    boxShadow: (step as any).isNested
                      ? "0 2px 6px rgba(0,0,0,0.08)"
                      : "0 3px 10px rgba(0,0,0,0.1)",
                    border: (step as any).isNested
                      ? "1px solid #f3e8ff"
                      : "1px solid #e5e7eb",
                    marginLeft: (step as any).isNested ? "40px" : "0", // 🆕 Indentation for nested
                    backgroundColor: (step as any).isNested
                      ? "#faf5ff"
                      : "#fff", // 🆕 Light purple bg for nested
                  }}
                  contentArrowStyle={{ borderRight: `7px solid ${color}` }}
                  date={(() => {
                    const d = new Date(step.timestamp)
                    const hh = d.getHours().toString().padStart(2, '0')
                    const mm = d.getMinutes().toString().padStart(2, '0')
                    const ss = d.getSeconds().toString().padStart(2, '0')
                    const ms = d.getMilliseconds().toString().padStart(3, '0')
                    return `${hh}:${mm}:${ss}:${ms}`
                  })()}
                  iconStyle={{
                    background: color,
                    color: "#fff",
                    transform: (step as any).isNested
                      ? "scale(0.8)"
                      : "scale(1)", // 🆕 Smaller icon for nested
                  }}
                  icon={icon}
                >
                  {/* Card Header */}
                  <div className="mb-3">
                    <h3
                      className={`text-lg font-bold ${
                        (step as any).isNested ? "text-sm" : ""
                      }`}
                      style={{ color }}
                    >
                      {(step as any).isNested && "↳ "}
                      {step.agent || step.type.replace("_", " ").toUpperCase()}
                    </h3>
                    {/* 🆕 NESTED BADGE (for Query Analyzer under Product Search) */}
                    {(step as any).isNested && (
                      <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 bg-purple-100 border border-purple-300 rounded text-xs font-medium text-purple-800">
                        <span>
                          🔬 Internal: Called by {(step as any).parentAgent}
                        </span>
                      </div>
                    )}
                    {step.model && (
                      <p className="text-sm text-gray-500">
                        {step.model}{step.temperature !== undefined && step.temperature > 0.2 && ` • T: ${step.temperature}`}
                      </p>
                    )}
                    {step.output?.executionTimeMs !== undefined && step.output.executionTimeMs > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Duration:{" "}
                        {(() => {
                          const ms = step.output.executionTimeMs
                          const sec = Math.floor(ms / 1000)
                          const remainMs = ms % 1000
                          if (sec > 0) {
                            return `${sec}s ${remainMs}ms`
                          }
                          return `${ms}ms`
                        })()}
                      </p>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="space-y-3">
                    {/* 🆕 PROMPT - System Prompt with all variables replaced */}
                    {/* ⬆️ MOVED UP: PROMPT defines behavior BEFORE processing input */}
                    {(step as any).systemPrompt && (
                      <details className="group">
                        <summary className="cursor-pointer text-sm font-semibold text-purple-600 hover:text-purple-700">
                          📋 PROMPT (System)
                        </summary>
                        <pre className="mt-2 text-xs bg-purple-50 p-3 rounded overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-mono">
                          {(step as any).systemPrompt}
                        </pre>
                      </details>
                    )}

                    {/* Input - show readable format, fallback to JSON */}
                    {step.input && Object.keys(step.input).length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer text-sm font-semibold text-blue-600 hover:text-blue-700">
                          📥 INPUT
                        </summary>
                        <div className="mt-2 text-xs bg-blue-50 p-3 rounded overflow-x-auto max-h-60 overflow-y-auto">
                          {formatReadable(step.input, 'input', step.agent) ? (
                            <pre className="whitespace-pre-wrap break-words text-blue-900">
                              {formatReadable(step.input, 'input', step.agent)}
                            </pre>
                          ) : (
                            <pre className="whitespace-pre-wrap break-words">
                              {formatJSON(step.input)}
                            </pre>
                          )}
                        </div>
                      </details>
                    )}

                    {/* Output - show readable format, fallback to JSON */}
                    {step.output && Object.keys(step.output).length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer text-sm font-semibold text-green-600 hover:text-green-700">
                          📤 OUTPUT
                        </summary>
                        <div className="mt-2 text-xs bg-green-50 p-3 rounded overflow-x-auto max-h-60 overflow-y-auto">
                          {step.functionName && (
                            <div className="mb-3 pb-3 border-b border-green-200">
                              <div className="font-semibold text-green-700 mb-1">
                                Function Call:
                              </div>
                              <code className="text-green-900 font-mono text-sm">
                                {formatFunctionCall(step)}
                              </code>
                            </div>
                          )}
                          {formatReadable(step.output, 'output', step.agent) ? (
                            <pre className="whitespace-pre-wrap break-words text-green-900">
                              {formatReadable(step.output, 'output', step.agent)}
                            </pre>
                          ) : (
                            <pre className="whitespace-pre-wrap break-words">
                              {formatJSON(step.output)}
                            </pre>
                          )}
                        </div>
                      </details>
                    )}

                    {/* Token Usage */}
                    {step.tokenUsage && (
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                        <span className="font-semibold">Tokens:</span>{" "}
                        {step.tokenUsage.totalTokens.toLocaleString()}
                      </div>
                    )}
                  </div>
                </VerticalTimelineElement>
              )
            })}
          </VerticalTimeline>
        </div>
      </div>
    </div>
  )
}
