import { PageLayout } from "@/components/layout/PageLayout"
import { logger } from "@/lib/logger"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { FormSheet } from "@/components/shared/FormSheet"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { TouristCardList } from "@/components/tourist/TouristCardList"
import { TouristApartmentFormFields } from "@/components/tourist/TouristApartmentFormFields"
import { TouristThumb } from "@/components/tourist/TouristThumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useWorkspace } from "@/hooks/use-workspace"
import { ArrowLeft, KeyRound, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "../lib/toast"
import { TouristApartment, touristApartmentApi } from "@/services/touristApartmentApi"

export function TouristApartmentsPage() {
  const navigate = useNavigate()
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [apartments, setApartments] = useState<TouristApartment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TouristApartment | null>(null)

  const ITEMS_PER_PAGE = 10

  const loadApartments = async () => {
    if (!workspace?.id) return
    try {
      const data = await touristApartmentApi.getTouristApartments(workspace.id)
      setApartments(data)
    } catch (error) {
      logger.error("Error loading tourist apartments:", error)
      toast.error("Failed to load apartments")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoadingWorkspace) loadApartments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, isLoadingWorkspace])

  const totalPages = Math.ceil(apartments.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginated = apartments.slice(startIndex, endIndex)

  // Numeric inputs come back as strings from FormData; empty = null so a
  // cleared field clears the DB column instead of writing 0.
  const readNumber = (formData: FormData, key: string): number | null => {
    const raw = (formData.get(key) as string) || ""
    if (raw.trim() === "") return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  const readFormData = (form: HTMLFormElement) => {
    const formData = new FormData(form)
    return {
      name: String(formData.get("name") ?? ""),
      description: (formData.get("description") as string) || null,
      category: (formData.get("category") as string) || null,
      location: (formData.get("location") as string) || null,
      streetNumber: (formData.get("streetNumber") as string) || null,
      phone: (formData.get("phone") as string) || null,
      mobile: (formData.get("mobile") as string) || null,
      email: (formData.get("email") as string) || null,
      rooms: readNumber(formData, "rooms"),
      beds: readNumber(formData, "beds"),
      bathrooms: readNumber(formData, "bathrooms"),
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
      const created = await touristApartmentApi.createTouristApartment(workspace.id, data)
      setApartments([...apartments, created])
      setShowAddSheet(false)
      toast.success("Created successfully")
    } catch (error) {
      logger.error("Error creating tourist apartment:", error)
      toast.error("Failed to create")
    }
  }

  const handleEdit = (item: TouristApartment) => {
    setSelectedItem(item)
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedItem || !workspace?.id) return
    const data = readFormData(e.target as HTMLFormElement)
    try {
      const updated = await touristApartmentApi.updateTouristApartment(
        workspace.id,
        selectedItem.id,
        data
      )
      setApartments(apartments.map((a) => (a.id === selectedItem.id ? updated : a)))
      setShowEditSheet(false)
      setSelectedItem(null)
      toast.success("Updated successfully")
    } catch (error) {
      logger.error("Error updating tourist apartment:", error)
      toast.error("Failed to update")
    }
  }

  const handleDelete = (item: TouristApartment) => {
    setSelectedItem(item)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedItem || !workspace?.id) return
    try {
      await touristApartmentApi.deleteTouristApartment(workspace.id, selectedItem.id)
      setApartments(apartments.filter((a) => a.id !== selectedItem.id))
      setShowDeleteDialog(false)
      setSelectedItem(null)
      toast.success("Deleted successfully")
    } catch (error) {
      logger.error("Error deleting tourist apartment:", error)
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
          <CardHeader className="border-b bg-gradient-to-r from-teal-50 to-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-teal-500" />
                Case e appartamenti
                <span className="text-sm font-normal text-gray-500">
                  ({apartments.length} items)
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
                Add Apartment
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
            totalCount: apartments.length,
            onPageChange: setCurrentPage,
          }}
          renderThumb={(item) => (
            <TouristThumb
              workspaceId={workspace.id}
              contentType="APARTMENT"
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
                {item.category && <span>{item.category}</span>}
                {item.location && <span>{item.location}</span>}
                {item.rooms != null && <span>Rooms: {item.rooms}</span>}
                {item.beds != null && <span>Beds: {item.beds}</span>}
                {item.email && <span>{item.email}</span>}
              </div>
            </>
          )}
        />
      </div>

      <FormSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        title="Add Apartment"
        description="Add a new vacation house/apartment shown to customers by the chatbot."
        onSubmit={handleAdd}
      >
        <TouristApartmentFormFields item={null} workspaceId={workspace.id} />
      </FormSheet>

      <FormSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        title="Edit Apartment"
        description="Update this apartment's details."
        onSubmit={handleEditSubmit}
      >
        {selectedItem && (
          <TouristApartmentFormFields item={selectedItem} workspaceId={workspace.id} />
        )}
      </FormSheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Apartment"
        description={`Are you sure you want to delete "${selectedItem?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </PageLayout>
  )
}
