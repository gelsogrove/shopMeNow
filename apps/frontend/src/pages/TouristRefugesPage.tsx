import { PageLayout } from "@/components/layout/PageLayout"
import { logger } from "@/lib/logger"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { FormSheet } from "@/components/shared/FormSheet"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { TouristCardList } from "@/components/tourist/TouristCardList"
import { TouristRefugeFormFields } from "@/components/tourist/TouristRefugeFormFields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useWorkspace } from "@/hooks/use-workspace"
import { Home, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../lib/toast"
import { TouristRefuge, touristRefugeApi } from "@/services/touristRefugeApi"

export function TouristRefugesPage() {
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [refuges, setRefuges] = useState<TouristRefuge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TouristRefuge | null>(null)

  const ITEMS_PER_PAGE = 10

  const loadRefuges = async () => {
    if (!workspace?.id) return
    try {
      const data = await touristRefugeApi.getTouristRefuges(workspace.id)
      setRefuges(data)
    } catch (error) {
      logger.error("Error loading tourist refuges:", error)
      toast.error("Failed to load refuges")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoadingWorkspace) loadRefuges()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, isLoadingWorkspace])

  const totalPages = Math.ceil(refuges.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginated = refuges.slice(startIndex, endIndex)

  const readFormData = (form: HTMLFormElement) => {
    const formData = new FormData(form)
    return {
      name: String(formData.get("name") ?? ""),
      description: (formData.get("description") as string) || null,
      climbTime: (formData.get("climbTime") as string) || null,
      difficulty: (formData.get("difficulty") as string) || null,
      openFrom: (formData.get("openFrom") as string) || null,
      openTo: (formData.get("openTo") as string) || null,
      location: (formData.get("location") as string) || null,
      phone: (formData.get("phone") as string) || null,
      link: (formData.get("link") as string) || null,
      videoUrl: (formData.get("videoUrl") as string) || null,
      isActive: formData.get("isActive") === "on",
    }
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return
    const data = readFormData(e.target as HTMLFormElement)
    try {
      const created = await touristRefugeApi.createTouristRefuge(workspace.id, data)
      setRefuges([...refuges, created])
      setShowAddSheet(false)
      toast.success("Created successfully")
    } catch (error) {
      logger.error("Error creating tourist refuge:", error)
      toast.error("Failed to create")
    }
  }

  const handleEdit = (item: TouristRefuge) => {
    setSelectedItem(item)
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedItem || !workspace?.id) return
    const data = readFormData(e.target as HTMLFormElement)
    try {
      const updated = await touristRefugeApi.updateTouristRefuge(
        workspace.id,
        selectedItem.id,
        data
      )
      setRefuges(refuges.map((r) => (r.id === selectedItem.id ? updated : r)))
      setShowEditSheet(false)
      setSelectedItem(null)
      toast.success("Updated successfully")
    } catch (error) {
      logger.error("Error updating tourist refuge:", error)
      toast.error("Failed to update")
    }
  }

  const handleDelete = (item: TouristRefuge) => {
    setSelectedItem(item)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedItem || !workspace?.id) return
    try {
      await touristRefugeApi.deleteTouristRefuge(workspace.id, selectedItem.id)
      setRefuges(refuges.filter((r) => r.id !== selectedItem.id))
      setShowDeleteDialog(false)
      setSelectedItem(null)
      toast.success("Deleted successfully")
    } catch (error) {
      logger.error("Error deleting tourist refuge:", error)
      toast.error("Failed to delete")
    }
  }

  if (!workspace?.id) {
    return (
      <PageLayout>
        <div>No workspace selected</div>
      </PageLayout>
    )
  }
  if (isLoading) {
    return (
      <PageLayout>
        <div className="text-center py-12">Loading...</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        <SettingsPageHeader currentSection="tourist-refuges" />

        <Card>
          <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Home className="h-5 w-5 text-amber-500" />
                Rifugi
                <span className="text-sm font-normal text-gray-500">
                  ({refuges.length} items)
                </span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-end">
              <Button
                onClick={() => setShowAddSheet(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Refuge
              </Button>
            </div>
          </CardContent>
        </Card>

        <TouristCardList
          items={paginated}
          onEdit={handleEdit}
          onDelete={handleDelete}
          pagination={{
            currentPage,
            totalPages,
            startIndex,
            endIndex,
            totalCount: refuges.length,
            onPageChange: setCurrentPage,
          }}
          renderContent={(item) => (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.name}</h3>
              {item.description && (
                <p className="text-sm text-gray-700 mb-3 line-clamp-3 whitespace-pre-wrap">
                  {item.description}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {item.climbTime && <span>Tempo di salita: {item.climbTime}</span>}
                {item.difficulty && <span>{item.difficulty}</span>}
                {item.location && <span>{item.location}</span>}
              </div>
            </>
          )}
        />
      </div>

      <FormSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        title="Add Refuge"
        description="Add a new mountain refuge shown to customers by the chatbot."
        onSubmit={handleAdd}
      >
        <TouristRefugeFormFields item={null} workspaceId={workspace.id} />
      </FormSheet>

      <FormSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        title="Edit Refuge"
        description="Update this refuge's details."
        onSubmit={handleEditSubmit}
      >
        {selectedItem && (
          <TouristRefugeFormFields item={selectedItem} workspaceId={workspace.id} />
        )}
      </FormSheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Refuge"
        description={`Are you sure you want to delete "${selectedItem?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </PageLayout>
  )
}
