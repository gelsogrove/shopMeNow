import { PageLayout } from "@/components/layout/PageLayout"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { FormSheet } from "@/components/shared/FormSheet"
import { MultiImageCropUpload } from "@/components/shared/MultiImageCropUpload"
import { ProductImage } from "@/components/shared/ProductImage"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { Service, servicesApi } from "@/services/servicesApi"
import { commonStyles } from "@/styles/common"
import { getCurrencySymbol } from "@/utils/format"
import { Pencil, Trash2, Wrench } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../lib/toast"

export function ServicesPage() {
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([])
  const [reorderedImageUrls, setReorderedImageUrls] = useState<string[] | null>(
    null
  )

  const loadServices = async () => {
    if (!workspace?.id) return
    try {
      const data = await servicesApi.getServices(workspace.id)
      setServices(data)
    } catch (error) {
      logger.error("Error loading services:", error)
      toast.error("Failed to load services")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoadingWorkspace) {
      loadServices()
    }
  }, [workspace?.id, isLoadingWorkspace])

  const filteredServices = services.filter((service) =>
    Object.values(service).some((value) =>
      value.toString().toLowerCase().includes(searchValue.toLowerCase())
    )
  )

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Force isActive = false for new services (will be activated later during edit)
    formData.set("isActive", "false")

    try {
      const newService = await servicesApi.createService(workspace.id, formData)
      setServices([newService, ...services])
      setShowAddSheet(false)
      toast.success(
        "Service created successfully. Edit it to add details and images."
      )
    } catch (error: any) {
      logger.error("Error creating service:", error)
      const errorMessage =
        error.response?.data?.message || "Failed to create service"
      toast.error(errorMessage)
    }
  }

  const handleEdit = (service: Service) => {
    setSelectedService(service)
    setCurrentImageUrls(service.imageUrl || [])
    setImageFiles([])
    setReorderedImageUrls(null)
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedService || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Add multiple image files if selected
    if (imageFiles.length > 0) {
      imageFiles.forEach((file) => {
        formData.append("images", file)
      })
    }

    // Always send existing image URLs (even if empty array) to handle deletions
    // Use reorderedImageUrls if it has been modified (not null), otherwise use currentImageUrls
    const imagesToSend =
      reorderedImageUrls !== null ? reorderedImageUrls : currentImageUrls

    formData.append("existingImageUrls", JSON.stringify(imagesToSend))

    try {
      const updatedService = await servicesApi.updateService(
        workspace.id,
        selectedService.id,
        formData
      )
      setServices(
        services.map((s) => (s.id === selectedService.id ? updatedService : s))
      )
      setShowEditSheet(false)
      setSelectedService(null)
      setImageFiles([])
      setCurrentImageUrls([])
      setReorderedImageUrls(null)
      toast.success("Service updated successfully")
    } catch (error) {
      logger.error("Error updating service:", error)
      toast.error("Failed to update service")
    }
  }

  const handleDelete = (service: Service) => {
    setSelectedService(service)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedService || !workspace?.id) return

    try {
      await servicesApi.deleteService(workspace.id, selectedService.id)
      setServices(services.filter((s) => s.id !== selectedService.id))
      setShowDeleteDialog(false)
      setSelectedService(null)
      toast.success("Service deleted successfully")
    } catch (error) {
      logger.error("Error deleting service:", error)
      toast.error("Failed to delete service")
    }
  }

  if (isLoadingWorkspace || isLoading) {
    return <div>Loading...</div>
  }

  if (!workspace?.id) {
    return <div>No workspace selected</div>
  }

  const currencySymbol = getCurrencySymbol(workspace?.currency)

  // Simplified form for creating new services (only name field)
  const renderCreateForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Service Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Enter service name"
          required
          autoFocus
        />
        <p className="text-xs text-gray-500">
          Enter the service name. You can add details, pricing, and images later
          by editing.
        </p>
      </div>
    </div>
  )

  // Complete form for editing services (all fields)
  const renderFormFields = (service: Service | null) => (
    <div className="space-y-6">
      <div className="space-y-2">
        <MultiImageCropUpload
          onImagesSelected={setImageFiles}
          onImagesReordered={setReorderedImageUrls}
          currentImageUrls={currentImageUrls}
          label="Service Images"
          required={false}
          maxImages={10}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Service name"
          defaultValue={service?.name}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="code">Service Code</Label>
        <Input
          id="code"
          name="code"
          placeholder="e.g., SHP001, GFT001, DLV001"
          defaultValue={service?.code}
          required
          pattern="[A-Z]{3}[0-9]{3}"
          title="Code must be 3 uppercase letters followed by 3 numbers (e.g., SHP001)"
        />
        <p className="text-xs text-gray-500">
          Unique service code. Format: 3 uppercase letters + 3 numbers (e.g.,
          SHP001 for Shipping, GFT001 for Gift Package)
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          className="w-full min-h-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Service description - Provide detailed information about the service, including what it includes, limitations, and any special requirements"
          defaultValue={service?.description}
          required
        />
        <p className="text-xs text-gray-500">
          Enter a detailed description of the service. You can include features,
          benefits, and any important information customers should know.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="price">Price ({currencySymbol})</Label>
        <Input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          placeholder="Service price"
          defaultValue={service?.price}
          required
        />
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          name="isActive"
          defaultChecked={service ? service.isActive : true}
        />
        <Label htmlFor="isActive">Active</Label>
        <p className="text-xs text-gray-500 ml-2">
          Only active services will be shown to customers
        </p>
      </div>
    </div>
  )

  return (
    <PageLayout>
      <Card className="min-h-[calc(100vh-13.7rem)]">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className={commonStyles.headerIcon} />
                <h1 className="text-2xl font-bold text-green-600">Services</h1>
              </div>
              <Button
                onClick={() => {
                  setImageFiles([])
                  setCurrentImageUrls([])
                  setReorderedImageUrls(null)
                  setShowAddSheet(true)
                }}
              >
                Add Service
              </Button>
            </div>

            {/* Search */}
            <Input
              placeholder="Search services..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="max-w-sm"
            />

            {/* Grid View */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading services...
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No services found
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredServices.map((service) => (
                  <Card
                    key={service.id}
                    className={`hover:shadow-lg transition-shadow ${
                      !service.isActive ? "opacity-60 border-gray-400 border-2" : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3">
                        {/* Service Image */}
                        <div className="w-full h-48 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center">
                          {service.imageUrl && service.imageUrl.length > 0 ? (
                            <ProductImage
                              imageUrl={service.imageUrl}
                              alt={service.name}
                              size="lg"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Wrench className="w-16 h-16 text-gray-400" />
                          )}
                        </div>

                        {/* Service Info */}
                        <div className="space-y-2 flex-1">
                          <h3 className="font-semibold text-lg line-clamp-2 min-h-[3.5rem]">
                            {service.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {service.code}
                          </p>
                          <p className="text-lg font-bold text-green-600">
                            {currencySymbol}
                            {service.price.toFixed(2)}
                          </p>
                          {service.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {service.description}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 justify-end pt-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(service)}
                            className="h-8 w-8 p-0 flex items-center justify-center"
                          >
                            <Pencil
                              className={`${commonStyles.actionIcon} ${commonStyles.primary}`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(service)}
                            className="h-8 w-8 p-0 flex items-center justify-center hover:bg-red-50"
                          >
                            <Trash2
                              className={`${commonStyles.actionIcon} text-red-600`}
                            />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <FormSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        title="Quick Service Creation"
        description="Create a new service with basic info. Add details and images later by editing."
        onSubmit={handleAdd}
      >
        {renderCreateForm()}
      </FormSheet>

      <FormSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        title="Edit Service"
        description="Edit the details of this service"
        onSubmit={handleEditSubmit}
      >
        {selectedService && renderFormFields(selectedService)}
      </FormSheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Service"
        description={`Are you sure you want to delete "${selectedService?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </PageLayout>
  )
}
