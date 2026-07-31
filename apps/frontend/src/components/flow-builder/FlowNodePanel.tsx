import { useEffect, useRef, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Paperclip, ArrowRight, Upload, Loader2 } from "lucide-react"
import type { FlowQuestionNodeData } from "./FlowQuestionNode"
import type { Asset } from "@/services/flowBuilderApi"

export interface EditableAnswer {
  edgeId: string
  label: string
  triggersEscalation: boolean
}

// Everything except video: manuals, spec sheets, spreadsheets, photos.
const ACCEPTED_FILE_TYPES = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
].join(",")

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i

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
  onDeleteNode: (nodeId: string) => void
  // Uploads a new asset for the current category. Absent when the flow is the
  // workspace-generic one (no category to attach assets to).
  onUploadAsset?: (file: File) => Promise<void>
  // Permanently deletes an uploaded asset (DB row + stored file). Absent for the
  // workspace-generic flow, same as onUploadAsset.
  onDeleteAsset?: (assetId: string) => Promise<void>
  canUploadAssets: boolean
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
  onDeleteNode,
  onUploadAsset,
  onDeleteAsset,
  canUploadAssets,
}: FlowNodePanelProps) {
  const [question, setQuestion] = useState("")
  const [terminalType, setTerminalType] = useState<string>("")
  const [newAnswerLabel, setNewAnswerLabel] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  // Asset pending deletion — drives the confirm dialog. Deleting removes the
  // stored file for every flow that uses it, so it always asks first.
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null)
  const [isDeletingAsset, setIsDeletingAsset] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleConfirmDeleteAsset = async () => {
    if (!assetToDelete || !onDeleteAsset) return
    setIsDeletingAsset(true)
    try {
      await onDeleteAsset(assetToDelete.id)
      setAssetToDelete(null)
    } finally {
      setIsDeletingAsset(false)
    }
  }

  useEffect(() => {
    if (!data) return
    setQuestion(data.question)
    setTerminalType(data.terminalType ?? "")
  }, [nodeId, data])

  useEffect(() => {
    if (!nodeId || !data) return
    if (question === data.question) return
    const t = setTimeout(() => onChange(nodeId, { question }), DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question])

  if (!data || !nodeId) return null

  const handleFilePicked = async (file: File | undefined) => {
    if (!file || !onUploadAsset) return
    setIsUploading(true)
    try {
      await onUploadAsset(file)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Question</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="node-question">Question</Label>
            <Textarea
              id="node-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={10}
              className="min-h-[220px] resize-y"
              placeholder="What should the assistant ask or say at this step?"
            />
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

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between pt-2">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Attachments
              </Label>
              {canUploadAssets && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Upload
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              onChange={(e) => handleFilePicked(e.target.files?.[0])}
            />

            {!canUploadAssets && (
              <p className="text-xs text-muted-foreground">
                Attachments are only available for flows that belong to a category.
              </p>
            )}
            {canUploadAssets && availableAssets.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No files yet. Upload PDF, Word, Excel or images.
              </p>
            )}

            <div className="space-y-1.5">
              {availableAssets.map((asset) => (
                <div key={asset.id} className="group flex items-center gap-2 text-sm">
                  <label className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer">
                    <Checkbox
                      checked={attachedAssetIds.includes(asset.id)}
                      onCheckedChange={(checked) => onToggleAttachment(nodeId, asset.id, !!checked)}
                    />
                    <span className="flex-1 truncate">{asset.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">({asset.type})</span>
                  </label>
                  {onDeleteAsset && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-red-500 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-50"
                      title={`Delete "${asset.title}"`}
                      onClick={() => setAssetToDelete(asset)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Node deletion — applied to the canvas immediately, persisted only
              when the flow is saved, same as every other edit here. */}
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => {
                onDeleteNode(nodeId)
                onOpenChange(false)
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete question
            </Button>
            <p className="text-xs text-muted-foreground mt-1.5">
              Removed from the canvas now — click Save to persist.
            </p>
          </div>
        </div>

        {/* Attachment deletion is immediate and irreversible (it removes the
            stored file, not just the link to this question), so it confirms
            first — unlike node edits, which are undoable until Save. */}
        <ConfirmDialog
          open={!!assetToDelete}
          onOpenChange={(open) => !open && setAssetToDelete(null)}
          title="Delete attachment"
          description={
            `"${assetToDelete?.title}" will be permanently deleted, including the uploaded file. ` +
            `Any other question using it will lose the attachment. This cannot be undone.`
          }
          confirmLabel={isDeletingAsset ? "Deleting..." : "Delete"}
          variant="destructive"
          onConfirm={handleConfirmDeleteAsset}
        />
      </SheetContent>
    </Sheet>
  )
}
