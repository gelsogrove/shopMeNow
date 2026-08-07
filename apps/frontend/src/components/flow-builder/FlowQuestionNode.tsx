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
  // Injected at render time by the editor (no edge points at this node), not
  // stored — see displayNodes in FlowEditorPage.
  isRoot?: boolean
}

const TERMINAL_ICON: Record<NonNullable<FlowQuestionNodeData["terminalType"]>, React.ReactNode> = {
  SELF_SERVICE: <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />,
  ESCALATE: <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />,
  END: <XCircle className="h-3 w-3 text-gray-400 shrink-0" />,
  LOOP: <RotateCcw className="h-3 w-3 text-blue-500 shrink-0" />,
}

// A terminal node's outcome is the one thing a reader needs at a glance, and
// the 12px icon alone does not survive being zoomed out. The accent bar carries
// the colour (visible at any zoom) while the tint stays near-white, so a canvas
// full of coloured nodes is still readable — a saturated fill would not be.
// The amber matches the escalation edge stroke (#f59e0b), so an escalating
// answer and the node it lands on read as the same thing.
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
        "group relative rounded-lg border bg-white shadow-sm min-w-[180px] max-w-[220px] px-2 py-1.5",
        selected ? "border-primary ring-2 ring-primary/30" : "border-gray-200",
        nodeData.hasValidationError && "border-red-400 ring-2 ring-red-200",
      )}
    >
      <Handle type="target" position={Position.Left} />

      {/* Second target handle, on the bottom edge, used only by return edges
          (LOOP nodes wiring back to the question they re-ask). Entering from
          below keeps the left handle meaning "the forward path arrives here",
          so a reader can still follow the flow left-to-right without the
          return line cutting back across it. */}
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
