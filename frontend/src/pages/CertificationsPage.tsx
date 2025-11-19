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
import * as certificationsApi from "@/services/certificationsApi"
import { type Certification } from "@/services/certificationsApi"
import { Award } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../lib/toast"

export default function CertificationsPage() {
  const { workspace } = useWorkspace()
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedCertification, setSelectedCertification] = useState<Certification | null>(null)

  useEffect(() => {
    if (workspace?.id) {
      loadCertifications()
    }
  }, [workspace?.id])

  const loadCertifications = async () => {
    if (!workspace?.id) return

    try {
      setLoading(true)
      const response = await certificationsApi.getAllForWorkspace(workspace.id)
      setCertifications(response || [])
    } catch (error) {
      logger.error("Error loading certifications:", error)
      toast.error("Failed to load certifications")
    } finally {
      setLoading(false)
    }
  }

  const filteredCertifications = certifications.filter((cert) =>
    cert.name?.toLowerCase().includes(searchValue.toLowerCase())
  )

  const columns = [
    {
      header: "Certification Name",
      accessorKey: "name" as keyof Certification,
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
      toast.error("Certification name is required")
      return
    }

    try {
      await certificationsApi.create(workspace.id, { name: name.trim() })

      toast.success("Certification added successfully")
      setShowAddSheet(false)
      form.reset()
      await loadCertifications()
    } catch (error: any) {
      logger.error("Error adding certification:", error)
      const message = error.response?.data?.error || "Failed to add certification"
      toast.error(message)
    }
  }

  const handleEdit = (certification: Certification) => {
    setSelectedCertification(certification)
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedCertification?.id || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const name = formData.get("name") as string

    if (!name || !name.trim()) {
      toast.error("Certification name is required")
      return
    }

    try {
      await certificationsApi.update(selectedCertification.id, workspace.id, {
        name: name.trim(),
      })

      toast.success("Certification updated successfully")
      setShowEditSheet(false)
      setSelectedCertification(null)
      await loadCertifications()
    } catch (error: any) {
      logger.error("Error updating certification:", error)
      const message = error.response?.data?.error || "Failed to update certification"
      toast.error(message)
    }
  }

  const handleDelete = async (certification: Certification) => {
    setSelectedCertification(certification)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!selectedCertification?.id || !workspace?.id) return

    try {
      await certificationsApi.remove(workspace.id, selectedCertification.id)
      toast.success("Certification deleted successfully")
      setShowDeleteDialog(false)
      setSelectedCertification(null)
      await loadCertifications()
    } catch (error: any) {
      logger.error("Error deleting certification:", error)
      const message = error.response?.data?.error || "Failed to delete certification"
      toast.error(message)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="container pl-0 pr-4 pt-4 pb-4">
      <div className="grid grid-cols-12 gap-0">
        <div className="col-span-11 col-start-1">
          <PageHeader
            title="Certifications"
            titleIcon={<Award className="mr-2 h-6 w-6 text-primary" />}
            searchValue={searchValue}
            onSearch={setSearchValue}
            searchPlaceholder="Search certifications..."
            itemCount={filteredCertifications.length}
            onAdd={() => setShowAddSheet(true)}
            addButtonText="Add Certification"
          />

          <div className="mt-6 w-full">
            <DataTable
              columns={columns}
              data={filteredCertifications}
              onEdit={handleEdit}
              onDelete={handleDelete}
              globalFilter={searchValue}
              canDelete={(row) => {
                const cert = row as Certification
                return !cert._count?.productCertifications || cert._count.productCertifications === 0
              }}
            />
          </div>
        </div>
      </div>

      {/* Add Certification Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="right" className="w-[25%]">
          <SheetHeader>
            <SheetTitle>Add Certification</SheetTitle>
            <SheetDescription>
              Create a new product certification
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAdd} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="name">Certification Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Bio, DOP, Vegan"
                required
                maxLength={50}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                Add Certification
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddSheet(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit Certification Sheet */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent side="right" className="w-[25%]">
          <SheetHeader>
            <SheetTitle>Edit Certification</SheetTitle>
            <SheetDescription>
              Update certification information
            </SheetDescription>
          </SheetHeader>
          {selectedCertification && (
            <form onSubmit={handleEditSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Certification Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={selectedCertification.name}
                  placeholder="e.g., Bio, DOP, Vegan"
                  required
                  maxLength={50}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  Update Certification
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditSheet(false)
                    setSelectedCertification(null)
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
        title="Delete Certification"
        description={
          selectedCertification
            ? `Are you sure you want to delete "${selectedCertification.name}"? ${
                selectedCertification._count?.productCertifications
                  ? `This certification is used by ${selectedCertification._count.productCertifications} product(s) and cannot be deleted.`
                  : "This action cannot be undone."
              }`
            : ""
        }
      />
    </div>
  )
}
