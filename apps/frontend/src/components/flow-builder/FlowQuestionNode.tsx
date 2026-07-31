import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Paperclip, AlertTriangle, CheckCircle2, XCircle, RotateCcw, Copy } from "lucide-react"
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
  // Duplicates this question. Passed down through node data because React Flow
  // gives custom nodes no other channel to reach the page's handlers.
  onDuplicate?: (nodeId: string) => void
}

const TERMINAL_ICON: Record<NonNullable<FlowQuestionNodeData["terminalType"]>, React.ReactNode> = {
  SELF_SERVICE: <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />,
  ESCALATE: <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />,
  END: <XCircle className="h-3 w-3 text-gray-400 shrink-0" />,
  LOOP: <RotateCcw className="h-3 w-3 text-blue-500 shrink-0" />,
}

export const FlowQuestionNode = memo(function FlowQuestionNode({ id, data, selected }: NodeProps) {
  const nodeData = data as FlowQuestionNodeData
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-white shadow-sm min-w-[180px] max-w-[220px] px-2 py-1.5",
        selected ? "border-primary ring-2 ring-primary/30" : "border-gray-200",
        nodeData.hasValidationError && "border-red-400 ring-2 ring-red-200",
      )}
    >
      <Handle type="target" position={Position.Left} />

      {/* Duplicate — appears on hover so the node stays compact by default.
          nodrag/stopPropagation keep the click from being swallowed by React
          Flow's drag handling or from selecting the node instead. */}
      {nodeData.onDuplicate && (
        <button
          type="button"
          title="Duplicate this question"
          onClick={(e) => {
            e.stopPropagation()
            nodeData.onDuplicate?.(id)
          }}
          className="nodrag absolute -top-2 -right-2 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:text-primary hover:border-primary group-hover:flex"
        >
          <Copy className="h-3 w-3" />
        </button>
      )}

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

      {/* Each answer is its own row, in normal document flow — the Handle is
          positioned relative to THIS row (not an absolute offset from the
          node's top), so it never overlaps the question text regardless of
          how many lines it wraps to. This is the pattern React Flow itself
          recommends for handles whose count/position depends on variable
          content. */}
      {nodeData.answers.length > 0 && (
        <div className="mt-1.5 border-t border-gray-100 pt-1 space-y-0.5">
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
