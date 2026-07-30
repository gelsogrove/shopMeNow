import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Paperclip, AlertTriangle, CheckCircle2, XCircle, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

// design.md Decision 12 / analisi.md §3: compact canvas representation only
// (title + answer count + attachment icon) — all real editing happens in
// the side panel, never inline on the canvas node itself.

export interface FlowQuestionNodeData extends Record<string, unknown> {
  question: string
  answers: Array<{ edgeId: string; label: string; triggersEscalation?: boolean }>
  attachmentCount: number
  terminalType: "SELF_SERVICE" | "ESCALATE" | "END" | "LOOP" | null
  hasValidationError?: boolean
}

const TERMINAL_ICON: Record<NonNullable<FlowQuestionNodeData["terminalType"]>, React.ReactNode> = {
  SELF_SERVICE: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  ESCALATE: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
  END: <XCircle className="h-3.5 w-3.5 text-gray-400" />,
  LOOP: <RotateCcw className="h-3.5 w-3.5 text-blue-500" />,
}

// React Flow does not auto-position multiple handles on the same side
// (design.md Decision 12) — explicit vertical spacing per answer, id ===
// FlowEdge.id so sourceHandle on the resulting edge IS the FlowEdge id.
const HANDLE_TOP_OFFSET = 16
const HANDLE_SPACING = 28

export const FlowQuestionNode = memo(function FlowQuestionNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowQuestionNodeData
  return (
    <div
      className={cn(
        "rounded-lg border bg-white shadow-sm min-w-[220px] max-w-[260px] px-3 py-2.5",
        selected ? "border-primary ring-2 ring-primary/30" : "border-gray-200",
        nodeData.hasValidationError && "border-red-400 ring-2 ring-red-200",
      )}
    >
      <Handle type="target" position={Position.Left} />

      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 line-clamp-3">{nodeData.question || "(empty question)"}</p>
        {nodeData.terminalType && TERMINAL_ICON[nodeData.terminalType]}
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
        <span>{nodeData.answers.length} answer{nodeData.answers.length === 1 ? "" : "s"}</span>
        {nodeData.attachmentCount > 0 && (
          <span className="flex items-center gap-0.5">
            <Paperclip className="h-3 w-3" />
            {nodeData.attachmentCount}
          </span>
        )}
      </div>

      {nodeData.answers.map((answer, index) => (
        <Handle
          key={answer.edgeId}
          type="source"
          position={Position.Right}
          id={answer.edgeId}
          style={{ top: HANDLE_TOP_OFFSET + index * HANDLE_SPACING }}
          className={cn(answer.triggersEscalation && "!bg-amber-500")}
        />
      ))}
    </div>
  )
})
