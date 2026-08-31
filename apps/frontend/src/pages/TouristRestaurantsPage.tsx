import { PageLayout } from "@/components/layout/PageLayout"
import { logger } from "@/lib/logger"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { FormSheet } from "@/components/shared/FormSheet"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { TouristCardList } from "@/components/tourist/TouristCardList"
import { TouristRestaurantFormFields } from "@/components/tourist/TouristRestaurantFormFields"
import { TouristThumb } from "@/components/tourist/TouristThumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useWorkspace } from "@/hooks/use-workspace"
import { ArrowLeft, Plus, Utensils } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "../lib/toast"
import {
  TouristRestaurant,
  touristRestaurantApi,
} from "@/services/touristRestaurantApi"

export function TouristRestaurantsPage() {
  const navigate = useNavigate()
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [restaurants, setRestaurants] = useState<TouristRestaurant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TouristRestaurant | null>(null)

  const ITEMS_PER_PAGE = 10

  const loadRestaurants = async () => {
    if (!workspace?.id) return
    try {
      const data = await touristRestaurantApi.getTouristRestaurants(workspace.id)
      setRestaurants(data)
    } catch (error) {
      logger.error("Error loading tourist restaurants:", error)
      toast.error("Failed to load restaurants")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoadingWorkspace) loadRestaurants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, isLoadingWorkspace])

  const totalPages = Math.ceil(restaurants.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginated = restaurants.slice(startIndex, endIndex)

  const readFormData = (form: HTMLFormElement) => {
    const formData = new FormData(form)
    return {
      name: String(formData.get("name") ?? ""),
      description: (formData.get("description") as string) || null,
      cuisineType: (formData.get("cuisineType") as string) || null,
      celiacFriendly: formData.get("celiacFriendly") === "on",
      needsReservation: formData.get("needsReservation") === "on",
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
      const created = await touristRestaurantApi.createTouristRestaurant(
        workspace.id,
        data
      )
      setRestaurants([...restaurants, created])
      setShowAddSheet(false)
      toast.success("Created successfully")
    } catch (error) {
      logger.error("Error creating tourist restaurant:", error)
      toast.error("Failed to create")
    }
  }

  const handleEdit = (item: TouristRestaurant) => {
    setSelectedItem(item)
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedItem || !workspace?.id) return
    const data = readFormData(e.target as HTMLFormElement)
    try {
      const updated = await touristRestaurantApi.updateTouristRestaurant(
        workspace.id,
        selectedItem.id,
        data
      )
      setRestaurants(restaurants.map((r) => (r.id === selectedItem.id ? updated : r)))
      setShowEditSheet(false)
      setSelectedItem(null)
      toast.success("Updated successfully")
    } catch (error) {
      logger.error("Error updating tourist restaurant:", error)
      toast.error("Failed to update")
    }
  }

  const handleDelete = (item: TouristRestaurant) => {
    setSelectedItem(item)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedItem || !workspace?.id) return
    try {
      await touristRestaurantApi.deleteTouristRestaurant(workspace.id, selectedItem.id)
      setRestaurants(restaurants.filter((r) => r.id !== selectedItem.id))
      setShowDeleteDialog(false)
      setSelectedItem(null)
      toast.success("Deleted successfully")
    } catch (error) {
      logger.error("Error deleting tourist restaurant:", error)
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
                <Utensils className="h-5 w-5 text-amber-500" />
                Ristoranti
                <span className="text-sm font-normal text-gray-500">
                  ({restaurants.length} items)
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
                Add Restaurant
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
            totalCount: restaurants.length,
            onPageChange: setCurrentPage,
          }}
          renderThumb={(item) => (
            <TouristThumb
              workspaceId={workspace.id}
              contentType="RESTAURANT"
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
                {item.cuisineType && <span>{item.cuisineType}</span>}
                {item.location && <span>{item.location}</span>}
                {item.celiacFriendly && <span>Celiac friendly</span>}
                {item.needsReservation && <span>Needs reservation</span>}
              </div>
            </>
          )}
        />
      </div>

      <FormSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        title="Add Restaurant"
        description="Add a new restaurant shown to customers by the chatbot."
        onSubmit={handleAdd}
      >
        <TouristRestaurantFormFields item={null} workspaceId={workspace.id} />
      </FormSheet>

      <FormSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        title="Edit Restaurant"
        description="Update this restaurant's details."
        onSubmit={handleEditSubmit}
      >
        {selectedItem && (
          <TouristRestaurantFormFields item={selectedItem} workspaceId={workspace.id} />
        )}
      </FormSheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Restaurant"
        description={`Are you sure you want to delete "${selectedItem?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </PageLayout>
  )
}
