import { PageLayout } from "@/components/layout/PageLayout"
import { logger } from "@/lib/logger"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { FormSheet } from "@/components/shared/FormSheet"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { TouristCardList } from "@/components/tourist/TouristCardList"
import { TouristHotelFormFields } from "@/components/tourist/TouristHotelFormFields"
import { TouristThumb } from "@/components/tourist/TouristThumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useWorkspace } from "@/hooks/use-workspace"
import { ArrowLeft, Building2, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "../lib/toast"
import { TouristHotel, touristHotelApi } from "@/services/touristHotelApi"

export function TouristHotelsPage() {
  const navigate = useNavigate()
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [hotels, setHotels] = useState<TouristHotel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TouristHotel | null>(null)

  const ITEMS_PER_PAGE = 10

  const loadHotels = async () => {
    if (!workspace?.id) return
    try {
      const data = await touristHotelApi.getTouristHotels(workspace.id)
      setHotels(data)
    } catch (error) {
      logger.error("Error loading tourist hotels:", error)
      toast.error("Failed to load hotels")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoadingWorkspace) loadHotels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, isLoadingWorkspace])

  const totalPages = Math.ceil(hotels.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginated = hotels.slice(startIndex, endIndex)

  const readFormData = (form: HTMLFormElement) => {
    const formData = new FormData(form)
    const starsRaw = formData.get("stars") as string
    return {
      name: String(formData.get("name") ?? ""),
      description: (formData.get("description") as string) || null,
      stars: starsRaw ? Number(starsRaw) : null,
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
      const created = await touristHotelApi.createTouristHotel(workspace.id, data)
      setHotels([...hotels, created])
      setShowAddSheet(false)
      toast.success("Created successfully")
    } catch (error) {
      logger.error("Error creating tourist hotel:", error)
      toast.error("Failed to create")
    }
  }

  const handleEdit = (item: TouristHotel) => {
    setSelectedItem(item)
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedItem || !workspace?.id) return
    const data = readFormData(e.target as HTMLFormElement)
    try {
      const updated = await touristHotelApi.updateTouristHotel(
        workspace.id,
        selectedItem.id,
        data
      )
      setHotels(hotels.map((h) => (h.id === selectedItem.id ? updated : h)))
      setShowEditSheet(false)
      setSelectedItem(null)
      toast.success("Updated successfully")
    } catch (error) {
      logger.error("Error updating tourist hotel:", error)
      toast.error("Failed to update")
    }
  }

  const handleDelete = (item: TouristHotel) => {
    setSelectedItem(item)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedItem || !workspace?.id) return
    try {
      await touristHotelApi.deleteTouristHotel(workspace.id, selectedItem.id)
      setHotels(hotels.filter((h) => h.id !== selectedItem.id))
      setShowDeleteDialog(false)
      setSelectedItem(null)
      toast.success("Deleted successfully")
    } catch (error) {
      logger.error("Error deleting tourist hotel:", error)
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
          <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-500" />
                Alberghi
                <span className="text-sm font-normal text-gray-500">
                  ({hotels.length} items)
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
                Add Hotel
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
            totalCount: hotels.length,
            onPageChange: setCurrentPage,
          }}
          renderThumb={(item) => (
            <TouristThumb
              workspaceId={workspace.id}
              contentType="HOTEL"
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
                {item.stars != null && <span>{item.stars} stars</span>}
                {item.location && <span>{item.location}</span>}
              </div>
            </>
          )}
        />
      </div>

      <FormSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        title="Add Hotel"
        description="Add a new hotel shown to customers by the chatbot."
        onSubmit={handleAdd}
      >
        <TouristHotelFormFields item={null} workspaceId={workspace.id} />
      </FormSheet>

      <FormSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        title="Edit Hotel"
        description="Update this hotel's details."
        onSubmit={handleEditSubmit}
      >
        {selectedItem && (
          <TouristHotelFormFields item={selectedItem} workspaceId={workspace.id} />
        )}
      </FormSheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Hotel"
        description={`Are you sure you want to delete "${selectedItem?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </PageLayout>
  )
}
