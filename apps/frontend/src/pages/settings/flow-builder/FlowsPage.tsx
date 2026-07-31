import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/shared/DataTable"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GitBranch, Plus, ArrowLeft, Copy, FileText } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { toast } from "@/lib/toast"
import { flowApi, Flow } from "@/services/flowBuilderApi"
import { ChatWidget } from "@/components/ChatWidget"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"

// categoryId param is "generic" for the workspace-generic fallback flow
// list (Flow.flowCategoryId: null, analisi.md §6), otherwise a real FlowCategory id.
export function FlowsPage() {
  const { workspace } = useWorkspace()
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const workspaceId = workspace?.id || ""
  const isGeneric = categoryId === "generic"
  const resolvedCategoryId = isGeneric ? null : categoryId ?? null

  const [flows, setFlows] = useState<Flow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Flow | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  // Flow whose stored prompt is being viewed; null closes the dialog.
  const [promptTarget, setPromptTarget] = useState<Flow | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    setIsLoading(true)
    flowApi
      .list(workspaceId, resolvedCategoryId)
      .then(setFlows)
      .catch((err) => toast.error(err.message || "Failed to load flows"))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, categoryId])

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error("Title is required")
      return
    }
    try {
      const created = await flowApi.create(workspaceId, { title: newTitle.trim(), robotModelId: resolvedCategoryId })
      setShowAddDialog(false)
      setNewTitle("")
      navigate(`/settings/demorobot/${categoryId}/flows/${created.id}/edit`)
    } catch (err: any) {
      toast.error(err.message || "Failed to create flow")
    }
  }

  // Duplication happens server-side in one transactional call: the previous
  // client-side version issued three requests (read graph, create flow, save
  // graph) and could leave a half-built flow behind if any of them failed.
  const handleDuplicate = async (flow: Flow) => {
    setDuplicatingId(flow.id)
    try {
      const created = await flowApi.duplicate(workspaceId, flow.id)
      setFlows((prev) => [...prev, created])
      toast.success("Flow duplicated")
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate flow")
    } finally {
      setDuplicatingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await flowApi.delete(workspaceId, deleteTarget.id)
      setFlows((prev) => prev.filter((f) => f.id !== deleteTarget.id))
      toast.success("Flow deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete flow")
    } finally {
      setDeleteTarget(null)
    }
  }

  const columns: ColumnDef<Flow>[] = [
    { header: "Title", accessorKey: "title" },
    { header: "Description", accessorKey: "description", cell: ({ getValue }) => (getValue() as string) || "—" },
  ]

  const filtered = flows.filter((f) => `${f.title} ${f.description ?? ""}`.toLowerCase().includes(searchValue.toLowerCase()))

  return (
    <div className="p-6 space-y-6">
      {/* Same "Settings" title + section dropdown as SettingsPage, so
          navigating here still reads as being inside Settings. */}
      <SettingsPageHeader currentSection="demorobot" />

      <Button variant="ghost" size="sm" onClick={() => navigate("/settings/demorobot")}>
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back to Categories
      </Button>

      <PageHeader
        title={isGeneric ? "Generic Flows (fallback)" : "Flows"}
        titleIcon={<GitBranch className="h-6 w-6" />}
        description={
          isGeneric
            ? "These flows apply when no specific category matches — they are the retrieval fallback."
            : "Flows for this category. Each flow is a question/answer tree compiled into the assistant's prompt."
        }
        searchValue={searchValue}
        onSearch={setSearchValue}
        onAdd={() => setShowAddDialog(true)}
        addButtonText="New Flow"
        addButtonIcon={<Plus className="h-4 w-4 mr-1.5 text-white" />}
        itemCount={filtered.length}
      />

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        onEdit={(flow) => navigate(`/settings/demorobot/${categoryId}/flows/${flow.id}/edit`)}
        onDelete={(flow) => setDeleteTarget(flow)}
        actionButtons={(flow) => (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              onClick={() => setPromptTarget(flow)}
              title={flow.humanPrompt ? "View prompt" : "No prompt generated yet"}
            >
              <FileText
                className={`h-4 w-4 ${flow.humanPrompt ? "text-blue-500" : "text-gray-300"}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              disabled={duplicatingId === flow.id}
              onClick={() => handleDuplicate(flow)}
              title="Duplicate"
            >
              <Copy className="h-4 w-4 text-gray-500" />
            </Button>
          </>
        )}
      />

      {/* Read-only view of the stored prompt. Editing happens in the flow
          editor after a save, so this dialog only shows what is there. */}
      <Dialog open={!!promptTarget} onOpenChange={(open) => !open && setPromptTarget(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{promptTarget?.title}</DialogTitle>
            <DialogDescription>
              The instructions the assistant follows for this flow.
            </DialogDescription>
          </DialogHeader>

          {promptTarget?.humanPrompt ? (
            <>
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-gray-600">
                <span className="font-medium">Source:</span>{" "}
                <code className="font-mono">
                  {resolvedCategoryId
                    ? `flows/${resolvedCategoryId}/${promptTarget.id}`
                    : `flows/generic/${promptTarget.id}`}
                </code>
              </div>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border bg-white p-4 text-sm leading-relaxed">
                {promptTarget.humanPrompt}
              </pre>
            </>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No prompt has been generated for this flow yet.
              <br />
              Open the flow and click Save to generate one.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Flow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="flow-title">Title</Label>
              <Input id="flow-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Strange noise" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create &amp; Open Editor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Flow"
        description={`This will delete "${deleteTarget?.title}". This cannot be undone.`}
        onConfirm={handleDelete}
      />

      {/* Chat Widget preview — same as SettingsPage */}
      {workspace && workspace.channelStatus !== false && (
        <ChatWidget
          workspaceId={workspace.id}
          title={workspace.widgetTitle}
          primaryColor={workspace.widgetPrimaryColor}
          icon={workspace.widgetIcon}
          useChannelLogo={workspace.widgetUseChannelLogo}
          useWindowConfig={false}
          language={workspace.widgetLanguage}
        />
      )}
    </div>
  )
}

export default FlowsPage
