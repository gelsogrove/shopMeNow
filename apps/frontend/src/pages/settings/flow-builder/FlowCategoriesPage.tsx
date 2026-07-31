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
import { ArrowRight, Bot, Plus } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { toast } from "@/lib/toast"
import { flowCategoryApi, FlowCategory } from "@/services/flowBuilderApi"
import { ChatWidget } from "@/components/ChatWidget"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function FlowCategoriesPage() {
  const { workspace } = useWorkspace()
  const navigate = useNavigate()
  const workspaceId = workspace?.id || ""

  const [categories, setCategories] = useState<FlowCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<FlowCategory | null>(null)
  const [editTarget, setEditTarget] = useState<FlowCategory | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")

  useEffect(() => {
    if (!workspaceId) return
    setIsLoading(true)
    flowCategoryApi
      .list(workspaceId)
      .then(setCategories)
      .catch((err) => toast.error(err.message || "Failed to load categories"))
      .finally(() => setIsLoading(false))
  }, [workspaceId])

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Name is required")
      return
    }
    try {
      const created = await flowCategoryApi.create(workspaceId, {
        name: newName.trim(),
        slug: slugify(newName),
        description: newDescription.trim() || undefined,
      })
      setCategories((prev) => [...prev, created])
      setShowAddDialog(false)
      setNewName("")
      setNewDescription("")
      toast.success("Category created")
    } catch (err: any) {
      toast.error(err.message || "Failed to create category")
    }
  }

  const handleEdit = async () => {
    if (!editTarget) return
    if (!editName.trim()) {
      toast.error("Name is required")
      return
    }
    try {
      const updated = await flowCategoryApi.update(workspaceId, editTarget.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      })
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setEditTarget(null)
      toast.success("Category updated")
    } catch (err: any) {
      toast.error(err.message || "Failed to update category")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await flowCategoryApi.delete(workspaceId, deleteTarget.id)
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      toast.success("Category deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete category")
    } finally {
      setDeleteTarget(null)
    }
  }

  const columns: ColumnDef<FlowCategory>[] = [
    { header: "Name", accessorKey: "name" },
  ]

  const filtered = categories.filter((c) =>
    `${c.name} ${c.slug}`.toLowerCase().includes(searchValue.toLowerCase()),
  )

  return (
    <div className="p-6 space-y-6">
      {/* Same "Settings" title + section dropdown as SettingsPage, so
          navigating here still reads as being inside Settings. */}
      <SettingsPageHeader currentSection="demorobot" />

      <PageHeader
        title="Categories"
        titleIcon={<Bot className="h-6 w-6" />}
        description="Group this workspace's flows into categories."
        searchValue={searchValue}
        onSearch={setSearchValue}
        onAdd={() => setShowAddDialog(true)}
        addButtonText="New Category"
        addButtonIcon={<Plus className="h-4 w-4 mr-1.5 text-white" />}
        itemCount={filtered.length}
      />

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        onEdit={(category) => {
          setEditTarget(category)
          setEditName(category.name)
          setEditDescription(category.description || "")
        }}
        onDelete={(category) => setDeleteTarget(category)}
        actionButtons={(category) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={() => navigate(`/settings/demorobot/${category.id}/flows`)}
            title="Open flows"
          >
            <ArrowRight className="h-4 w-4 text-gray-500" />
          </Button>
        )}
      />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="category-name">Name</Label>
              <Input id="category-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description">Description</Label>
              <Textarea id="category-description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
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

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">Name</Label>
              <Input id="edit-category-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category-description">Description</Label>
              <Textarea id="edit-category-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Category"
        description={`This will delete "${deleteTarget?.name}" and all its flows and assets. This cannot be undone.`}
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

export default FlowCategoriesPage
