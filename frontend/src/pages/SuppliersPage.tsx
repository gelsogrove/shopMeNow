import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { MultiImageCropUpload } from "@/components/shared/MultiImageCropUpload"
import { PageHeader } from "@/components/shared/PageHeader"
import { ProductImage } from "@/components/shared/ProductImage"
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
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { supplierApi, type Supplier } from "@/services/supplier"
import { Building2 } from "lucide-react"
import { useEffect, useState } from "react"

export function SuppliersPage() {
  const { workspace } = useWorkspace()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null
  )
  const [logoFiles, setLogoFiles] = useState<File[]>([])
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>("")

  useEffect(() => {
    if (workspace?.id) {
      loadSuppliers()
    }
  }, [workspace?.id])

  const loadSuppliers = async () => {
    if (!workspace?.id) return

    try {
      setLoading(true)
      const response = await supplierApi.getAll(workspace.id)
      setSuppliers(response || [])
    } catch (error) {
      logger.error("Error loading suppliers:", error)
      toast.error("Failed to load suppliers")
    } finally {
      setLoading(false)
    }
  }

  const filteredSuppliers = suppliers.filter((supplier) =>
    Object.values(supplier).some((value) =>
      value?.toString().toLowerCase().includes(searchValue.toLowerCase())
    )
  )

  const columns = [
    {
      header: "Logo",
      accessorKey: "logoUrl" as keyof Supplier,
      size: 80,
      cell: (info: any) => {
        const value = info.getValue()
        return value ? (
          <ProductImage imageUrl={[value]} alt="Logo" size="sm" />
        ) : (
          <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-gray-400" />
          </div>
        )
      },
    },
    {
      header: "Company",
      accessorKey: "companyName" as keyof Supplier,
      size: 250,
    },
    {
      header: "Region",
      accessorKey: "region" as keyof Supplier,
      size: 150,
      cell: (info: any) => {
        const value = info.getValue()
        return value || "-"
      },
    },
    {
      header: "Products",
      accessorKey: "_count" as keyof Supplier,
      size: 100,
      cell: (info: any) => {
        const value = info.getValue()
        return value?.products || 0
      },
    },
  ]

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Add logo if uploaded
    if (logoFiles.length > 0) {
      formData.append("logo", logoFiles[0])
      logger.info(
        "✅ Logo file added to FormData:",
        logoFiles[0].name,
        "size:",
        logoFiles[0].size
      )
    } else {
      logger.warn("⚠️ No logo file to upload")
    }

    logger.info("=== CREATE SUPPLIER FRONTEND ===")
    logger.info("CompanyName:", formData.get("companyName"))
    logger.info("Description:", formData.get("description"))
    logger.info("Logo file:", formData.get("logo"))

    try {
      const newSupplier = await supplierApi.create(workspace.id, formData)
      setSuppliers([newSupplier, ...suppliers])
      setShowAddSheet(false)
      setLogoFiles([])
      toast.success("Supplier added successfully")
    } catch (error: any) {
      logger.error("Error adding supplier:", error)
      const errorMessage =
        error.response?.data?.message || "Failed to add supplier"
      toast.error(errorMessage)
    }
  }

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setCurrentLogoUrl(supplier.logoUrl || "")
    setLogoFiles([])
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedSupplier || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Add logo if uploaded
    if (logoFiles.length > 0) {
      formData.append("logo", logoFiles[0])
    }

    // Keep existing logo if no new one uploaded
    if (!logoFiles.length && currentLogoUrl) {
      formData.append("existingLogoUrl", currentLogoUrl)
    }

    try {
      const updatedSupplier = await supplierApi.update(
        workspace.id,
        selectedSupplier.id,
        formData
      )
      setSuppliers(
        suppliers.map((s) =>
          s.id === selectedSupplier.id ? updatedSupplier : s
        )
      )
      setShowEditSheet(false)
      setSelectedSupplier(null)
      setLogoFiles([])
      setCurrentLogoUrl("")
      toast.success("Supplier updated successfully")
    } catch (error) {
      logger.error("Error updating supplier:", error)
      toast.error("Failed to update supplier")
    }
  }

  const handleDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedSupplier || !workspace?.id) return

    try {
      await supplierApi.delete(workspace.id, selectedSupplier.id)
      setSuppliers(suppliers.filter((s) => s.id !== selectedSupplier.id))
      setShowDeleteDialog(false)
      setSelectedSupplier(null)
      toast.success("Supplier deleted successfully")
    } catch (error) {
      logger.error("Error deleting supplier:", error)
      toast.error("Failed to delete supplier")
    }
  }

  if (loading) {
    return (
      <div className="container flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-2">
          <LoadingSpinner />
          <p className="text-lg font-medium">Loading suppliers...</p>
        </div>
      </div>
    )
  }

  const renderForm = (supplier: Supplier | null = null) => (
    <form
      onSubmit={supplier ? handleEditSubmit : handleAdd}
      className="space-y-6 pt-6"
    >
      {/* Logo Upload */}
      <div className="space-y-2">
        <Label>Company Logo</Label>
        <MultiImageCropUpload
          onImagesSelected={setLogoFiles}
          currentImageUrls={supplier?.logoUrl ? [supplier.logoUrl] : []}
          maxImages={1}
        />
      </div>

      {/* Company Name */}
      <div className="space-y-2">
        <Label htmlFor="companyName">
          Company Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="companyName"
          name="companyName"
          defaultValue={supplier?.companyName}
          placeholder="e.g., Italian Food Imports"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={supplier?.description || ""}
          placeholder="Brief description of the supplier..."
          rows={3}
        />
      </div>

      {/* Contact Name & Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Name</Label>
          <Input
            id="contactName"
            name="contactName"
            defaultValue={supplier?.contactName || ""}
            placeholder="John Doe"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={supplier?.phone || ""}
            placeholder="+39 02 1234567"
          />
        </div>
      </div>

      {/* Email & Website */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={supplier?.email || ""}
            placeholder="info@company.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            name="website"
            defaultValue={supplier?.website || ""}
            placeholder="https://company.com"
          />
        </div>
      </div>

      {/* Region & Country */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Input
            id="region"
            name="region"
            defaultValue={supplier?.region || ""}
            placeholder="e.g., Tuscany"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            name="country"
            defaultValue={supplier?.country || ""}
            placeholder="e.g., Italy"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-4 flex justify-end">
        <Button type="submit" className="bg-green-600 hover:bg-green-700">
          {supplier ? "Save Changes" : "Add"}
        </Button>
      </div>
    </form>
  )

  return (
    <div className="container pl-0 pr-4 pt-4 pb-4">
      <div className="grid grid-cols-12 gap-0">
        <div className="col-span-11 col-start-1">
          <PageHeader
            title="Suppliers"
            titleIcon={<Building2 className="mr-2 h-6 w-6 text-green-500" />}
            searchValue={searchValue}
            onSearch={setSearchValue}
            searchPlaceholder="Search suppliers..."
            itemCount={filteredSuppliers.length}
            onAdd={() => setShowAddSheet(true)}
            addButtonText="Add"
          />

          <div className="mt-6 w-full">
            <DataTable
              columns={columns}
              data={filteredSuppliers}
              onEdit={handleEdit}
              onDelete={handleDelete}
              globalFilter={searchValue}
            />
          </div>
        </div>
      </div>

      {/* Add Supplier Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="right" className="w-[25%]">
          <SheetHeader>
            <SheetTitle>Add Supplier</SheetTitle>
            <SheetDescription>
              Add a new supplier to your workspace
            </SheetDescription>
          </SheetHeader>
          {renderForm()}
        </SheetContent>
      </Sheet>

      {/* Edit Supplier Sheet */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent side="right" className="w-[25%]">
          <SheetHeader>
            <SheetTitle>Edit Supplier</SheetTitle>
            <SheetDescription>
              Make changes to your supplier here
            </SheetDescription>
          </SheetHeader>
          {selectedSupplier && renderForm(selectedSupplier)}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Supplier"
        description={`Are you sure you want to delete "${selectedSupplier?.companyName}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  )
}
