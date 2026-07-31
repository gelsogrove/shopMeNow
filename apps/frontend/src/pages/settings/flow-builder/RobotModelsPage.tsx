import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/shared/DataTable"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Bot, Plus } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { toast } from "@/lib/toast"
import { robotModelApi, RobotModel } from "@/services/flowBuilderApi"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function RobotModelsPage() {
  const { workspace } = useWorkspace()
  const navigate = useNavigate()
  const workspaceId = workspace?.id || ""

  const [models, setModels] = useState<RobotModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newName, setNewName] = useState("")
  const [newManufacturer, setNewManufacturer] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<RobotModel | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    setIsLoading(true)
    robotModelApi
      .list(workspaceId)
      .then(setModels)
      .catch((err) => toast.error(err.message || "Failed to load robot models"))
      .finally(() => setIsLoading(false))
  }, [workspaceId])

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Name is required")
      return
    }
    try {
      const created = await robotModelApi.create(workspaceId, {
        name: newName.trim(),
        slug: slugify(newName),
        manufacturer: newManufacturer.trim() || undefined,
        description: newDescription.trim() || undefined,
      })
      setModels((prev) => [...prev, created])
      setShowAddDialog(false)
      setNewName("")
      setNewManufacturer("")
      setNewDescription("")
      toast.success("Robot model created")
    } catch (err: any) {
      toast.error(err.message || "Failed to create robot model")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await robotModelApi.delete(workspaceId, deleteTarget.id)
      setModels((prev) => prev.filter((m) => m.id !== deleteTarget.id))
      toast.success("Robot model deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete robot model")
    } finally {
      setDeleteTarget(null)
    }
  }

  const columns: ColumnDef<RobotModel>[] = [
    { header: "Name", accessorKey: "name" },
    { header: "Manufacturer", accessorKey: "manufacturer", cell: ({ getValue }) => (getValue() as string) || "—" },
    { header: "Slug", accessorKey: "slug" },
  ]

  const filtered = models.filter((m) =>
    `${m.name} ${m.manufacturer ?? ""} ${m.slug}`.toLowerCase().includes(searchValue.toLowerCase()),
  )

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Robot Models"
        titleIcon={<Bot className="h-6 w-6" />}
        description="Manage the robot models this workspace supports diagnostic flows for."
        searchValue={searchValue}
        onSearch={setSearchValue}
        onAdd={() => setShowAddDialog(true)}
        addButtonText="New Robot Model"
        addButtonIcon={<Plus className="h-4 w-4 mr-1.5 text-white" />}
        itemCount={filtered.length}
      />

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        onEdit={(model) => navigate(`/settings/demorobot/${model.id}/flows`)}
        onDelete={(model) => setDeleteTarget(model)}
      />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Robot Model</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="model-name">Name</Label>
              <Input id="model-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="RoboCut X200" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model-manufacturer">Manufacturer</Label>
              <Input id="model-manufacturer" value={newManufacturer} onChange={(e) => setNewManufacturer(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model-description">Description</Label>
              <Textarea id="model-description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Robot Model"
        description={`This will delete "${deleteTarget?.name}" and all its flows and assets. This cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  )
}

export default RobotModelsPage
