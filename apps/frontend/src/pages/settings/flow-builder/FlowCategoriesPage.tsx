import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/shared/DataTable"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { updateWorkspace } from "@/services/workspaceApi"
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
import { Bot, ChevronRight, FolderOpen, Plus } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { toast } from "@/lib/toast"
import { flowCategoryApi, FlowCategory } from "@/services/flowBuilderApi"
import { ChatWidget } from "@/components/ChatWidget"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"

// Flows with flowCategoryId = null (e.g. the protected "Human operator
// flow" every escalation path converges on — Andrea's CONTRACT.md: editable,
// never deletable) have no real FlowCategory row, so they never appeared as
// a folder here — the /settings/demorobot/generic/flows route already
// supported them, nothing ever linked to it. This synthetic row is not a
// real category: no edit/delete, just an entry point to that route.
const UNCATEGORIZED_ID = "generic"

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
  // Master switch, persisted on the workspace. Saved immediately on toggle —
  // this page has no Save button.
  const [flowsEnabled, setFlowsEnabled] = useState(true)
  const [isTogglingFlows, setIsTogglingFlows] = useState(false)

  useEffect(() => {
    if (workspace) setFlowsEnabled((workspace as any).flowsEnabled ?? true)
  }, [workspace])

  const handleToggleFlowsEnabled = async (enabled: boolean) => {
    if (!workspaceId) return
    // Optimistic: the switch responds instantly, and rolls back if the save fails.
    setFlowsEnabled(enabled)
    setIsTogglingFlows(true)
    try {
      await updateWorkspace(workspaceId, { flowsEnabled: enabled } as any)
      toast.success(enabled ? "Flows enabled" : "Flows disabled")
    } catch (err: any) {
      setFlowsEnabled(!enabled)
      toast.error(err.message || "Could not save the change")
    } finally {
      setIsTogglingFlows(false)
    }
  }
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

  const uncategorizedRow: FlowCategory = {
    id: UNCATEGORIZED_ID,
    workspaceId,
    name: "Uncategorized",
    slug: UNCATEGORIZED_ID,
    description: "Flows not tied to a product category — includes the protected Human operator flow.",
    lookupRules: {},
    createdAt: "",
    updatedAt: "",
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

  // The category name doubles as the "enter this category" affordance: green,
  // underlined on hover, with a chevron — so it reads as a link, not plain text.
  const columns: ColumnDef<FlowCategory>[] = [
    {
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 font-medium text-green-700 group-hover:underline">
          <FolderOpen className="h-4 w-4 text-green-600" />
          {row.original.name}
          <ChevronRight className="h-4 w-4 text-green-600" />
        </span>
      ),
    },
  ]

  const filtered = categories.filter((c) =>
    `${c.name} ${c.slug}`.toLowerCase().includes(searchValue.toLowerCase()),
  )

  return (
    <div className="p-6 space-y-6">
      {/* Same "Settings" title + section dropdown as SettingsPage, so
          navigating here still reads as being inside Settings. */}
      <SettingsPageHeader currentSection="demorobot" />

      {/* Master switch — same card pattern as FAQ and the Settings sections.
          Everything the section owns (search, New Category, the list) lives
          under it and disappears when it is off, so a disabled section offers
          no actions. Nothing is deleted: switching back on restores it all. */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-600" />
              Flows
              <span className="text-sm font-normal text-gray-500">
                ({filtered.length} categories)
              </span>
            </CardTitle>
            <Switch
              checked={flowsEnabled}
              onCheckedChange={handleToggleFlowsEnabled}
              disabled={isTogglingFlows}
            />
          </div>
          <p className="text-sm text-gray-500">
            {flowsEnabled
              ? "Guided question/answer trees the chatbot follows for known problems."
              : "Disabled — the chatbot answers without using any flow. Nothing is deleted."}
          </p>
        </CardHeader>
        {flowsEnabled && (
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search categories..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="max-w-md"
              />
              <Button onClick={() => setShowAddDialog(true)} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-1.5" />
                New Category
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {flowsEnabled && (
      <DataTable
        data={[...filtered, uncategorizedRow]}
        columns={columns}
        isLoading={isLoading}
        disablePagination
        onRowClick={(category) => navigate(`/settings/demorobot/${category.id}/flows`)}
        onEdit={(category) => {
          if (category.id === UNCATEGORIZED_ID) return
          setEditTarget(category)
          setEditName(category.name)
          setEditDescription(category.description || "")
        }}
        onDelete={(category) => {
          if (category.id === UNCATEGORIZED_ID) return
          setDeleteTarget(category)
        }}
        canDelete={(category) => category.id !== UNCATEGORIZED_ID}
        actionButtons={(category) => (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/settings/demorobot/${category.id}/flows`)
            }}
            title="Open the flows inside this category"
          >
            <FolderOpen className="h-4 w-4" />
            Open flows
          </Button>
        )}
      />
      )}

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
