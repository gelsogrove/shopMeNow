import {
  ChevronRight,
  Database,
  GitBranch,
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
    | "whatsapp_delivery"
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
    if (type === "router") return "#9333EA" // Purple
    if (type === "safety") return "#DC2626" // Red
    if (type === "whatsapp_delivery") return "#16A34A" // Green
    if (agent?.includes("Save to History")) return "#F59E0B" // Orange/Amber for database save
    if (agent?.includes("WhatsApp Queue")) return "#0EA5E9" // Sky blue for queue

    // 🆕 6 AGENTS ARCHITECTURE (no QueryAnalyzer, no Translation)
    if (agent?.includes("Product Search")) return "#3B82F6" // Blue
    if (agent?.includes("Cart Management")) return "#10B981" // Green
    if (agent?.includes("Order Tracking")) return "#F97316" // Orange
    if (agent?.includes("Customer Support")) return "#EC4899" // Pink

    return "#3B82F6" // Blue for generic sub-agents
  }

  const getAgentIcon = (type: string, agent?: string): React.ReactNode => {
    // Customer
    if (type === "user") return <User className="w-5 h-5" />

    // Router Agent
    if (type === "router" || agent?.includes("Router"))
      return <GitBranch className="w-5 h-5" />

    // Safety & Translation Agent (order: 99)
    if (
      type === "safety" ||
      agent?.includes("Safety") ||
      agent?.includes("Translation")
    )
      return <Shield className="w-5 h-5" />

    // 🆕 6 AGENTS ARCHITECTURE - Specialist agents
    if (agent?.includes("Product Search")) return <Search className="w-5 h-5" />
    if (agent?.includes("Cart Management"))
      return <ShoppingCart className="w-5 h-5" />
    if (agent?.includes("Order Tracking"))
      return <Package className="w-5 h-5" />
    if (agent?.includes("Customer Support"))
      return <Headphones className="w-5 h-5" />

    // Infrastructure steps
    if (agent?.includes("Save to History"))
      return <Database className="w-5 h-5" />
    if (agent?.includes("WhatsApp Queue")) return <Send className="w-5 h-5" />
    if (type === "whatsapp_delivery")
      return <MessageSquare className="w-5 h-5" />

    // Default
    return <Settings className="w-5 h-5" />
  }

  const formatJSON = (obj: any): string => {
    if (obj === null || obj === undefined) return "N/A"
    return JSON.stringify(obj, null, 2)
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

  // 🆕 ORGANIZZA TUTTI GLI STEP IN ORDINE CRONOLOGICO
  const allSteps = debugInfo?.steps || []

  // Router steps: TUTTE le iterazioni (iteration 1 delega, iteration 2 riceve risposta)
  const routerSteps = allSteps.filter(
    (s) => s.type === "router" && !(s as any).isSubAgent
  )

  // Sub-agent step (delegation execution) - check BOTH type and flag
  const subAgentSteps = allSteps.filter(
    (s) => s.type === "sub_agent" || (s as any).isSubAgent
  )

  // Safety & Translation step
  const safetySteps = allSteps.filter((s) => s.type === "safety")

  // Link Replacement step
  const linkReplacementSteps = allSteps.filter(
    (s) => s.type === "token-replacement"
  )

  // Estrai messaggio utente dal primo step
  const userMessage =
    routerSteps[0]?.input?.userMessage ||
    routerSteps[0]?.input?.conversationHistory?.[0]?.content ||
    "User message"

  // Step iniziale con domanda utente
  const userStep: DebugStep = {
    type: "user",
    agent: "Customer",
    timestamp: routerSteps[0]?.timestamp || new Date().toISOString(),
    input: { userMessage },
  }

  // Estrai il messaggio finale dal Safety Agent o dall'ultimo Router
  const finalMessage =
    safetySteps[0]?.output?.textResponse ||
    safetySteps[0]?.output?.result?.translatedResponse ||
    routerSteps[routerSteps.length - 1]?.output?.textResponse ||
    "Message delivered"

  // 💾 Step: Save to History (BEFORE WhatsApp send)
  const saveToHistoryStep: any = {
    type: "function_call",
    agent: "💾 Save to History",
    timestamp: new Date(
      new Date(safetySteps[0]?.timestamp || new Date()).getTime() + 100
    ).toISOString(),
    input: {
      textToSave: finalMessage,
      customerId: "customer-id",
      conversationId: "conversation-id",
      status: "pending",
    },
    output: {
      result: "Message saved to database with status: pending",
      messageId: "msg-" + Date.now(),
      executionTimeMs: 50,
    },
  }

  // 📤 Step: Add to WhatsApp Queue (BEFORE actual send)
  const queueStep: any = {
    type: "function_call",
    agent: "📤 Add to WhatsApp Queue",
    timestamp: new Date(
      new Date(safetySteps[0]?.timestamp || new Date()).getTime() + 150
    ).toISOString(),
    input: {
      messageId: saveToHistoryStep.output?.messageId,
      phoneNumber: "+39XXXXXXXXXX",
      message: finalMessage,
      priority: "normal",
    },
    output: {
      result: "Message queued for WhatsApp delivery",
      queuePosition: 1,
      estimatedSendTime: "immediate",
      executionTimeMs: 20,
    },
  }

  // 📱 Step: WhatsApp API Send (actual delivery with TRUE/FALSE)
  const whatsappStep: DebugStep = {
    type: "whatsapp_delivery",
    agent: "WhatsApp API",
    timestamp: new Date(
      new Date(safetySteps[0]?.timestamp || new Date()).getTime() + 200
    ).toISOString(),
    output: {
      result: "✅ TRUE - Message sent successfully", // Mock TRUE (success)
      textResponse: finalMessage,
    },
  }

  // 🆕 TIMELINE COMPLETA: Mostra OGNI SINGOLO STEP in ordine
  const timelineSequence = [
    userStep, // STEP 1: User message
    routerSteps[0], // STEP 2: Router iteration 1 (delega a sub-agent)
    ...subAgentSteps, // STEP 3: Sub-agent execution
    routerSteps[1], // STEP 4: Router iteration 2 (riceve risposta)
    linkReplacementSteps[0], // STEP 5: Link Replacement (BEFORE Safety) ✅
    safetySteps[0], // STEP 6: Safety & Translation (AFTER Link Replacement) ✅
    saveToHistoryStep, // STEP 7: Save to history
    queueStep, // STEP 8: Queue message
    whatsappStep, // STEP 9: WhatsApp send
  ].filter(Boolean) // Rimuovi undefined

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between border-b border-gray-700">
          <h2 className="text-xl font-bold">Message Flow Timeline</h2>
          <button
            onClick={onClose}
            className="hover:bg-gray-700 rounded-full p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
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
          <VerticalTimeline lineColor="#E5E7EB">
            {timelineSequence.map((step, index) => {
              const color = getAgentColor(step.type, step.agent)
              const icon = getAgentIcon(step.type)

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
                  date={new Date(step.timestamp).toLocaleTimeString()}
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
                    {/* 🆕 SUB-AGENT BADGE */}
                    {(step as any).isSubAgent && !(step as any).isNested && (
                      <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 border border-blue-300 rounded text-xs font-medium text-blue-800">
                        <span>🔄 Sub-Agent: {(step as any).subAgentType}</span>
                      </div>
                    )}
                    {step.model && (
                      <p className="text-sm text-gray-500">
                        {step.model} • T: {step.temperature}
                      </p>
                    )}
                    {/* 🎯 Show Call Function if present */}
                    {step.functionName && (
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full">
                        <ChevronRight className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-semibold text-purple-700">
                          CF: {step.functionName}
                        </span>
                      </div>
                    )}
                    {step.output?.executionTimeMs && (
                      <p className="text-xs text-gray-400 mt-1">
                        Duration:{" "}
                        {(step.output.executionTimeMs / 1000).toFixed(2)}s
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
                          � PROMPT (System)
                        </summary>
                        <pre className="mt-2 text-xs bg-purple-50 p-3 rounded overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-mono">
                          {(step as any).systemPrompt}
                        </pre>
                      </details>
                    )}

                    {/* Input */}
                    {step.input && (
                      <details className="group">
                        <summary className="cursor-pointer text-sm font-semibold text-blue-600 hover:text-blue-700">
                          � INPUT
                        </summary>
                        <pre className="mt-2 text-xs bg-blue-50 p-3 rounded overflow-x-auto max-h-60 overflow-y-auto">
                          {formatJSON(step.input)}
                        </pre>
                      </details>
                    )}

                    {/* Output with function call if present */}
                    {step.output && (
                      <details className="group" open={!!step.functionName}>
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
                          <pre className="whitespace-pre-wrap break-words">
                            {formatJSON(step.output)}
                          </pre>
                        </div>
                      </details>
                    )}

                    {/* Token Usage */}
                    {step.tokenUsage && (
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                        <span className="font-semibold">Tokens:</span>{" "}
                        {step.tokenUsage.totalTokens.toLocaleString()}{" "}
                        <span className="text-gray-400">
                          ({step.tokenUsage.promptTokens} prompt +{" "}
                          {step.tokenUsage.completionTokens} completion)
                        </span>
                      </div>
                    )}
                  </div>
                </VerticalTimelineElement>
              )
            })}
          </VerticalTimeline>
        </div>

        {/* Text Logs Section */}
        <div className="border-t border-gray-200 bg-gray-50">
          <details className="group">
            <summary className="cursor-pointer px-6 py-3 font-semibold text-gray-700 hover:bg-gray-100">
              📋 Debug Logs (Text Format)
            </summary>
            <div className="px-6 py-4 bg-white max-h-96 overflow-y-auto">
              <div className="font-mono text-xs space-y-4">
                {timelineSequence.map((step, index) => {
                  const stepNumber = index + 1
                  const agentName = step.agent || step.type.toUpperCase()

                  return (
                    <div
                      key={index}
                      className="border-b border-gray-200 pb-4 mb-4 last:border-0"
                    >
                      <div className="font-bold text-sm text-gray-800 mb-2">
                        STEP {stepNumber}: {agentName}
                        {step.model && (
                          <span className="text-gray-500 ml-2">
                            ({step.model})
                          </span>
                        )}
                      </div>

                      {/* INPUT */}
                      {step.input && (
                        <div className="mb-2">
                          <div className="font-semibold text-blue-700">
                            INPUT:
                          </div>
                          <div className="pl-4 text-gray-700 whitespace-pre-wrap">
                            {step.input.userMessage && (
                              <div>User Message: {step.input.userMessage}</div>
                            )}
                            {step.input.conversationHistory &&
                              step.input.conversationHistory.length > 0 && (
                                <div>
                                  History:{" "}
                                  {step.input.conversationHistory.length}{" "}
                                  messages
                                </div>
                              )}
                            {step.input.functionResult && (
                              <div>
                                Function Result:{" "}
                                {JSON.stringify(step.input.functionResult)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* OUTPUT */}
                      {step.output && (
                        <div className="mb-2">
                          <div className="font-semibold text-green-700">
                            OUTPUT:
                          </div>
                          <div className="pl-4 text-gray-700 whitespace-pre-wrap">
                            {step.functionName && (
                              <div className="text-orange-700 font-semibold">
                                Function Call: {formatFunctionCall(step)}
                              </div>
                            )}
                            {step.output.textResponse && (
                              <div>Response: {step.output.textResponse}</div>
                            )}
                            {step.output.decision && (
                              <div>Decision: {step.output.decision}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* TOKENS */}
                      {step.tokenUsage && (
                        <div className="text-gray-500">
                          Tokens: {step.tokenUsage.totalTokens} (
                          {step.tokenUsage.promptTokens} prompt +{" "}
                          {step.tokenUsage.completionTokens} completion)
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
