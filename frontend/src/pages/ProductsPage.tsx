import { PageLayout } from "@/components/layout/PageLayout"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { FormSheet } from "@/components/shared/FormSheet"
import { MultiImageCropUpload } from "@/components/shared/MultiImageCropUpload"
import { ProductImage } from "@/components/shared/ProductImage"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { categoriesApi } from "@/services/categoriesApi"
import { productsApi, type Product } from "@/services/productsApi"
import { commonStyles } from "@/styles/common"
import { getCurrencySymbol } from "@/utils/format"
import { Package, Pencil, Trash2 } from "lucide-react"
import React, { useEffect, useState } from "react"

export function ProductsPage() {
  const { workspace, loading: isWorkspaceLoading } = useWorkspace()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("none")
  const [productIsActive, setProductIsActive] = useState(true)
  const [productCode, setProductCode] = useState("")
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([])
  const [reorderedImageUrls, setReorderedImageUrls] = useState<string[] | null>(
    null
  )

  // Load filters from localStorage or use defaults
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"name" | "sales" | "stock">("name")

  // Get currency symbol based on workspace settings
  const currencySymbol = getCurrencySymbol(workspace?.currency as string)

  // Don't save filters to localStorage to avoid issues after seed
  // useEffect(() => {
  //   localStorage.setItem("products_filter_category", filterCategory)
  // }, [filterCategory])

  // useEffect(() => {
  //   localStorage.setItem("products_sort_by", sortBy)
  // }, [sortBy])

  // Fetch products when workspace changes
  useEffect(() => {
    const loadProducts = async () => {
      if (!workspace?.id) {
        console.log("❌ No workspace ID, skipping products load")
        return
      }

      console.log("🔄 Loading products for workspace:", workspace.id)
      setIsLoading(true)
      try {
        const response = await productsApi.getAllForWorkspace(workspace.id)

        console.log("✅ API Response:", response)

        if (response && Array.isArray(response.products)) {
          console.log(
            `🔍 Products received from API: ${response.products.length}`
          )
          setProducts(response.products)
        } else {
          logger.error("Invalid API response format:", response)
          setProducts([])
          toast.error("Error in API response format")
        }
      } catch (error) {
        logger.error("Failed to load products:", error)
        console.error("❌ Products load error:", error)
        setProducts([])
        toast.error("Failed to load products")
      } finally {
        setIsLoading(false)
      }
    }

    loadProducts()
  }, [workspace?.id])

  // Fetch categories when workspace changes
  useEffect(() => {
    const loadCategories = async () => {
      if (!workspace?.id) return

      try {
        const categoriesData = await categoriesApi.getAllForWorkspace(
          workspace.id
        )
        setCategories(categoriesData)
      } catch (error) {
        logger.error("Failed to load categories:", error)
        toast.error("Failed to load categories")
      }
    }

    loadCategories()
  }, [workspace?.id])

  // Reset category selection when product changes
  useEffect(() => {
    setSelectedCategoryId(selectedProduct?.categoryId || "none")
    // Rimuovo il reset del productCode da qui per evitare conflitti
  }, [selectedProduct])

  // Filter and sort products
  const filteredProducts = React.useMemo(() => {
    console.log("🔍 Filter Debug:", {
      totalProducts: products.length,
      filterCategory,
      searchValue,
      sortBy,
    })

    // Filter by search
    let filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        product.code?.toLowerCase().includes(searchValue.toLowerCase()) ||
        product.description
          ?.toLowerCase()
          .includes(searchValue.toLowerCase()) ||
        product.category?.name.toLowerCase().includes(searchValue.toLowerCase())
    )

    console.log("🔍 After search filter:", filtered.length)

    // Filter by category
    if (filterCategory !== "all") {
      filtered = filtered.filter((p) => p.categoryId === filterCategory)
      console.log("🔍 After category filter:", filtered.length, "categoryId:", filterCategory)
    }

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "sales":
          return (b.salesScore || 0) - (a.salesScore || 0)
        case "stock":
          return (b.stock || 0) - (a.stock || 0)
        case "name":
        default:
          return a.name.localeCompare(b.name)
      }
    })

    console.log("🔍 Final filtered products:", filtered.length)
    return filtered
  }, [products, searchValue, filterCategory, sortBy])

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Force isActive = false for new products (will be activated later during edit)
    formData.set("isActive", "false")

    // Set product code from state
    formData.set("code", productCode)

    try {
      const newProduct = await productsApi.create(workspace.id, formData)
      logger.info("Product created successfully (inactive):", newProduct)
      setProducts((prev) => [newProduct, ...prev])
      setShowAddSheet(false)

      // Reset form state
      setProductCode("")
      setSelectedCategoryId("none")

      toast.success(
        "Product created successfully. Edit it to add details and images."
      )
    } catch (error: any) {
      logger.error("Failed to add product:", error)
      const errorMessage =
        error.response?.data?.message || "Failed to create product"
      toast.error(errorMessage)
    }
  }

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setSelectedCategoryId(product.categoryId || "none")
    setProductIsActive(product.isActive ?? true)
    setProductCode(product.code || "")

    const imageUrls = Array.isArray(product.imageUrl)
      ? product.imageUrl
      : product.imageUrl
      ? [product.imageUrl]
      : []

    logger.info("ProductsPage: Opening edit for product", {
      productId: product.id,
      productName: product.name,
      imageUrls: imageUrls,
      imageCount: imageUrls.length,
    })

    setCurrentImageUrls(imageUrls)
    setImageFiles([])
    setReorderedImageUrls(null) // null = no interaction yet
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedProduct || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Add multiple image files if available
    if (imageFiles && imageFiles.length > 0) {
      imageFiles.forEach((file) => {
        formData.append(`images`, file)
      })
    }

    // Always send existing image URLs (even if empty array) to handle deletions
    // Use reorderedImageUrls if user interacted with images (not null)
    // Otherwise use currentImageUrls (no interaction)
    const imagesToSend =
      reorderedImageUrls !== null ? reorderedImageUrls : currentImageUrls

    formData.append("existingImageUrls", JSON.stringify(imagesToSend))

    // Override form fields with state values (not append, to avoid duplicates)
    formData.set("code", productCode) // Use .set() instead of .append()
    formData.set("isActive", productIsActive.toString())

    // Make sure categoryId is set correctly if "none" is selected
    const catId = formData.get("categoryId")
    if (catId === "none") {
      formData.delete("categoryId")
      formData.append("categoryId", "")
    }

    // Debug logging
    logger.info("Form data being sent for product update")

    try {
      const updatedProduct = await productsApi.update(
        selectedProduct.id,
        workspace.id,
        formData
      )

      setProducts((prev) =>
        prev.map((product) =>
          product.id === selectedProduct.id ? updatedProduct : product
        )
      )

      setShowEditSheet(false)
      setSelectedProduct(null)
      setProductCode("") // Reset del productCode dopo il submit
      setImageFiles([]) // Reset image files
      setCurrentImageUrls([]) // Reset current image URLs
      setReorderedImageUrls(null) // Reset reordered image URLs
      toast.success("Product updated successfully")
    } catch (error) {
      logger.error("Failed to update product:", error)
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
      setProducts((prev) =>
        prev.filter((product) => product.id !== selectedProduct.id)
      )
      setShowDeleteDialog(false)
      setSelectedProduct(null)
      toast.success("Product deleted successfully")
    } catch (error) {
      logger.error("Failed to delete product:", error)
      toast.error("Failed to delete product")
    }
  }

  if (isWorkspaceLoading || isLoading) {
    return <div>Loading...</div>
  }

  if (!workspace?.id) {
    return <div>No workspace selected</div>
  }

  const renderCreateForm = () => {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            name="name"
            placeholder="Enter product name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="code">Product Code *</Label>
          <Input
            id="code"
            name="code"
            placeholder="e.g. PROD001"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value.toUpperCase())}
            maxLength={20}
            required
          />
          <p className="text-xs text-muted-foreground">
            Unique product identifier. Maximum 20 characters.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoryId">Category *</Label>
          <Select
            value={selectedCategoryId}
            onValueChange={setSelectedCategoryId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Category</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="hidden"
            name="categoryId"
            value={selectedCategoryId === "none" ? "" : selectedCategoryId}
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-800">
            ℹ️ The product will be created as <strong>inactive</strong>. You can
            add images, price, and other details by editing it after creation.
          </p>
        </div>
      </div>
    )
  }

  const renderFormFields = (product: Product | null) => {
    return (
      <div className="space-y-6">
        {/* Product Images */}
        <div className="space-y-2">
          <MultiImageCropUpload
            onImagesSelected={setImageFiles}
            onImagesReordered={setReorderedImageUrls}
            currentImageUrls={currentImageUrls}
            label="Product Images"
            required={false}
            maxImages={10}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Product Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="Enter product name"
            defaultValue={product?.name}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="code">Product Code</Label>
          <Input
            id="code"
            name="code"
            placeholder="Enter product code (e.g., 00001)"
            value={productCode}
            onChange={(e) => {
              const value = e.target.value.slice(0, 5) // Limita a 5 caratteri
              setProductCode(value)
            }}
            maxLength={5}
            required
          />
          <p className="text-xs text-gray-500">Maximum 5 characters</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            className="min-h-[100px]"
            placeholder="Enter product description"
            defaultValue={product?.description || ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="formato">Format</Label>
          <Input
            id="formato"
            name="formato"
            placeholder="Enter product format (e.g., 100gr *12, 1 Kg)"
            defaultValue={product?.formato || ""}
          />
          <p className="text-xs text-gray-500">
            Product packaging format or size
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price ({currencySymbol})</Label>
            <Input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              defaultValue={product?.price?.toString()}
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
              defaultValue={product?.stock?.toString()}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <Select
            value={selectedCategoryId}
            onValueChange={setSelectedCategoryId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Category</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="hidden"
            name="categoryId"
            value={selectedCategoryId === "none" ? "" : selectedCategoryId}
          />
        </div>

        <div className="flex items-center justify-between border rounded-lg p-3">
          <div className="space-y-1">
            <Label htmlFor="isActive" className="text-sm font-medium">
              Active Product
            </Label>
            <p className="text-xs text-gray-500">
              Only active products will be shown to customers
            </p>
          </div>
          <Switch
            id="isActive"
            checked={productIsActive}
            onCheckedChange={setProductIsActive}
          />
        </div>
      </div>
    )
  }

  return (
    <PageLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className={commonStyles.headerIcon} />
            <h1 className="text-2xl font-bold text-green-600">Products</h1>
          </div>
          <Button
            onClick={() => {
              setSelectedCategoryId("none")
              setProductIsActive(true)
              setProductCode("")
              setShowAddSheet(true)
            }}
          >
            Add Product
          </Button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <Input
            placeholder="Search products..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="max-w-sm"
          />

          {/* Category Filter */}
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort By */}
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as "name" | "sales" | "stock")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort by Name</SelectItem>
              <SelectItem value="sales">Sort by Sales</SelectItem>
              <SelectItem value="stock">Sort by Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid View */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No products found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className={`hover:shadow-lg transition-shadow ${
                  product.stock === 0 ? "border-red-500 border-2" : ""
                } ${
                  !product.isActive ? "opacity-60 border-gray-400 border-2" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    {/* Sales Performance Bar - Enhanced UI */}
                    {(() => {
                      // Use real sales data from backend (defaults to 0 if not available)
                      const salesScore = product.salesScore || 0
                      const salesCount = product.salesCount || 0

                      const getGradientColor = (score: number) => {
                        if (score < 50) {
                          const r = 239
                          const g = Math.round(68 + (score / 50) * (234 - 68))
                          const b = 68
                          return `rgb(${r}, ${g}, ${b})`
                        } else {
                          const r = Math.round(
                            234 - ((score - 50) / 50) * (234 - 34)
                          )
                          const g = Math.round(
                            234 - ((score - 50) / 50) * (234 - 197)
                          )
                          const b = Math.round(
                            68 + ((score - 50) / 50) * (94 - 68)
                          )
                          return `rgb(${r}, ${g}, ${b})`
                        }
                      }

                      const getEmoji = (score: number) => {
                        if (score < 30) return "🔴"
                        if (score < 70) return "🟡"
                        return "🔥"
                      }

                      const getLabel = (score: number) => {
                        if (score < 30) return "Slow Mover"
                        if (score < 70) return "Steady Sales"
                        return "Hot Seller!"
                      }

                      const getTrendArrow = (score: number) => {
                        if (score < 40) return "↘"
                        if (score < 60) return "→"
                        return "↗"
                      }

                      return (
                        <div className="w-full">
                          {/* Progress Bar */}
                          <div className="relative w-full h-1.5 bg-gray-200 rounded-t-md overflow-hidden">
                            <div
                              className="h-full transition-all duration-500 ease-out"
                              style={{
                                width: `${salesScore}%`,
                                backgroundColor: getGradientColor(salesScore),
                              }}
                            />
                          </div>
                          {/* Label Bar */}
                          <div className="w-full bg-gradient-to-r from-gray-50 to-white px-2 py-1 flex items-center justify-between border-b border-gray-100">
                            <span className="flex items-center gap-1 text-xs font-medium">
                              <span className="text-base">
                                {getEmoji(salesScore)}
                              </span>
                              <span className="text-gray-700">
                                {getLabel(salesScore)}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span
                                className="text-xs font-bold"
                                style={{ color: getGradientColor(salesScore) }}
                              >
                                {salesScore}%
                              </span>
                              <span className="text-sm">
                                {getTrendArrow(salesScore)}
                              </span>
                            </span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Image */}
                    <div className="w-full h-32 flex items-center justify-center bg-gray-50 overflow-hidden relative">
                      <ProductImage
                        imageUrl={product.imageUrl}
                        alt={product.name}
                        size="lg"
                        className="w-full h-full"
                      />
                    </div>

                    {/* Info */}
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg line-clamp-2 min-h-[3.5rem]">
                        {product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {product.code}
                      </p>
                      <p className="text-lg font-bold text-green-600">
                        {currencySymbol}
                        {product.price.toFixed(2)}
                      </p>
                      <p className="text-sm">
                        <span
                          className={
                            product.stock === 0
                              ? "text-red-600 font-medium"
                              : "text-blue-600"
                          }
                        >
                          {product.stock === 0
                            ? "Out of stock"
                            : `Stock: ${product.stock}`}
                        </span>
                      </p>
                      {product.category && (
                        <p className="text-xs text-muted-foreground">
                          {product.category.name}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(product)}
                        className="h-8 w-8 p-0 flex items-center justify-center"
                      >
                        <Pencil
                          className={`${commonStyles.actionIcon} ${commonStyles.primary}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(product)}
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

      <FormSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        title="Quick Product Creation"
        description="Create a new product with basic info. Add details and images later by editing."
        onSubmit={handleAdd}
      >
        {renderCreateForm()}
      </FormSheet>

      <FormSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
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
        description={`Are you sure you want to delete "${selectedProduct?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </PageLayout>
  )
}
