import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Paperclip } from "lucide-react"
import type { FlowQuestionNodeData } from "./FlowQuestionNode"
import type { Asset } from "@/services/demoRobotApi"

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
  // Debounced writes into React Flow state (design.md Decision 12:
  // updateNodeData, never a per-keystroke store write).
  onChange: (nodeId: string, patch: Partial<FlowQuestionNodeData>) => void
  onAddAnswer: (nodeId: string, label: string) => void
  onRemoveAnswer: (nodeId: string, edgeId: string) => void
  onToggleAnswerEscalation: (nodeId: string, edgeId: string, value: boolean) => void
  onToggleAttachment: (nodeId: string, assetId: string, attached: boolean) => void
}

const DEBOUNCE_MS = 400

export function FlowNodePanel({
  open,
  onOpenChange,
  nodeId,
  data,
  availableAssets,
  attachedAssetIds,
  onChange,
  onAddAnswer,
  onRemoveAnswer,
  onToggleAnswerEscalation,
  onToggleAttachment,
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

          <div className="space-y-2">
            <Label>Terminal type</Label>
            <Select
              value={terminalType || "none"}
              onValueChange={(v) => {
                const value = v === "none" ? "" : v
                setTerminalType(value)
                onChange(nodeId, { terminalType: (value || null) as FlowQuestionNodeData["terminalType"] })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not a terminal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not a terminal (has answers)</SelectItem>
                <SelectItem value="SELF_SERVICE">Self-service (resolved)</SelectItem>
                <SelectItem value="ESCALATE">Escalate to operator</SelectItem>
                <SelectItem value="END">End (simple close)</SelectItem>
                <SelectItem value="LOOP">Loop back</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Answers</Label>
            </div>
            <div className="space-y-2">
              {data.answers.map((answer) => (
                <div key={answer.edgeId} className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1.5">
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
              ))}
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
