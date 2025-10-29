import { X } from "lucide-react"
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
    functionCall?: { name: string; arguments: any }
    textResponse?: string
    result?: any
    executionTimeMs?: number
  }
  duration?: number
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
    return "#3B82F6" // Blue for sub-agents
  }

  const getAgentIcon = (type: string): string => {
    if (type === "user") return "👤"
    if (type === "router") return "🧠"
    if (type === "safety") return "🛡️"
    if (type === "whatsapp_delivery") return "📱"
    return "⚙️"
  }

  const formatJSON = (obj: any): string => {
    if (obj === null || obj === undefined) return "N/A"
    return JSON.stringify(obj, null, 2)
  }

  // Organizza steps per timeline
  const allSteps = debugInfo.steps
  const routerSteps = allSteps.filter((s) => s.type === "router")
  const safetySteps = allSteps.filter((s) => s.type === "safety")
  const subAgentSteps = allSteps.filter((s) => s.type === "sub_agent")

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

  const whatsappStep: DebugStep = {
    type: "whatsapp_delivery",
    agent: "WhatsApp API",
    timestamp: new Date().toISOString(),
    output: { textResponse: "Message delivered to WhatsApp" },
  }

  // Sequenza timeline: UserMessage, Router1, SubAgent, Router2, Safety, WhatsApp
  const timelineSequence = [
    userStep,
    routerSteps[0],
    subAgentSteps[0],
    routerSteps[1],
    safetySteps[0],
    whatsappStep,
  ].filter(Boolean) // Rimuovi undefined

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Message Flow Timeline</h2>
          <button
            onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
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
            <span className="font-semibold">{debugInfo.totalTokens?.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Cost:</span>{" "}
            <span className="font-semibold">${debugInfo.totalCost?.toFixed(4)}</span>
          </div>
          <div>
            <span className="text-gray-500">Time:</span>{" "}
            <span className="font-semibold">{(debugInfo.executionTimeMs / 1000).toFixed(2)}s</span>
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
                  className="vertical-timeline-element"
                  contentStyle={{
                    background: "#fff",
                    boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
                    border: "1px solid #e5e7eb",
                  }}
                  contentArrowStyle={{ borderRight: `7px solid ${color}` }}
                  date={new Date(step.timestamp).toLocaleTimeString()}
                  iconStyle={{ background: color, color: "#fff" }}
                  icon={<span className="text-2xl">{icon}</span>}
                >
                  {/* Card Header */}
                  <div className="mb-3">
                    <h3 className="text-lg font-bold" style={{ color }}>
                      {step.agent || step.type.replace("_", " ").toUpperCase()}
                    </h3>
                    {step.model && (
                      <p className="text-sm text-gray-500">
                        {step.model} • T: {step.temperature}
                      </p>
                    )}
                    {step.output?.executionTimeMs && (
                      <p className="text-xs text-gray-400">
                        Duration: {(step.output.executionTimeMs / 1000).toFixed(2)}s
                      </p>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="space-y-3">
                    {/* Input */}
                    {step.input && (
                      <details className="group">
                        <summary className="cursor-pointer text-sm font-semibold text-blue-600 hover:text-blue-700">
                          📥 INPUT
                        </summary>
                        <pre className="mt-2 text-xs bg-blue-50 p-3 rounded overflow-x-auto max-h-60 overflow-y-auto">
                          {formatJSON(step.input)}
                        </pre>
                      </details>
                    )}

                    {/* Function Call (always visible) */}
                    {step.output?.functionCall && (
                      <div>
                        <p className="text-sm font-semibold text-orange-600 mb-2">
                          📤 Function Arguments
                        </p>
                        <pre className="text-xs bg-orange-50 p-3 rounded overflow-x-auto max-h-60 overflow-y-auto">
                          {formatJSON(step.output.functionCall)}
                        </pre>
                      </div>
                    )}

                    {/* Output */}
                    {step.output && (
                      <details className="group">
                        <summary className="cursor-pointer text-sm font-semibold text-green-600 hover:text-green-700">
                          📤 OUTPUT
                        </summary>
                        <pre className="mt-2 text-xs bg-green-50 p-3 rounded overflow-x-auto max-h-60 overflow-y-auto">
                          {formatJSON(step.output)}
                        </pre>
                      </details>
                    )}

                    {/* Token Usage */}
                    {step.tokenUsage && (
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                        <span className="font-semibold">Tokens:</span>{" "}
                        {step.tokenUsage.totalTokens.toLocaleString()}{" "}
                        <span className="text-gray-400">
                          ({step.tokenUsage.promptTokens} prompt + {step.tokenUsage.completionTokens} completion)
                        </span>
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
