import { PageLayout } from "@/components/layout/PageLayout"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { CrudPageContent } from "@/components/shared/CrudPageContent"
import { FormSheet } from "@/components/shared/FormSheet"
import { MultiImageCropUpload } from "@/components/shared/MultiImageCropUpload"
import { ProductImage } from "@/components/shared/ProductImage"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { Service, servicesApi } from "@/services/servicesApi"
import { commonStyles } from "@/styles/common"
import { formatPrice, getCurrencySymbol } from "@/utils/format"
import { Wrench } from "lucide-react"
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
  const [reorderedImageUrls, setReorderedImageUrls] = useState<string[]>([])

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

  const columns = [
    {
      header: "Image",
      id: "image",
      size: 80,
      cell: ({ row }: { row: { original: Service } }) => (
        <ProductImage
          imageUrl={row.original.imageUrl}
          alt={row.original.name}
          size="sm"
        />
      ),
    },
    { header: "Name", accessorKey: "name" as keyof Service, size: 200 },
    {
      header: "Description",
      accessorKey: "description" as keyof Service,
      size: 400,
      cell: ({ row }: { row: { original: Service } }) => {
        const description = row.original.description
        const maxLength = 80
        const isTruncated = description.length > maxLength

        return (
          <div>
            {isTruncated ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      {description.substring(0, maxLength)}...
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-md p-4 text-sm">
                    <p>{description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              description
            )}
          </div>
        )
      },
    },
    {
      header: "Price",
      accessorKey: "price" as keyof Service,
      size: 100,
      cell: ({ row }: { row: { original: Service } }) => (
        <span>{formatPrice(row.original.price, workspace?.currency)}</span>
      ),
    },
    {
      header: "Status",
      accessorKey: "isActive" as keyof Service,
      size: 100,
      cell: ({ row }: { row: { original: Service } }) => (
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            row.original.isActive
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
  ]

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Add multiple image files if selected
    if (imageFiles.length > 0) {
      imageFiles.forEach((file) => {
        formData.append("images", file)
      })
    }

    try {
      const newService = await servicesApi.createService(workspace.id, formData)
      setServices([...services, newService])
      setShowAddSheet(false)
      setImageFiles([])
      setCurrentImageUrls([])
      setReorderedImageUrls([])
      toast.success("Service created successfully")
    } catch (error) {
      logger.error("Error creating service:", error)
      toast.error("Failed to create service")
    }
  }

  const handleEdit = (service: Service) => {
    setSelectedService(service)
    setCurrentImageUrls(service.imageUrl || [])
    setImageFiles([])
    setReorderedImageUrls([])
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
    const imagesToSend =
      reorderedImageUrls.length > 0 ? reorderedImageUrls : currentImageUrls

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
      setReorderedImageUrls([])
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
      <CrudPageContent
        title="Services"
        titleIcon={<Wrench className={commonStyles.headerIcon} />}
        searchValue={searchValue}
        onSearch={setSearchValue}
        searchPlaceholder="Search services..."
        onAdd={() => {
          setImageFiles([])
          setCurrentImageUrls([])
          setReorderedImageUrls([])
          setShowAddSheet(true)
        }}
        addButtonText="Add"
        data={filteredServices}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
      />

      <FormSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        title="Add Service"
        description="Add a new service that you offer to your customers"
        onSubmit={handleAdd}
      >
        {renderFormFields(null)}
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
