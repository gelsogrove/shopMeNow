import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Paperclip, ArrowRight } from "lucide-react"
import type { FlowQuestionNodeData } from "./FlowQuestionNode"
import type { Asset } from "@/services/flowBuilderApi"

export interface EditableAnswer {
  edgeId: string
  label: string
  triggersEscalation: boolean
}

interface FlowNodePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodeId: string | null
  data: FlowQuestionNodeData | null
  availableAssets: Asset[]
  attachedAssetIds: string[]
  // All nodes in the flow (id + question text), for the "Go to" dropdown —
  // lets an answer point at an existing node without canvas drag.
  allNodes: Array<{ id: string; question: string }>
  // edgeId -> current target node id, so the dropdown shows the existing link.
  edgeTargets: Record<string, string>
  // Debounced writes into React Flow state (design.md Decision 12:
  // updateNodeData, never a per-keystroke store write).
  onChange: (nodeId: string, patch: Partial<FlowQuestionNodeData>) => void
  onAddAnswer: (nodeId: string, label: string) => void
  onRemoveAnswer: (nodeId: string, edgeId: string) => void
  onToggleAnswerEscalation: (nodeId: string, edgeId: string, value: boolean) => void
  onToggleAttachment: (nodeId: string, assetId: string, attached: boolean) => void
  onRetargetAnswer: (nodeId: string, edgeId: string, targetNodeId: string) => void
}

const DEBOUNCE_MS = 400

export function FlowNodePanel({
  open,
  onOpenChange,
  nodeId,
  data,
  availableAssets,
  attachedAssetIds,
  allNodes,
  edgeTargets,
  onChange,
  onAddAnswer,
  onRemoveAnswer,
  onToggleAnswerEscalation,
  onToggleAttachment,
  onRetargetAnswer,
}: FlowNodePanelProps) {
  const [question, setQuestion] = useState("")
  const [fieldKey, setFieldKey] = useState("")
  const [fieldType, setFieldType] = useState<string>("")
  const [terminalType, setTerminalType] = useState<string>("")
  const [newAnswerLabel, setNewAnswerLabel] = useState("")

  useEffect(() => {
    if (!data) return
    setQuestion(data.question)
    setTerminalType(data.terminalType ?? "")
    // fieldKey/fieldType are carried on data via the same object (see FlowEditorPage mapping)
    setFieldKey((data as any).fieldKey ?? "")
    setFieldType((data as any).fieldType ?? "")
  }, [nodeId, data])

  useEffect(() => {
    if (!nodeId || !data) return
    if (question === data.question) return
    const t = setTimeout(() => onChange(nodeId, { question }), DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question])

  if (!data || !nodeId) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Question</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="node-question">Question</Label>
            <Textarea id="node-question" value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="node-field-key">Field key (optional)</Label>
              <Input
                id="node-field-key"
                value={fieldKey}
                onChange={(e) => {
                  setFieldKey(e.target.value)
                  onChange(nodeId, { fieldKey: e.target.value } as any)
                }}
                placeholder="wifiStatus"
              />
            </div>
            <div className="space-y-2">
              <Label>Field type</Label>
              <Select
                value={fieldType || "none"}
                onValueChange={(v) => {
                  const value = v === "none" ? "" : v
                  setFieldType(value)
                  onChange(nodeId, { fieldType: value || null } as any)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="string">string</SelectItem>
                  <SelectItem value="number">number</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                  <SelectItem value="date">date</SelectItem>
                  <SelectItem value="enum">enum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Two plain checkboxes instead of a 5-option technical dropdown.
              Mutually exclusive; neither checked = the node continues with
              its own answers (the implicit default, no explicit "Not a
              terminal" choice needed). END/LOOP still exist as valid
              terminalType values in the data model (compiler/spec), just not
              exposed here — END is behaviorally identical to SELF_SERVICE
              today, LOOP is reserved/not yet a real case (analisi.md §5). */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={terminalType === "SELF_SERVICE"}
                onCheckedChange={(checked) => {
                  const value = checked ? "SELF_SERVICE" : ""
                  setTerminalType(value)
                  onChange(nodeId, { terminalType: (value || null) as FlowQuestionNodeData["terminalType"] })
                }}
              />
              End — success
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={terminalType === "ESCALATE"}
                onCheckedChange={(checked) => {
                  const value = checked ? "ESCALATE" : ""
                  setTerminalType(value)
                  onChange(nodeId, { terminalType: (value || null) as FlowQuestionNodeData["terminalType"] })
                }}
              />
              Call operator
            </label>
          </div>

          {!terminalType && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Answers</Label>
            </div>
            <div className="space-y-2">
              {data.answers.map((answer) => {
                const currentTarget = edgeTargets[answer.edgeId] ?? ""
                return (
                  <div key={answer.edgeId} className="rounded-md border border-gray-200 px-2 py-1.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm">{answer.label}</span>
                      <label className="flex items-center gap-1.5 text-xs text-amber-700">
                        <Checkbox
                          checked={!!answer.triggersEscalation}
                          onCheckedChange={(checked) => onToggleAnswerEscalation(nodeId, answer.edgeId, !!checked)}
                        />
                        Escalates
                      </label>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveAnswer(nodeId, answer.edgeId)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                      <Select
                        value={currentTarget || undefined}
                        onValueChange={(v) => onRetargetAnswer(nodeId, answer.edgeId, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Go to…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__new__">+ Create new question</SelectItem>
                          {allNodes
                            .filter((n) => n.id !== nodeId)
                            .map((n) => (
                              <SelectItem key={n.id} value={n.id}>
                                {n.question || "(empty question)"}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={newAnswerLabel}
                onChange={(e) => setNewAnswerLabel(e.target.value)}
                placeholder="e.g. Yes"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newAnswerLabel.trim()) {
                    onAddAnswer(nodeId, newAnswerLabel.trim())
                    setNewAnswerLabel("")
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!newAnswerLabel.trim()) return
                  onAddAnswer(nodeId, newAnswerLabel.trim())
                  setNewAnswerLabel("")
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />
              Attachments
            </Label>
            {availableAssets.length === 0 && (
              <p className="text-xs text-muted-foreground">No assets uploaded for this robot model yet.</p>
            )}
            <div className="space-y-1.5">
              {availableAssets.map((asset) => (
                <label key={asset.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={attachedAssetIds.includes(asset.id)}
                    onCheckedChange={(checked) => onToggleAttachment(nodeId, asset.id, !!checked)}
                  />
                  <span>{asset.title}</span>
                  <span className="text-xs text-muted-foreground">({asset.type})</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
