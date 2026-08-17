import { useState } from "react"
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
import { ChevronRight, FolderOpen } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

// FAQ categories are free-text strings on the FAQ rows (no dedicated table),
// so a "category" here is derived data: it exists as long as at least one FAQ
// carries its name. This component only renders them as folders — the same
// look as the Flow categories page — while create/rename/delete semantics
// stay with the parent, which owns the FAQ records.

export interface FaqCategoryRow {
  /** Category name, or the parent's sentinel for the synthetic row. */
  id: string
  name: string
  count: number
  /** The synthetic "Uncategorized" row cannot be renamed or deleted. */
  isSynthetic: boolean
}

interface FaqCategoryFoldersProps {
  rows: FaqCategoryRow[]
  isLoading: boolean
  onOpen: (row: FaqCategoryRow) => void
  /** Rename the category across every FAQ inside it. */
  onRename: (row: FaqCategoryRow, newName: string) => Promise<void>
  /** Delete the category AND every FAQ inside it (mirrors Flow's semantics). */
  onDelete: (row: FaqCategoryRow) => Promise<void>
}

export function FaqCategoryFolders({
  rows,
  isLoading,
  onOpen,
  onRename,
  onDelete,
}: FaqCategoryFoldersProps) {
  const [editTarget, setEditTarget] = useState<FaqCategoryRow | null>(null)
  const [editName, setEditName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FaqCategoryRow | null>(null)

  // The category name doubles as the "enter this category" affordance: green,
  // underlined on hover, with a chevron — same as FlowCategoriesPage.
  const columns: ColumnDef<FaqCategoryRow>[] = [
    {
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 font-medium text-green-700 group-hover:underline">
          <FolderOpen className="h-4 w-4 text-green-600" />
          {row.original.name}
          <ChevronRight className="h-4 w-4 text-green-600" />
          <span className="text-xs font-normal text-gray-500">
            ({row.original.count} FAQs)
          </span>
        </span>
      ),
    },
  ]

  const handleRename = async () => {
    if (!editTarget || !editName.trim()) return
    setIsSaving(true)
    try {
      await onRename(editTarget, editName.trim())
      setEditTarget(null)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        disablePagination
        onRowClick={onOpen}
        onEdit={(row) => {
          if (row.isSynthetic) return
          setEditTarget(row)
          setEditName(row.name)
        }}
        onDelete={(row) => {
          if (row.isSynthetic) return
          setDeleteTarget(row)
        }}
        canDelete={(row) => !row.isSynthetic}
        actionButtons={(row) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-800"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(row)
            }}
            title="Open the FAQs inside this category"
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        )}
      />

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="faq-category-name">Name</Label>
            <Input
              id="faq-category-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Every FAQ in this category will be updated with the new name.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isSaving || !editName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Category"
        description={`This will delete "${deleteTarget?.name}" and all ${deleteTarget?.count} FAQs inside it. This cannot be undone.`}
        onConfirm={async () => {
          if (!deleteTarget) return
          await onDelete(deleteTarget)
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
