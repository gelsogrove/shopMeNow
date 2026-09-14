import { PageLayout } from "@/components/layout/PageLayout"
import { logger } from "@/lib/logger"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { LargeFormDialog } from "@/components/shared/LargeFormDialog"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { TouristCardList } from "@/components/tourist/TouristCardList"
import { TouristViewpointFormFields } from "@/components/tourist/TouristViewpointFormFields"
import { TouristThumb } from "@/components/tourist/TouristThumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useWorkspace } from "@/hooks/use-workspace"
import { ArrowLeft, MountainSnow, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "../lib/toast"
import { TouristViewpoint, touristViewpointApi } from "@/services/touristViewpointApi"

export function TouristViewpointsPage() {
  const navigate = useNavigate()
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [items, setItems] = useState<TouristViewpoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TouristViewpoint | null>(null)

  const ITEMS_PER_PAGE = 10

  const loadItems = async () => {
    if (!workspace?.id) return
    try {
      const data = await touristViewpointApi.getTouristViewpoints(workspace.id)
      setItems(data)
    } catch (error) {
      logger.error("Error loading tourist-viewpoints:", error)
      toast.error("Failed to load punti panoramici")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoadingWorkspace) loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, isLoadingWorkspace])

  // Deep-link from the Content hub search (?edit=<id>): once the list is
  // loaded, open that item's edit sheet and drop the param from the URL.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const editId = searchParams.get("edit")
    if (!editId || isLoading) return
    const item = items.find((f) => f.id === editId)
    if (item) {
      setSelectedItem(item)
      setShowEditSheet(true)
    }
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginated = items.slice(startIndex, endIndex)

  const readFormData = (form: HTMLFormElement) => {
    const formData = new FormData(form)
    return {
      name: String(formData.get("name") ?? ""),
      description: (formData.get("description") as string) || null,
      altitude: formData.get("altitude") ? Number(formData.get("altitude")) : null,
      access: (formData.get("access") as string) || null,
      difficulty: (formData.get("difficulty") as string) || null,
      location: (formData.get("location") as string) || null,
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
      const created = await touristViewpointApi.createTouristViewpoint(workspace.id, data)
      setItems([...items, created])
      setShowAddSheet(false)
      toast.success("Created successfully")
    } catch (error) {
      logger.error("Error creating tourist-viewpoints:", error)
      toast.error("Failed to create")
    }
  }

  const handleEdit = (item: TouristViewpoint) => {
    setSelectedItem(item)
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedItem || !workspace?.id) return
    const data = readFormData(e.target as HTMLFormElement)
    try {
      const updated = await touristViewpointApi.updateTouristViewpoint(
        workspace.id,
        selectedItem.id,
        data
      )
      setItems(items.map((f) => (f.id === selectedItem.id ? updated : f)))
      setShowEditSheet(false)
      setSelectedItem(null)
      toast.success("Updated successfully")
    } catch (error) {
      logger.error("Error updating tourist-viewpoints:", error)
      toast.error("Failed to update")
    }
  }

  const handleDelete = (item: TouristViewpoint) => {
    setSelectedItem(item)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedItem || !workspace?.id) return
    try {
      await touristViewpointApi.deleteTouristViewpoint(workspace.id, selectedItem.id)
      setItems(items.filter((f) => f.id !== selectedItem.id))
      setShowDeleteDialog(false)
      setSelectedItem(null)
      toast.success("Deleted successfully")
    } catch (error) {
      logger.error("Error deleting tourist-viewpoints:", error)
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
        <SettingsPageHeader currentSection="tourist-content" />

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/content")}
            className="text-green-700 hover:text-green-800 hover:bg-green-50"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Content
          </Button>
        </div>

        <Card>
          <CardHeader className="border-b bg-gradient-to-r from-cyan-50 to-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MountainSnow className="h-5 w-5 text-cyan-500" />
                Punti panoramici
                <span className="text-sm font-normal text-gray-500">
                  ({items.length} items)
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
                Add Viewpoint
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
            totalCount: items.length,
            onPageChange: setCurrentPage,
          }}
          renderThumb={(item) => (
            <TouristThumb
              workspaceId={workspace.id}
              contentType="VIEWPOINT"
              contentId={item.id}
            />
          )}
          renderContent={(item) => (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.name}</h3>
              {item.description && (
                <p className="text-sm text-gray-700 mb-3 line-clamp-3 whitespace-pre-wrap">
                  {item.description}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {item.altitude && <span>{item.altitude} m</span>}
                {item.access && <span>{item.access}</span>}
                {item.difficulty && <span>{item.difficulty}</span>}
                {item.location && <span>{item.location}</span>}
              </div>
            </>
          )}
        />
      </div>

      <LargeFormDialog
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        title="Add Viewpoint"
        description="Add a new entry shown to customers by the chatbot."
        onSubmit={handleAdd}
      >
        <TouristViewpointFormFields item={null} workspaceId={workspace.id} />
      </LargeFormDialog>

      <LargeFormDialog
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        title="Edit Viewpoint"
        description="Update this entry's details."
        onSubmit={handleEditSubmit}
      >
        {selectedItem && (
          <TouristViewpointFormFields item={selectedItem} workspaceId={workspace.id} />
        )}
      </LargeFormDialog>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Viewpoint"
        description={`Are you sure you want to delete "${selectedItem?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </PageLayout>
  )
}
