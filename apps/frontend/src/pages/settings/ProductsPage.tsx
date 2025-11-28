import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { FormSheet } from "@/components/shared/FormSheet"
import { ImageCropUpload } from "@/components/shared/ImageCropUpload"
import { PageHeader } from "@/components/shared/PageHeader"
import { ProductImage } from "@/components/shared/ProductImage"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { categoriesApi } from "@/services/categoriesApi"
import { Product, productsApi } from "@/services/productsApi"
import { formatPrice, getCurrencySymbol } from "@/utils/format"
import { Package2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../../lib/toast"

export function ProductsPage() {
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<
    Array<{ value: string; label: string }>
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)

  // Get currency symbol based on workspace settings
  const currencySymbol = getCurrencySymbol(workspace?.currency)

  useEffect(() => {
    const loadData = async () => {
      if (!workspace?.id) return
      try {
        setIsLoading(true)
        // Load products
        const productsData = await productsApi.getAllForWorkspace(workspace.id)
        setProducts(productsData.products || [])

        // Load categories for the dropdown
        const categoriesData = await categoriesApi.getAllForWorkspace(
          workspace.id
        )
        const formattedCategories = categoriesData.map((category) => ({
          value: category.id,
          label: category.name,
        }))
        setCategories(formattedCategories)
      } catch (error) {
        logger.error("Error loading data:", error)
        toast.error("Failed to load data")
      } finally {
        setIsLoading(false)
      }
    }

    if (!isLoadingWorkspace) {
      loadData()
    }
  }, [workspace?.id, isLoadingWorkspace])

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      product.description.toLowerCase().includes(searchValue.toLowerCase()) ||
      (product.status || "").toLowerCase().includes(searchValue.toLowerCase())
  )

  const columns = [
    {
      header: "Image",
      id: "image",
      cell: ({ row }: any) => (
        <ProductImage
          imageUrl={row.original.imageUrl}
          alt={row.original.name}
          size="sm"
        />
      ),
    },
    { header: "Name", accessorKey: "name" as keyof Product },
    { header: "Code", accessorKey: "code" as keyof Product },
    {
      header: "Price",
      accessorKey: "price" as keyof Product,
      cell: ({ row }: any) =>
        formatPrice(row.original.price, workspace?.currency),
    },
    { header: "Stock", accessorKey: "stock" as keyof Product },
    { header: "Status", accessorKey: "status" as keyof Product },
  ]

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Add image if selected
    if (selectedImage) {
      formData.append("image", selectedImage)
    }

    try {
      const newProduct = await productsApi.create(workspace.id, formData)
      setProducts([...products, newProduct])
      setShowAddDialog(false)
      setSelectedImage(null)
      toast.success("Product created successfully")
    } catch (error) {
      logger.error("Error creating product:", error)
      toast.error("Failed to create product")
    }
  }

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setShowEditDialog(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedProduct || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Add image if selected
    if (selectedImage) {
      formData.append("image", selectedImage)
    }

    try {
      const updatedProduct = await productsApi.update(
        selectedProduct.id,
        workspace.id,
        formData
      )
      setProducts(
        products.map((p) => (p.id === selectedProduct.id ? updatedProduct : p))
      )
      setShowEditDialog(false)
      setSelectedProduct(null)
      setSelectedImage(null)
      toast.success("Product updated successfully")
    } catch (error) {
      logger.error("Error updating product:", error)
      toast.error("Failed to update product")
    }
  }

  const handleDelete = (product: Product) => {
    setSelectedProduct(product)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedProduct || !workspace?.id) return

    try {
      await productsApi.delete(selectedProduct.id, workspace.id)
      setProducts(products.filter((p) => p.id !== selectedProduct.id))
      setShowDeleteDialog(false)
      setSelectedProduct(null)
      toast.success("Product deleted successfully")
    } catch (error) {
      logger.error("Error deleting product:", error)
      toast.error("Failed to delete product")
    }
  }

  if (isLoadingWorkspace || isLoading) {
    return <div>Loading...</div>
  }

  if (!workspace?.id) {
    return <div>No workspace selected</div>
  }

  const renderFormFields = (product: Product | null) => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Product Image</Label>
        <ImageCropUpload
          onImageSelected={setSelectedImage}
          currentImageUrl={product?.imageUrl?.[0]}
        />
        <p className="text-xs text-gray-500">
          Upload a product image. The image will be cropped to a square format.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Product Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Product name"
          defaultValue={product?.name}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Product Code</Label>
        <Input
          id="code"
          name="code"
          placeholder="Maximum 5 characters"
          defaultValue={product?.code}
          required
          maxLength={5}
        />
        <p className="text-xs text-gray-500">Maximum 5 characters</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Product description"
          defaultValue={product?.description}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="formato">Format</Label>
        <Input
          id="formato"
          name="formato"
          placeholder="Product packaging format or size"
          defaultValue={product?.formato}
        />
        <p className="text-xs text-gray-500">
          Product packaging format or size
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price ({currencySymbol})</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            defaultValue={product?.price}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock">Stock Quantity</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min="0"
            placeholder="0"
            defaultValue={product?.stock}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoryId">Category</Label>
        <Select name="categoryId" defaultValue={product?.categoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <input type="hidden" name="isActive" value="true" />
    </div>
  )

  // Define form fields for add/edit dialogs (kept for compatibility but not used)
  const productFields = [
    {
      name: "name",
      label: "Name",
      type: "text" as const,
      required: true,
    },
    {
      name: "code",
      label: "Code",
      type: "text" as const,
      required: true,
    },
    {
      name: "description",
      label: "Description",
      type: "text" as const,
    },
    {
      name: "price",
      label: `Price (${currencySymbol})`,
      type: "number" as const,
      required: true,
      min: "0",
      step: "0.01",
    },
    {
      name: "stock",
      label: "Stock",
      type: "number" as const,
      required: true,
      min: "0",
      step: "1",
    },
    {
      name: "categoryId",
      label: "Category",
      type: "select" as const,
      options: categories,
    },
  ]

  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Products"
        titleIcon={<Package2 className="h-6 w-6" />}
        searchValue={searchValue}
        onSearch={setSearchValue}
        searchPlaceholder="Search products..."
        onAdd={() => setShowAddDialog(true)}
      />

      <div className="mt-6">
        <DataTable
          data={filteredProducts}
          columns={columns}
          globalFilter={searchValue}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <FormSheet
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        title="Add Product"
        description="Add a new product to your catalog"
        onSubmit={handleAdd}
      >
        {renderFormFields(null)}
      </FormSheet>

      <FormSheet
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        title="Edit Product"
        description="Edit this product information"
        onSubmit={handleEditSubmit}
      >
        {selectedProduct && renderFormFields(selectedProduct)}
      </FormSheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Product"
        description={`Are you sure you want to delete ${selectedProduct?.name}? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
