import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Paperclip, AlertTriangle, CheckCircle2, XCircle, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FlowQuestionNodeData extends Record<string, unknown> {
  question: string
  answers: Array<{ edgeId: string; label: string; triggersEscalation?: boolean }>
  attachmentCount: number
  terminalType: "SELF_SERVICE" | "ESCALATE" | "END" | "LOOP" | null
  hasValidationError?: boolean
  isRoot?: boolean
}

const TERMINAL_ICON: Record<NonNullable<FlowQuestionNodeData["terminalType"]>, React.ReactNode> = {
  SELF_SERVICE: <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />,
  ESCALATE: <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />,
  END: <XCircle className="h-3 w-3 text-gray-400 shrink-0" />,
  LOOP: <RotateCcw className="h-3 w-3 text-blue-500 shrink-0" />,
}

const TERMINAL_ACCENT: Record<NonNullable<FlowQuestionNodeData["terminalType"]>, string> = {
  SELF_SERVICE: "bg-green-500",
  ESCALATE: "bg-amber-500",
  END: "bg-gray-300",
  LOOP: "bg-blue-500",
}

const TERMINAL_TINT: Record<NonNullable<FlowQuestionNodeData["terminalType"]>, string> = {
  SELF_SERVICE: "bg-green-50",
  ESCALATE: "bg-amber-50",
  END: "bg-gray-50",
  LOOP: "bg-blue-50",
}

export const FlowQuestionNode = memo(function FlowQuestionNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowQuestionNodeData
  return (
    <div
      className={cn(
        "group relative rounded-lg border shadow-sm min-w-[180px] max-w-[220px] pl-3 pr-2 py-1.5",
        nodeData.terminalType ? TERMINAL_TINT[nodeData.terminalType] : "bg-white",
        selected ? "border-primary ring-2 ring-primary/30" : "border-gray-200",
        nodeData.hasValidationError && "border-red-400 ring-2 ring-red-200",
      )}
    >
      {nodeData.terminalType && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 rounded-l-[7px]",
            TERMINAL_ACCENT[nodeData.terminalType],
          )}
        />
      )}

      {nodeData.isRoot && (
        <div className="absolute -top-2 left-2 rounded-full bg-primary px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
          Start
        </div>
      )}

      <Handle type="target" position={Position.Left} />

      {/* Return edges enter from below, so they never cross the forward path. */}
      <Handle type="target" position={Position.Bottom} id="return" />

      <div className="flex items-start justify-between gap-1.5">
        <p className="text-xs font-medium text-gray-900 leading-snug line-clamp-3">{nodeData.question || "(empty question)"}</p>
        {nodeData.terminalType && TERMINAL_ICON[nodeData.terminalType]}
      </div>

      {nodeData.attachmentCount > 0 && (
        <div className="mt-1 flex items-center gap-0.5 text-[10px] text-gray-500">
          <Paperclip className="h-2.5 w-2.5" />
          {nodeData.attachmentCount}
        </div>
      )}

      {nodeData.answers.length > 0 && (
        <div className="mt-1.5 border-t border-black/10 pt-1 space-y-0.5">
          {nodeData.answers.map((answer) => (
            <div key={answer.edgeId} className="relative flex items-center py-0.5 pr-1">
              <span className="text-[10px] text-gray-600 truncate">{answer.label || "(empty)"}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={answer.edgeId}
                style={{ position: "absolute", right: -11, top: "50%" }}
                className={cn(answer.triggersEscalation && "!bg-amber-500")}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
