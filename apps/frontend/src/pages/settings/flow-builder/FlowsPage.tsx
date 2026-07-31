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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GitBranch, Plus, ArrowLeft } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { toast } from "@/lib/toast"
import { flowApi, Flow } from "@/services/flowBuilderApi"

// robotModelId param is "generic" for the workspace-generic fallback flow
// list (Flow.robotModelId: null, analisi.md §6), otherwise a real RobotModel id.
export function FlowsPage() {
  const { workspace } = useWorkspace()
  const { robotModelId } = useParams<{ robotModelId: string }>()
  const navigate = useNavigate()
  const workspaceId = workspace?.id || ""
  const isGeneric = robotModelId === "generic"
  const resolvedRobotModelId = isGeneric ? null : robotModelId ?? null

  const [flows, setFlows] = useState<Flow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Flow | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    setIsLoading(true)
    flowApi
      .list(workspaceId, resolvedRobotModelId)
      .then(setFlows)
      .catch((err) => toast.error(err.message || "Failed to load flows"))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, robotModelId])

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error("Title is required")
      return
    }
    try {
      const created = await flowApi.create(workspaceId, { title: newTitle.trim(), robotModelId: resolvedRobotModelId })
      setShowAddDialog(false)
      setNewTitle("")
      navigate(`/settings/demorobot/${robotModelId}/flows/${created.id}/edit`)
    } catch (err: any) {
      toast.error(err.message || "Failed to create flow")
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
    { header: "Keywords", accessorKey: "keywords", cell: ({ getValue }) => ((getValue() as string[]) || []).join(", ") || "—" },
  ]

  const filtered = flows.filter((f) => `${f.title} ${f.description ?? ""}`.toLowerCase().includes(searchValue.toLowerCase()))

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/settings/demorobot")}>
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back to Robot Models
      </Button>

      <PageHeader
        title={isGeneric ? "Generic Flows (fallback)" : "Flows"}
        titleIcon={<GitBranch className="h-6 w-6" />}
        description={
          isGeneric
            ? "These flows apply when no specific robot model matches — they are the retrieval fallback."
            : "Diagnostic flows for this robot model. Each flow is a question/answer tree compiled into the assistant's prompt."
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
        onEdit={(flow) => navigate(`/settings/demorobot/${robotModelId}/flows/${flow.id}/edit`)}
        onDelete={(flow) => setDeleteTarget(flow)}
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Flow"
        description={`This will delete "${deleteTarget?.title}". This cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  )
}

export default FlowsPage
