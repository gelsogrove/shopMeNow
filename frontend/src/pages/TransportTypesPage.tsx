import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import * as transportTypesApi from "@/services/transportTypesApi"
import { type TransportType } from "@/services/transportTypesApi"
import { Truck } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../lib/toast"

export default function TransportTypesPage() {
  const { workspace } = useWorkspace()
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedTransportType, setSelectedTransportType] = useState<TransportType | null>(null)

  useEffect(() => {
    if (workspace?.id) {
      loadTransportTypes()
    }
  }, [workspace?.id])

  const loadTransportTypes = async () => {
    if (!workspace?.id) return

    try {
      setLoading(true)
      const response = await transportTypesApi.getAllForWorkspace(workspace.id)
      setTransportTypes(response || [])
    } catch (error) {
      logger.error("Error loading transport types:", error)
      toast.error("Failed to load transport types")
    } finally {
      setLoading(false)
    }
  }

  const filteredTransportTypes = transportTypes.filter((type) =>
    type.name?.toLowerCase().includes(searchValue.toLowerCase())
  )

  const columns = [
    {
      header: "Transport Type Name",
      accessorKey: "name" as keyof TransportType,
      size: 300,
    },
  ]

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const name = formData.get("name") as string

    if (!name || !name.trim()) {
      toast.error("Transport type name is required")
      return
    }

    try {
      await transportTypesApi.create(workspace.id, { name: name.trim() })

      toast.success("Transport type added successfully")
      form.reset()
      await loadTransportTypes()
    } catch (error: any) {
      logger.error("Error adding transport type:", error)
      const message = error.message || "Failed to add transport type"
      toast.error(message)
    }
  }

  const handleEdit = (transportType: TransportType) => {
    setSelectedTransportType(transportType)
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedTransportType?.id || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const name = formData.get("name") as string

    if (!name || !name.trim()) {
      toast.error("Transport type name is required")
      return
    }

    try {
      await transportTypesApi.update(workspace.id, selectedTransportType.id, {
        name: name.trim(),
      })

      toast.success("Transport type updated successfully")
      setShowEditSheet(false)
      setSelectedTransportType(null)
      await loadTransportTypes()
    } catch (error: any) {
      logger.error("Error updating transport type:", error)
      const message = error.message || "Failed to update transport type"
      toast.error(message)
    }
  }

  const handleDelete = async (transportType: TransportType) => {
    setSelectedTransportType(transportType)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!selectedTransportType?.id || !workspace?.id) return

    try {
      await transportTypesApi.remove(workspace.id, selectedTransportType.id)
      toast.success("Transport type deleted successfully")
      setShowDeleteDialog(false)
      setSelectedTransportType(null)
      await loadTransportTypes()
    } catch (error: any) {
      logger.error("Error deleting transport type:", error)
      const message = error.message || "Failed to delete transport type"
      toast.error(message)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="container pl-0 pr-4 pt-4 pb-4">
      <div className="grid grid-cols-12 gap-4">
        {/* List Section */}
        <div className="col-span-8">
          <PageHeader
            title="Transport Types"
            titleIcon={<Truck className="mr-2 h-6 w-6 text-primary" />}
            searchValue={searchValue}
            onSearch={setSearchValue}
            searchPlaceholder="Search transport types..."
            itemCount={filteredTransportTypes.length}
          />

          <div className="mt-6 w-full">
            <DataTable
              columns={columns}
              data={filteredTransportTypes}
              onEdit={handleEdit}
              onDelete={handleDelete}
              globalFilter={searchValue}
              canDelete={(row) => {
                const type = row as TransportType
                return !type._count?.productTransportTypes || type._count.productTransportTypes === 0
              }}
            />
          </div>
        </div>

        {/* Add Form Panel - Always Visible */}
        <div className="col-span-4">
          <div className="sticky top-4">
            <div className="border rounded-lg p-6 bg-white shadow-sm">
              <h2 className="text-lg font-semibold mb-2">Add Transport Type</h2>
              <p className="text-sm text-gray-500 mb-6">
                Create a new transport type for products
              </p>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Transport Type Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., Air, Sea, Land, Rail"
                    required
                    maxLength={50}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Add Transport Type
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Transport Type Sheet - Slides over the list */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent side="right" className="w-[600px]">
          <SheetHeader>
            <SheetTitle>Edit Transport Type</SheetTitle>
            <SheetDescription>
              Update transport type information
            </SheetDescription>
          </SheetHeader>
          {selectedTransportType && (
            <form onSubmit={handleEditSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Transport Type Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={selectedTransportType.name}
                  placeholder="e.g., Air, Sea, Land, Rail"
                  required
                  maxLength={50}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  Update Transport Type
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditSheet(false)
                    setSelectedTransportType(null)
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDelete}
        title="Delete Transport Type"
        description={
          selectedTransportType
            ? `Are you sure you want to delete "${selectedTransportType.name}"? ${
                selectedTransportType._count?.productTransportTypes
                  ? `This transport type is used by ${selectedTransportType._count.productTransportTypes} product(s) and cannot be deleted.`
                  : "This action cannot be undone."
              }`
            : ""
        }
      />
    </div>
  )
}
