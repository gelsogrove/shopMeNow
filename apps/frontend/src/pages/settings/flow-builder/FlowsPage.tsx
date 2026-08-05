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
import { GitBranch, Plus, ArrowLeft, Copy } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  // Flow being duplicated; the dialog collects the copy's title before the call.
  const [duplicateTarget, setDuplicateTarget] = useState<Flow | null>(null)
  const [duplicateTitle, setDuplicateTitle] = useState("")
  const [isDuplicating, setIsDuplicating] = useState(false)

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
  const openDuplicateDialog = (flow: Flow) => {
    setDuplicateTarget(flow)
    setDuplicateTitle(`${flow.title} (copy)`)
  }

  const handleDuplicate = async () => {
    if (!duplicateTarget) return
    if (!duplicateTitle.trim()) {
      toast.error("Title is required")
      return
    }
    setIsDuplicating(true)
    try {
      const created = await flowApi.duplicate(workspaceId, duplicateTarget.id, duplicateTitle.trim())
      setFlows((prev) => [...prev, created])
      setDuplicateTarget(null)
      toast.success("Flow duplicated")
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate flow")
    } finally {
      setIsDuplicating(false)
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
    { header: "Title", accessorKey: "title", size: 200 },
    { header: "Description", accessorKey: "description", cell: ({ getValue }) => (getValue() as string) || "—" },
  ]

  const filtered = flows
    .filter((f) => `${f.title} ${f.description ?? ""}`.toLowerCase().includes(searchValue.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title))

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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 p-0"
                    onClick={() => openDuplicateDialog(flow)}
                  >
                    <Copy className="h-4 w-4 text-gray-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Duplicate</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      />

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

      {/* Duplicating copies the whole graph — nodes, answers and attachments —
          server-side, so only the new title is asked for here. */}
      <Dialog open={!!duplicateTarget} onOpenChange={(open) => !open && setDuplicateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Flow</DialogTitle>
            <DialogDescription>
              Creates a full copy of "{duplicateTarget?.title}", including its questions,
              answers and attachments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="duplicate-title">New flow title</Label>
              <Input
                id="duplicate-title"
                value={duplicateTitle}
                onChange={(e) => setDuplicateTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDuplicate()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateTarget(null)} disabled={isDuplicating}>
              Cancel
            </Button>
            <Button onClick={handleDuplicate} disabled={isDuplicating}>
              {isDuplicating ? "Duplicating..." : "Duplicate"}
            </Button>
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
