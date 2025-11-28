import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { logger } from "@/lib/logger"
import { DataTable } from "@/components/shared/DataTable"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { PageHeader } from "@/components/shared/PageHeader"
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
import {
    categoriesApi,
  type Category as ApiCategory,
} from "@/services/categoriesApi"
import { Tag } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../../lib/toast"

// Interfaccia locale che estende quella dell'API
interface Category extends Omit<ApiCategory, "description"> {
  description: string
}

export default function CategoriesPage() {
  const { workspace } = useWorkspace()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  )
  const [hasAssociatedProducts, setHasAssociatedProducts] = useState(false)

  useEffect(() => {
    if (workspace?.id) {
      loadCategories()
    }
  }, [workspace?.id])

  const loadCategories = async () => {
    if (!workspace?.id) return

    try {
      setLoading(true)
      const response = await categoriesApi.getAllForWorkspace(workspace.id)
      // Ci assicuriamo che tutti gli elementi abbiano description come stringa
      const formattedCategories: Category[] = response.map((cat) => ({
        ...cat,
        description: cat.description || "",
      }))
      setCategories(formattedCategories || [])
    } catch (error) {
      logger.error("Error loading categories:", error)
      toast.error("Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

  const filteredCategories = categories.filter((category) =>
    Object.values(category).some((value) =>
      value?.toString().toLowerCase().includes(searchValue.toLowerCase())
    )
  )

  const columns = [
    { header: "Name", accessorKey: "name" as keyof Category, size: 200 },
    {
      header: "Description",
      accessorKey: "description" as keyof Category,
      size: 400,
    },
  ]

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const name = formData.get("name") as string
    const description = formData.get("description") as string

    if (!name || !description) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      const newCategory = await categoriesApi.create(workspace.id, {
        name,
        description,
        isActive: true,
      } as any) // Usiamo 'as any' per bypassare la verifica di tipo temporaneamente

      toast.success("Category added successfully")
      setShowAddSheet(false)
      await loadCategories()
    } catch (error) {
      logger.error("Error adding category:", error)
      toast.error("Failed to add category")
    }
  }

  const handleEdit = (category: Category) => {
    setSelectedCategory(category)
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedCategory?.id || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const name = formData.get("name") as string
    const description = formData.get("description") as string

    if (!name || !description) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      const response = await categoriesApi.update(
        selectedCategory.id,
        workspace.id,
        {
          name,
          description,
        }
      )

      toast.success("Category updated successfully")
      setShowEditSheet(false)
      setSelectedCategory(null)
      await loadCategories()
    } catch (error) {
      logger.error("Error updating category:", error)
      toast.error("Failed to update category")
    }
  }

  const handleDelete = async (category: Category) => {
    setSelectedCategory(category)

    if (!workspace?.id) return

    try {
      // Verifichiamo se la categoria ha prodotti associati
      const hasProducts = await categoriesApi.hasProducts(
        category.id,
        workspace.id
      )
      setHasAssociatedProducts(hasProducts)
      setShowDeleteDialog(true)
    } catch (error) {
      logger.error("Error checking if category has products:", error)
      toast.error("Failed to check category products")
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedCategory?.id || !workspace?.id) return

    // Se la categoria ha prodotti associati, non consentiamo l'eliminazione
    if (hasAssociatedProducts) {
      setShowDeleteDialog(false)
      toast.error(
        "Cannot delete this category as it has associated products. Please remove or reassign the products first."
      )
      return
    }

    try {
      await categoriesApi.delete(selectedCategory.id, workspace.id)
      toast.success("Category deleted successfully")
      setShowDeleteDialog(false)
      setSelectedCategory(null)
      await loadCategories()
    } catch (error) {
      logger.error("Error deleting category:", error)
      toast.error("Failed to delete category")
    }
  }

  if (loading) {
    return (
      <div className="container flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-2">
          <LoadingSpinner />
          <p className="text-lg font-medium">Loading categories...</p>
        </div>
      </div>
    )
  }

  const renderForm = (category: Category | null = null) => (
    <form
      onSubmit={category ? handleEditSubmit : handleAdd}
      className="space-y-6 pt-6"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={category?.name}
          placeholder="Category name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={category?.description}
          placeholder="Category description"
          required
        />
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" className="bg-green-600 hover:bg-green-700">
          {category ? "Save Changes" : "Add"}
        </Button>
      </div>
    </form>
  )

  return (
    <div className="container pl-0 pr-4 pt-4 pb-4">
      <div className="grid grid-cols-12 gap-0">
        <div className="col-span-11 col-start-1">
          <PageHeader
            title="Categories"
            titleIcon={<Tag className="mr-2 h-6 w-6 text-green-500" />}
            searchValue={searchValue}
            onSearch={setSearchValue}
            searchPlaceholder="Search categories..."
            itemCount={filteredCategories.length}
            onAdd={() => setShowAddSheet(true)}
            addButtonText="Add"
          />

          <div className="mt-6 w-full">
            <DataTable
              columns={columns}
              data={filteredCategories}
              onEdit={handleEdit}
              onDelete={handleDelete}
              globalFilter={searchValue}
            />
          </div>
        </div>
      </div>

      {/* Add Category Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="right" className="w-[25%]">
          <SheetHeader>
            <SheetTitle>Add</SheetTitle>
            <SheetDescription>
              Add a new category to your workspace
            </SheetDescription>
          </SheetHeader>
          {renderForm()}
        </SheetContent>
      </Sheet>

      {/* Edit Category Sheet */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent side="right" className="w-[25%]">
          <SheetHeader>
            <SheetTitle>Edit Category</SheetTitle>
            <SheetDescription>
              Make changes to your category here
            </SheetDescription>
          </SheetHeader>
          {selectedCategory && renderForm(selectedCategory)}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={
          hasAssociatedProducts ? "Cannot Delete Category" : "Delete Category"
        }
        description={
          hasAssociatedProducts
            ? `The category "${selectedCategory?.name}" has products associated with it.\nYou need to remove or reassign these products before deleting this category.`
            : `Are you sure you want to delete ${selectedCategory?.name}? This action cannot be undone.`
        }
        onConfirm={handleDeleteConfirm}
        confirmLabel={hasAssociatedProducts ? "Understood" : "Delete"}
        variant={hasAssociatedProducts ? "secondary" : "destructive"}
      />
    </div>
  )
}
