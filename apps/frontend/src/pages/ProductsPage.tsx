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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { categoriesApi } from "@/services/categoriesApi"
import * as certificationsApi from "@/services/certificationsApi"
import { type Certification } from "@/services/certificationsApi"
import * as typesApi from "@/services/typesApi"
import { type Type } from "@/services/typesApi"
import { productsApi, type Product } from "@/services/productsApi"
import { supplierApi, type Supplier } from "@/services/supplier"
import { commonStyles } from "@/styles/common"
import { getCurrencySymbol } from "@/utils/format"
import { Award, Download, Package, Pencil, Trash2, Truck, Upload } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"

export function ProductsPage() {
  const { workspace, loading: isWorkspaceLoading } = useWorkspace()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [types, setTypes] = useState<Type[]>([])
  const [selectedCertificationIds, setSelectedCertificationIds] = useState<
    string[]
  >([])
  const [selectedTypeIds, setSelectedTypeIds] = useState<
    string[]
  >([])
  const [formCertificationIds, setFormCertificationIds] = useState<string[]>([])
  const [formTypeIds, setFormTypeIds] = useState<string[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [formCategoryIds, setFormCategoryIds] = useState<string[]>([])
  const [showCategoriesPanel, setShowCategoriesPanel] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCertificationsPanel, setShowCertificationsPanel] = useState(false)
  const [showTypesPanel, setShowTypesPanel] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("none")
  const [productIsActive, setProductIsActive] = useState(true)
  const [sku, setSku] = useState("")
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([])
  const [reorderedImageUrls, setReorderedImageUrls] = useState<string[] | null>(
    null
  )

  // Product Characteristics state (key-value pairs)
  const [characteristics, setCharacteristics] = useState<Array<{ name: string; value: string }>>([])

  // Import/Export state
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load filters from localStorage or use defaults
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"name" | "stock">("name")

  // Get currency symbol based on workspace settings
  const currencySymbol = getCurrencySymbol(workspace?.currency as string)

  // Don't save filters to localStorage to avoid issues after seed
  // useEffect(() => {
  //   localStorage.setItem("products_filter_category", filterCategory)
  // }, [filterCategory])

  // useEffect(() => {
  //   localStorage.setItem("products_sort_by", sortBy)
  // }, [sortBy])

  // 🚀 CONSOLIDATED: Fetch all data in parallel when workspace changes
  useEffect(() => {
    const loadAllData = async () => {
      if (!workspace?.id) {
        logger.info("❌ No workspace ID, skipping data load")
        return
      }

      logger.info("🔄 Loading all data for workspace:", workspace.id)
      setIsLoading(true)
      
      try {
        // Parallel fetch for better performance
        const results = await Promise.allSettled([
          productsApi.getAllForWorkspace(workspace.id),
          categoriesApi.getAllForWorkspace(workspace.id),
          certificationsApi.getAllForWorkspace(workspace.id),
          typesApi.getAllForWorkspace(workspace.id),
        ])

        const [
          productsResult,
          categoriesResult,
          certificationsResult,
          typesResult,
        ] = results

        // Set products
        let coreLoadFailed = false
        if (productsResult.status === "fulfilled") {
          const productsResponse = productsResult.value
          if (productsResponse && Array.isArray(productsResponse.products)) {
            logger.info(`✅ Products received: ${productsResponse.products.length}`)
            setProducts(productsResponse.products)
          } else {
            logger.error("Invalid API response format:", productsResponse)
            setProducts([])
            toast.error("Error in API response format")
            coreLoadFailed = true
          }
        } else {
          logger.error("Failed to load products:", productsResult.reason)
          setProducts([])
          toast.error("Failed to load products")
          coreLoadFailed = true
        }

        // Set other data (defaults to empty on failure)
        setCategories(categoriesResult.status === "fulfilled" ? categoriesResult.value : [])
        setCertifications(certificationsResult.status === "fulfilled" ? certificationsResult.value : [])
        setTypes(typesResult.status === "fulfilled" ? typesResult.value : [])

        if (!coreLoadFailed) {
          logger.info("✅ All data loaded successfully")
        }
      } catch (error) {
        logger.error("Failed to load data:", error)
        setProducts([])
        toast.error("Failed to load data")
      } finally {
        setIsLoading(false)
      }
    }

    loadAllData()
  }, [workspace?.id])

  // Reset category when product changes
  useEffect(() => {
    if (selectedProduct) {
      setSelectedCategoryId(selectedProduct.categoryId || "none")
      logger.info("Setting selected values from product:", {
        categoryId: selectedProduct.categoryId,
      })
    }
    // Rimuovo il reset del sku da qui per evitare conflitti
  }, [selectedProduct])

  // Filter and sort products
  const filteredProducts = React.useMemo(() => {
    logger.info("🔍 Filter Debug:", {
      totalProducts: products.length,
      filterCategory,
      searchValue,
      sortBy,
      selectedCertificationIds,
      selectedTypeIds,
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

    logger.info("🔍 After search filter:", filtered.length)

    // Filter by category dropdown (old filter)
    if (filterCategory !== "all") {
      filtered = filtered.filter((p) => p.categoryId === filterCategory)
      logger.info(
        "🔍 After category dropdown filter:",
        filtered.length,
        "categoryId:",
        filterCategory
      )
    }

    // Filter by selected categories (checkbox filters)
    if (selectedCategoryIds.length > 0) {
      filtered = filtered.filter((product) =>
        selectedCategoryIds.some((catId) => product.categoryId === catId)
      )
      logger.info("🔍 After category checkbox filters:", filtered.length)
    }

    // Filter by selected certifications (dynamic from database)
    if (selectedCertificationIds.length > 0) {
      filtered = filtered.filter((product) =>
        selectedCertificationIds.every((certId) =>
          product.certifications?.some((certName) => {
            const cert = certifications.find((c) => c.id === certId)
            return cert && certName === cert.name
          })
        )
      )
    }

    logger.info("🔍 After certification filters:", filtered.length)

    // Filter by selected transport types (dynamic from database)
    if (selectedTypeIds.length > 0) {
      filtered = filtered.filter((product) =>
        selectedTypeIds.every((typeId) =>
          product.productTypes?.some((pt) => pt.typeId === typeId)
        )
      )
      logger.info("🔍 After transport type filters:", filtered.length)
    }

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "stock":
          return (b.stock || 0) - (a.stock || 0)
        case "name":
        default:
          return a.name.localeCompare(b.name)
      }
    })

    logger.info("🔍 Final filtered products:", filtered.length)
    return filtered
  }, [
    products,
    searchValue,
    filterCategory,
    selectedCategoryIds,
    sortBy,
    selectedCertificationIds,
    certifications,
    selectedTypeIds,
    types,
  ])

  // Export products to CSV
  const handleExport = async () => {
    if (!workspace?.id) return
    
    setIsExporting(true)
    try {
      const response = await productsApi.exportCsv(workspace.id)
      
      // Create blob and download
      const blob = new Blob([response], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `products-export-${new Date().toISOString().split("T")[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success("Products exported successfully")
    } catch (error: any) {
      logger.error("Failed to export products:", error)
      toast.error(error.response?.data?.message || "Failed to export products")
    } finally {
      setIsExporting(false)
    }
  }

  // Import products from CSV
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!workspace?.id) return
    
    const file = event.target.files?.[0]
    if (!file) return

    // Reset input so same file can be selected again
    event.target.value = ""

    setIsImporting(true)
    try {
      const result = await productsApi.importCsv(workspace.id, file)
      
      // Refresh products list
      const response = await productsApi.getAll(workspace.id) as any
      setProducts(response.products || response)
      
      // Show results
      const { created, updated, errors } = result.results
      if (errors.length > 0) {
        toast.warning(
          `Import completed with errors: ${created} created, ${updated} updated, ${errors.length} errors`
        )
        logger.warn("Import errors:", errors)
      } else {
        toast.success(`Import completed: ${created} created, ${updated} updated`)
      }
    } catch (error: any) {
      logger.error("Failed to import products:", error)
      toast.error(error.response?.data?.message || "Failed to import products")
    } finally {
      setIsImporting(false)
    }
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Force isActive = false for new products (will be activated later during edit)
    formData.set("isActive", "false")

    // Set product code from state
    formData.set("code", sku)

    // Send certificationIds array to backend
    formData.set("certificationIds", JSON.stringify(formCertificationIds))
    
    // Send typeIds array to backend
    formData.set("typeIds", JSON.stringify(formTypeIds))

    // Send categoryIds array to backend (many-to-many)
    formData.set("categoryIds", JSON.stringify(formCategoryIds))

    try {
      const newProduct = await productsApi.create(workspace.id, formData)
      logger.info("Product created successfully (inactive):", newProduct)
      setProducts((prev) => [newProduct, ...prev])
      setShowAddSheet(false)

      // Reset form state
      setSku("")
      setSelectedCategoryId("none")
      setFormCategoryIds([])
      setFormCertificationIds([])
      setFormTypeIds([])

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
    logger.info("🔖 handleEdit - Full product object:", product)
    logger.info("🔖 handleEdit - productCertifications:", (product as any).productCertifications)
    logger.info("🔖 handleEdit - productCategories:", (product as any).productCategories)
    
    setSelectedProduct(product)
    setSelectedCategoryId(product.categoryId || "none") // DEPRECATED - keep for backward compatibility
    setProductIsActive(product.isActive ?? true)
    setSku(product.code || "")

    // Load product's category IDs from productCategories relation (many-to-many)
    // Fallback to categoryId for backward compatibility
    const catIds = (product as any).categoryIds || 
      (product as any).productCategories?.map((pc: any) => pc.categoryId) || 
      (product.categoryId ? [product.categoryId] : [])
    logger.info("📦 handleEdit - Extracted categoryIds:", catIds)
    setFormCategoryIds(catIds)

    // Load product's certification IDs from productCertifications relation
    const certIds = (product as any).productCertifications?.map(
      (pc: any) => pc.certificationId
    ) || []
    logger.info("🔖 handleEdit - Extracted certificationIds:", certIds)
    setFormCertificationIds(certIds)

    // Load product's transport type IDs from productTypes relation
    const transportIds = (product as any).productTypes?.map(
      (pt: any) => pt.typeId
    ) || []
    logger.info("🚚 handleEdit - Extracted typeIds:", transportIds)
    setFormTypeIds(transportIds)

    // Load product's characteristics (key-value pairs)
    const chars = (product as any).characteristics?.map((c: any) => ({ 
      name: c.name, 
      value: c.value 
    })) || []
    logger.info("🔑 handleEdit - Extracted characteristics:", chars)
    setCharacteristics(chars)

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
      certificationIds: certIds,
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
    formData.set("code", sku) // Use .set() instead of .append()
    formData.set("isActive", productIsActive.toString())

    // Send certificationIds array to backend
    formData.set("certificationIds", JSON.stringify(formCertificationIds))
    
    // Send typeIds array to backend
    formData.set("typeIds", JSON.stringify(formTypeIds))

    // Send categoryIds array to backend (many-to-many)
    formData.set("categoryIds", JSON.stringify(formCategoryIds))

    // Send characteristics array to backend
    const validCharacteristics = characteristics.filter(c => c.name.trim() && c.value.trim())
    formData.set("characteristics", JSON.stringify(validCharacteristics))

    // Debug logging
    logger.info("Form data being sent for product update")
    logger.info("CategoryIds:", formCategoryIds)
    logger.info("CertificationIds:", formCertificationIds)
    logger.info("Characteristics:", validCharacteristics)

    try {
      const updatedProduct = await productsApi.update(
        selectedProduct.id,
        workspace.id,
        formData
      )

      // Update product in list with fresh data from backend
      setProducts((prev) =>
        prev.map((product) =>
          product.id === selectedProduct.id ? updatedProduct : product
        )
      )

      setShowEditSheet(false)
      setSelectedProduct(null)
      setSku("") // Reset del sku dopo il submit
      setImageFiles([]) // Reset image files
      setCurrentImageUrls([]) // Reset current image URLs
      setReorderedImageUrls(null) // Reset reordered image URLs
      setFormCategoryIds([]) // Reset category IDs
      setFormCertificationIds([]) // Reset certification IDs
      setFormTypeIds([]) // Reset transport type IDs
      setCharacteristics([]) // Reset characteristics
      
      // Force reload to get fresh productCertifications and productTypes
      const response = await productsApi.getAllForWorkspace(workspace.id)
      if (response && Array.isArray(response.products)) {
        setProducts(response.products)
      }
      
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

  // Categories Panel Management
  const [catAddFormName, setCatAddFormName] = useState("")
  const [selectedCat, setSelectedCat] = useState<{ id: string; name: string } | null>(null)
  const [showCatEdit, setShowCatEdit] = useState(false)
  const [showCatDelete, setShowCatDelete] = useState(false)

  // Certifications Panel Management
  const [certAddFormName, setCertAddFormName] = useState("")
  const [selectedCert, setSelectedCert] = useState<Certification | null>(null)
  const [showCertEdit, setShowCertEdit] = useState(false)
  const [showCertDelete, setShowCertDelete] = useState(false)

  const filteredCats = categories

  const handleCatAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id || !catAddFormName.trim()) return

    try {
      await categoriesApi.create(workspace.id, { name: catAddFormName.trim() })
      toast.success("Category added successfully")
      setCatAddFormName("")
      const response = await categoriesApi.getAllForWorkspace(workspace.id)
      setCategories(response || [])
    } catch (error: any) {
      logger.error("Error adding category:", error)
      toast.error(error.response?.data?.error || "Failed to add category")
    }
  }

  const handleCatEdit = (cat: { id: string; name: string }) => {
    setSelectedCat(cat)
    setShowCatEdit(true)
  }

  const handleCatEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedCat?.id || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    const name = formData.get("name") as string

    if (!name?.trim()) return

    try {
      await categoriesApi.update(selectedCat.id, workspace.id, { name: name.trim() })
      toast.success("Category updated successfully")
      setShowCatEdit(false)
      setSelectedCat(null)
      const response = await categoriesApi.getAllForWorkspace(workspace.id)
      setCategories(response || [])
    } catch (error: any) {
      logger.error("Error updating category:", error)
      toast.error(error.response?.data?.error || "Failed to update category")
    }
  }

  const handleCatDelete = (cat: { id: string; name: string }) => {
    setSelectedCat(cat)
    setShowCatDelete(true)
  }

  const confirmCatDelete = async () => {
    if (!selectedCat?.id || !workspace?.id) return

    try {
      await categoriesApi.delete(selectedCat.id, workspace.id)
      toast.success("Category deleted successfully")
      setShowCatDelete(false)
      setSelectedCat(null)
      const response = await categoriesApi.getAllForWorkspace(workspace.id)
      setCategories(response || [])
    } catch (error: any) {
      logger.error("Error deleting category:", error)
      toast.error(error.response?.data?.error || "Failed to delete category")
    }
  }

  const filteredCerts = certifications

  const handleCertAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id || !certAddFormName.trim()) return

    try {
      await certificationsApi.create(workspace.id, { name: certAddFormName.trim() })
      toast.success("Certification added successfully")
      setCertAddFormName("")
      const response = await certificationsApi.getAllForWorkspace(workspace.id)
      setCertifications(response || [])
    } catch (error: any) {
      logger.error("Error adding certification:", error)
      toast.error(error.response?.data?.error || "Failed to add certification")
    }
  }

  const handleCertEdit = (cert: Certification) => {
    setSelectedCert(cert)
    setShowCertEdit(true)
  }

  const handleCertEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedCert?.id || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    const name = formData.get("name") as string

    if (!name?.trim()) return

    try {
      await certificationsApi.update(selectedCert.id, workspace.id, { name: name.trim() })
      toast.success("Certification updated successfully")
      setShowCertEdit(false)
      setSelectedCert(null)
      const response = await certificationsApi.getAllForWorkspace(workspace.id)
      setCertifications(response || [])
    } catch (error: any) {
      logger.error("Error updating certification:", error)
      toast.error(error.response?.data?.error || "Failed to update certification")
    }
  }

  const handleCertDelete = (cert: Certification) => {
    setSelectedCert(cert)
    setShowCertDelete(true)
  }

  const confirmCertDelete = async () => {
    if (!selectedCert?.id || !workspace?.id) return

    try {
      await certificationsApi.remove(workspace.id, selectedCert.id)
      toast.success("Certification deleted successfully")
      setShowCertDelete(false)
      setSelectedCert(null)
      const response = await certificationsApi.getAllForWorkspace(workspace.id)
      setCertifications(response || [])
    } catch (error: any) {
      logger.error("Error deleting certification:", error)
      toast.error(error.response?.data?.error || "Failed to delete certification")
    }
  }

  // Types Panel Management
  const [ttAddFormName, setTtAddFormName] = useState("")
  const [selectedTt, setSelectedTt] = useState<Type | null>(null)
  const [showTtEdit, setShowTtEdit] = useState(false)
  const [showTtDelete, setShowTtDelete] = useState(false)

  const filteredTts = types

  const handleTtAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id || !ttAddFormName.trim()) return

    try {
      await typesApi.create(workspace.id, { name: ttAddFormName.trim() })
      toast.success("Type added successfully")
      setTtAddFormName("")
      const response = await typesApi.getAllForWorkspace(workspace.id)
      setTypes(response || [])
    } catch (error: any) {
      logger.error("Error adding transport type:", error)
      toast.error(error.message || "Failed to add transport type")
    }
  }

  const handleTtEdit = (tt: Type) => {
    setSelectedTt(tt)
    setShowTtEdit(true)
  }

  const handleTtEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedTt?.id || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    const name = formData.get("name") as string

    if (!name?.trim()) return

    try {
      await typesApi.update(workspace.id, selectedTt.id, { name: name.trim() })
      toast.success("Type updated successfully")
      setShowTtEdit(false)
      setSelectedTt(null)
      const response = await typesApi.getAllForWorkspace(workspace.id)
      setTypes(response || [])
    } catch (error: any) {
      logger.error("Error updating transport type:", error)
      toast.error(error.message || "Failed to update transport type")
    }
  }

  const handleTtDelete = (tt: Type) => {
    setSelectedTt(tt)
    setShowTtDelete(true)
  }

  const confirmTtDelete = async () => {
    if (!selectedTt?.id || !workspace?.id) return

    try {
      await typesApi.remove(workspace.id, selectedTt.id)
      toast.success("Type deleted successfully")
      setShowTtDelete(false)
      setSelectedTt(null)
      const response = await typesApi.getAllForWorkspace(workspace.id)
      setTypes(response || [])
    } catch (error: any) {
      logger.error("Error deleting transport type:", error)
      toast.error(error.message || "Failed to delete transport type")
    }
  }

  if (isWorkspaceLoading || isLoading) {
    return <div>Loading...</div>
  }

  if (!workspace?.id) {
    return <div>No workspace selected</div>
  }

  const renderCreateForm = () => {
    logger.info("🎨 renderCreateForm - certifications:", certifications.length)
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
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            maxLength={20}
            required
          />
          <p className="text-xs text-muted-foreground">
            Unique product identifier. Maximum 20 characters.
          </p>
        </div>

        {/* Dynamic Categories Section */}
        {categories.length > 0 && (
          <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
            <Label className="text-base font-semibold">Categories</Label>
            <p className="text-xs text-gray-500 mb-3">
              Select categories for this product (optional)
            </p>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <label
                  key={cat.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formCategoryIds.includes(cat.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormCategoryIds([...formCategoryIds, cat.id])
                      } else {
                        setFormCategoryIds(formCategoryIds.filter(id => id !== cat.id))
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{cat.name}</span>
                </label>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFormCategoryIds([])}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear Selection
            </Button>
          </div>
        )}

        {/* Dynamic Certifications Section */}
        {certifications.length > 0 && (
          <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
            <Label className="text-base font-semibold">Certifications</Label>
            <p className="text-xs text-gray-500 mb-3">
              Select applicable certifications for this product
            </p>
            <div className="grid grid-cols-2 gap-3">
              {certifications.map((cert) => (
                <label
                  key={cert.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formCertificationIds.includes(cert.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormCertificationIds([...formCertificationIds, cert.id])
                      } else {
                        setFormCertificationIds(
                          formCertificationIds.filter((id) => id !== cert.id)
                        )
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{cert.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Types Section */}
        {types.length > 0 && (
          <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
            <Label className="text-base font-semibold">Types</Label>
            <p className="text-xs text-gray-500 mb-3">
              Select applicable transport types for this product
            </p>
            <div className="grid grid-cols-2 gap-3">
              {types.map((type) => (
                <label
                  key={type.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formTypeIds.includes(type.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormTypeIds([...formTypeIds, type.id])
                      } else {
                        setFormTypeIds(
                          formTypeIds.filter((id) => id !== type.id)
                        )
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{type.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

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
    logger.info("🎨 renderFormFields - certifications:", certifications.length)
    logger.info("🎨 renderFormFields - formCertificationIds:", formCertificationIds)
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
            value={sku}
            onChange={(e) => {
              const value = e.target.value.slice(0, 5) // Limita a 5 caratteri
              setSku(value)
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

        {/* Dynamic Categories Section */}
        {categories.length > 0 && (
          <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
            <Label className="text-base font-semibold">Categories</Label>
            <p className="text-xs text-gray-500 mb-3">
              Select categories for this product (optional)
            </p>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <label
                  key={cat.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formCategoryIds.includes(cat.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormCategoryIds([...formCategoryIds, cat.id])
                      } else {
                        setFormCategoryIds(formCategoryIds.filter(id => id !== cat.id))
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{cat.name}</span>
                </label>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFormCategoryIds([])}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear Selection
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Input
            id="region"
            name="region"
            placeholder="e.g., Sardinia, Sicily, Emilia-Romagna"
            defaultValue={product?.region || ""}
          />
          <p className="text-xs text-gray-500">
            Region of origin or production (optional, in English)
          </p>
        </div>

        {/* Product Characteristics (Key-Value) Section */}
        <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">Product Characteristics</Label>
              <p className="text-xs text-gray-500 mt-1">
                Add custom key-value attributes (e.g., superficie: 42mq, locali: 2, colore: rosso)
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCharacteristics([...characteristics, { name: '', value: '' }])
              }}
            >
              Add Characteristic
            </Button>
          </div>

          {characteristics.length > 0 && (
            <div className="space-y-2 mt-4">
              {characteristics.map((char, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      placeholder="Name (e.g., superficie, colore, taglia)"
                      value={char.name}
                      onChange={(e) => {
                        const newChars = [...characteristics]
                        newChars[index].name = e.target.value
                        setCharacteristics(newChars)
                      }}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder="Value (e.g., 42mq, rosso, L)"
                      value={char.value}
                      onChange={(e) => {
                        const newChars = [...characteristics]
                        newChars[index].value = e.target.value
                        setCharacteristics(newChars)
                      }}
                      className="text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setCharacteristics(characteristics.filter((_, i) => i !== index))
                    }}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {characteristics.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              No characteristics added yet. Click "Add Characteristic" to start.
            </p>
          )}
        </div>

        {/* Dynamic Certifications Section */}
        {certifications.length > 0 && (
          <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
            <Label className="text-base font-semibold">Certifications</Label>
            <p className="text-xs text-gray-500 mb-3">
              Select applicable certifications for this product
            </p>
            <div className="grid grid-cols-2 gap-3">
              {certifications.map((cert) => (
                <label
                  key={cert.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formCertificationIds.includes(cert.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormCertificationIds([...formCertificationIds, cert.id])
                      } else {
                        setFormCertificationIds(
                          formCertificationIds.filter((id) => id !== cert.id)
                        )
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{cert.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Types Section */}
        {types.length > 0 && (
          <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
            <Label className="text-base font-semibold">Types</Label>
            <p className="text-xs text-gray-500 mb-3">
              Select applicable transport types for this product
            </p>
            <div className="grid grid-cols-2 gap-3">
              {types.map((type) => (
                <label
                  key={type.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formTypeIds.includes(type.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormTypeIds([...formTypeIds, type.id])
                      } else {
                        setFormTypeIds(
                          formTypeIds.filter((id) => id !== type.id)
                        )
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{type.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

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
      <Card className="min-h-[calc(100vh-13.7rem)]">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className={commonStyles.headerIcon} />
                <h1 className="text-2xl font-bold text-green-600">Products</h1>
              </div>
              <div className="flex items-center gap-2">
                {/* Hidden file input for CSV import */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImport}
                  accept=".csv"
                  className="hidden"
                />
            
            {/* Export Button */}
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
            
            {/* Import Button */}
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? "Importing..." : "Import CSV"}
            </Button>
            
            {/* Add Product Button */}
            <Button
              onClick={() => {
                setSelectedCategoryId("none")
                setProductIsActive(true)
                setSku("")
                setShowAddSheet(true)
              }}
            >
              Add Product
            </Button>
          </div>
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

          {/* Sort By */}
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as "name" | "stock")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort by Name</SelectItem>
              <SelectItem value="stock">Sort by Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filters Panel - Compact Design */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          {/* Management Buttons Row */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCategoriesPanel(true)}
              className="text-xs h-7"
            >
              <Package className="h-3 w-3 mr-1" />
              Categories
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCertificationsPanel(true)}
              className="text-xs h-7"
            >
              <Award className="h-3 w-3 mr-1" />
              Certifications
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTypesPanel(true)}
              className="text-xs h-7"
            >
              <Truck className="h-3 w-3 mr-1" />
              Transport
            </Button>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2 items-center">
            {categories.length > 0 && (
              <>
                <span className="text-xs font-medium text-gray-500">Filter:</span>
                {categories.map((cat) => (
                  <label
                    key={cat.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                      selectedCategoryIds.includes(cat.id)
                        ? "bg-green-100 text-green-800 border border-green-300"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.includes(cat.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategoryIds([...selectedCategoryIds, cat.id])
                        } else {
                          setSelectedCategoryIds(selectedCategoryIds.filter((id) => id !== cat.id))
                        }
                      }}
                      className="sr-only"
                    />
                    <Package className="h-3 w-3" />
                    {cat.name}
                  </label>
                ))}
              </>
            )}
            {certifications.map((cert) => (
              <label
                key={cert.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                  selectedCertificationIds.includes(cert.id)
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCertificationIds.includes(cert.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCertificationIds([...selectedCertificationIds, cert.id])
                    } else {
                      setSelectedCertificationIds(selectedCertificationIds.filter((id) => id !== cert.id))
                    }
                  }}
                  className="sr-only"
                />
                <Award className="h-3 w-3" />
                {cert.name}
              </label>
            ))}
            {types.map((type) => (
              <label
                key={type.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                  selectedTypeIds.includes(type.id)
                    ? "bg-blue-100 text-blue-800 border border-blue-300"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTypeIds.includes(type.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTypeIds([...selectedTypeIds, type.id])
                    } else {
                      setSelectedTypeIds(selectedTypeIds.filter((id) => id !== type.id))
                    }
                  }}
                  className="sr-only"
                />
                <Truck className="h-3 w-3" />
                {type.name}
              </label>
            ))}
            {(selectedCategoryIds.length > 0 || selectedCertificationIds.length > 0 || selectedTypeIds.length > 0) && (
              <button
                onClick={() => {
                  setSelectedCategoryIds([])
                  setSelectedCertificationIds([])
                  setSelectedTypeIds([])
                }}
                className="text-xs text-gray-500 hover:text-gray-700 underline ml-2"
              >
                Clear all
              </button>
            )}
          </div>
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
                    {/* Sales Performance - REMOVED */}

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
                    <div>
                      <h3 className="font-semibold text-lg line-clamp-2 mb-1">
                        {product.name}
                      </h3>
                      {product.formato && (
                        <p className="text-xs text-muted-foreground mb-3">
                          {product.formato}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mb-2">
                        {product.code}
                      </p>
                      <p className="text-lg font-bold text-green-600 mb-2">
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
                      {product.region && (
                        <p className="text-xs text-muted-foreground">
                          📍 {product.region}
                        </p>
                      )}
                      {/* Certification Badges */}
                      {(product as any).productCertifications?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(product as any).productCertifications.map(
                            (pc: any) => (
                              <span
                                key={pc.certificationId}
                                className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full"
                              >
                                {pc.certification?.name}
                              </span>
                            )
                          )}
                        </div>
                      )}
                      {/* Type Badges */}
                      {(product as any).productTypes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(product as any).productTypes.map(
                            (pt: any) => (
                              <span
                                key={pt.typeId}
                                className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full"
                              >
                                🚚 {pt.type?.name}
                              </span>
                            )
                          )}
                        </div>
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
        </CardContent>
      </Card>

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

      {/* Certifications Management Panel */}
      <Sheet open={showCertificationsPanel} onOpenChange={setShowCertificationsPanel}>
        <SheetContent side="right" className="w-full sm:max-w-[800px]">
          <SheetHeader>
            <SheetTitle>Manage Certifications</SheetTitle>
            <SheetDescription>
              Add, edit, or delete product certifications
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Add Form */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-3">Add New Certification</h3>
              <form onSubmit={handleCertAdd} className="flex gap-2">
                <Input
                  placeholder="e.g., Bio, DOP, Vegan"
                  value={certAddFormName}
                  onChange={(e) => setCertAddFormName(e.target.value)}
                  maxLength={50}
                  required
                />
                <Button type="submit">Add</Button>
              </form>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">
                Certifications ({filteredCerts.length})
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredCerts.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No certifications found
                  </p>
                ) : (
                  filteredCerts.map((cert) => (
                    <div
                      key={cert.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{cert.name}</p>
                        {cert._count?.productCertifications !== undefined && (
                          <p className="text-xs text-gray-500">
                            Used by {cert._count.productCertifications} product(s)
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCertEdit(cert)}
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCertDelete(cert)}
                          disabled={
                            cert._count?.productCertifications &&
                            cert._count.productCertifications > 0
                          }
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Certification Edit Sheet */}
      <Sheet open={showCertEdit} onOpenChange={setShowCertEdit}>
        <SheetContent side="right" className="w-full sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Edit Certification</SheetTitle>
            <SheetDescription>
              Update certification information
            </SheetDescription>
          </SheetHeader>
          {selectedCert && (
            <form onSubmit={handleCertEditSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="cert-edit-name">Certification Name *</Label>
                <Input
                  id="cert-edit-name"
                  name="name"
                  defaultValue={selectedCert.name}
                  placeholder="e.g., Bio, DOP, Vegan"
                  required
                  maxLength={50}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  Update Certification
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCertEdit(false)
                    setSelectedCert(null)
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Certification Delete Dialog */}
      <ConfirmDialog
        open={showCertDelete}
        onOpenChange={setShowCertDelete}
        onConfirm={confirmCertDelete}
        title="Delete Certification"
        description={
          selectedCert
            ? `Are you sure you want to delete "${selectedCert.name}"? ${
                selectedCert._count?.productCertifications
                  ? `This certification is used by ${selectedCert._count.productCertifications} product(s) and cannot be deleted.`
                  : "This action cannot be undone."
              }`
            : ""
        }
      />

      {/* Types Management Panel */}
      <Sheet open={showTypesPanel} onOpenChange={setShowTypesPanel}>
        <SheetContent side="right" className="w-full sm:max-w-[800px]">
          <SheetHeader>
            <SheetTitle>Manage Types</SheetTitle>
            <SheetDescription>
              Add, edit, or delete transport types for products
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Add Form */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-3">Add New Type</h3>
              <form onSubmit={handleTtAdd} className="flex gap-2">
                <Input
                  placeholder="e.g., Air, Sea, Land, Rail"
                  value={ttAddFormName}
                  onChange={(e) => setTtAddFormName(e.target.value)}
                  maxLength={50}
                  required
                />
                <Button type="submit">Add</Button>
              </form>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">
                Types ({filteredTts.length})
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredTts.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No transport types found
                  </p>
                ) : (
                  filteredTts.map((tt) => (
                    <div
                      key={tt.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{tt.name}</p>
                        {tt._count?.productTypes !== undefined && (
                          <p className="text-xs text-gray-500">
                            Used by {tt._count.productTypes} product(s)
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTtEdit(tt)}
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTtDelete(tt)}
                          disabled={
                            tt._count?.productTypes &&
                            tt._count.productTypes > 0
                          }
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Type Edit Sheet */}
      <Sheet open={showTtEdit} onOpenChange={setShowTtEdit}>
        <SheetContent side="right" className="w-full sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Edit Type</SheetTitle>
            <SheetDescription>
              Update transport type information
            </SheetDescription>
          </SheetHeader>
          {selectedTt && (
            <form onSubmit={handleTtEditSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="tt-edit-name">Type Name *</Label>
                <Input
                  id="tt-edit-name"
                  name="name"
                  defaultValue={selectedTt.name}
                  placeholder="e.g., Air, Sea, Land, Rail"
                  required
                  maxLength={50}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  Update Type
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowTtEdit(false)
                    setSelectedTt(null)
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Type Delete Dialog */}
      <ConfirmDialog
        open={showTtDelete}
        onOpenChange={setShowTtDelete}
        onConfirm={confirmTtDelete}
        title="Delete Type"
        description={
          selectedTt
            ? `Are you sure you want to delete "${selectedTt.name}"? ${
                selectedTt._count?.productTypes
                  ? `This transport type is used by ${selectedTt._count.productTypes} product(s) and cannot be deleted.`
                  : "This action cannot be undone."
              }`
            : ""
        }
      />

      {/* Categories Management Panel */}
      <Sheet open={showCategoriesPanel} onOpenChange={setShowCategoriesPanel}>
        <SheetContent side="right" className="w-full sm:max-w-[800px]">
          <SheetHeader>
            <SheetTitle>Manage Categories</SheetTitle>
            <SheetDescription>
              Add, edit, or delete product categories
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Add Form */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-3">Add New Category</h3>
              <form onSubmit={handleCatAdd} className="flex gap-2">
                <Input
                  placeholder="e.g., Cheese, Wine, Pasta"
                  value={catAddFormName}
                  onChange={(e) => setCatAddFormName(e.target.value)}
                  maxLength={50}
                  required
                />
                <Button type="submit">Add</Button>
              </form>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">
                Categories ({filteredCats.length})
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredCats.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No categories found
                  </p>
                ) : (
                  filteredCats.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{cat.name}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCatEdit(cat)}
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCatDelete(cat)}
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Category Edit Sheet */}
      <Sheet open={showCatEdit} onOpenChange={setShowCatEdit}>
        <SheetContent side="right" className="w-full sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Edit Category</SheetTitle>
            <SheetDescription>
              Update category information
            </SheetDescription>
          </SheetHeader>
          {selectedCat && (
            <form onSubmit={handleCatEditSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="cat-edit-name">Category Name *</Label>
                <Input
                  id="cat-edit-name"
                  name="name"
                  defaultValue={selectedCat.name}
                  placeholder="e.g., Cheese, Wine, Pasta"
                  required
                  maxLength={50}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  Update Category
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCatEdit(false)
                    setSelectedCat(null)
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Category Delete Dialog */}
      <ConfirmDialog
        open={showCatDelete}
        onOpenChange={setShowCatDelete}
        onConfirm={confirmCatDelete}
        title="Delete Category"
        description={
          selectedCat
            ? `Are you sure you want to delete "${selectedCat.name}"? This action cannot be undone.`
            : ""
        }
      />
    </PageLayout>
  )
}
