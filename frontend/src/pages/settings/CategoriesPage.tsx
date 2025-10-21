import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { FormDialog } from "@/components/shared/FormDialog"
import { PageHeader } from "@/components/shared/PageHeader"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { categoriesApi, Category } from "@/services/categoriesApi"
import { useEffect, useState } from "react"
import { toast } from "../../lib/toast"

export function CategoriesPage() {
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  )

  useEffect(() => {
    const loadCategories = async () => {
      if (!workspace?.id) return
      try {
        const data = await categoriesApi.getAllForWorkspace(workspace.id)
        setCategories(data)
      } catch (error) {
        logger.error("Error loading categories:", error)
        toast.error("Failed to load categories")
      } finally {
        setIsLoading(false)
      }
    }

    if (!isLoadingWorkspace) {
      loadCategories()
    }
  }, [workspace?.id, isLoadingWorkspace])

  const filteredCategories = categories.filter((category) =>
    Object.values(category).some((value) =>
      value.toString().toLowerCase().includes(searchValue.toLowerCase())
    )
  )

  const columns = [
    { header: "Name", accessorKey: "name" as keyof Category },
    { header: "Description", accessorKey: "description" as keyof Category },
  ]

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
    }

    try {
      const newCategory = await categoriesApi.create(workspace.id, data)
      setCategories([...categories, newCategory])
      setShowAddDialog(false)
      toast.success("Category created successfully")
    } catch (error) {
      logger.error("Error creating category:", error)
      toast.error("Failed to create category")
    }
  }

  const handleEdit = (category: Category) => {
    setSelectedCategory(category)
    setShowEditDialog(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedCategory || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
    }

    try {
      const updatedCategory = await categoriesApi.update(
        selectedCategory.id,
        workspace.id,
        data
      )
      setCategories(
        categories.map((c) =>
          c.id === selectedCategory.id ? updatedCategory : c
        )
      )
      setShowEditDialog(false)
      setSelectedCategory(null)
      toast.success("Category updated successfully")
    } catch (error) {
      logger.error("Error updating category:", error)
      toast.error("Failed to update category")
    }
  }

  const handleDelete = (category: Category) => {
    setSelectedCategory(category)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedCategory || !workspace?.id) return

    try {
      await categoriesApi.delete(selectedCategory.id, workspace.id)
      setCategories(categories.filter((c) => c.id !== selectedCategory.id))
      setShowDeleteDialog(false)
      setSelectedCategory(null)
      toast.success("Category deleted successfully")
    } catch (error) {
      logger.error("Error deleting category:", error)
      toast.error("Failed to delete category")
    }
  }

  if (isLoadingWorkspace || isLoading) {
    return <div>Loading...</div>
  }

  if (!workspace?.id) {
    return <div>No workspace selected</div>
  }

  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Categories"
        searchValue={searchValue}
        onSearch={setSearchValue}
        searchPlaceholder="Search categories..."
        onAdd={() => setShowAddDialog(true)}
      />

      <div className="mt-6">
        <DataTable
          data={filteredCategories}
          columns={columns}
          globalFilter={searchValue}
          onEdit={handleEdit}
          onDelete={handleDelete}
          disablePagination={true}
        />
      </div>

      <FormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        title="Add New Category"
        fields={[
          {
            name: "name",
            label: "Name",
            type: "text",
          },
          {
            name: "description",
            label: "Description",
            type: "text",
          },
        ]}
        onSubmit={handleAdd}
      />

      <FormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        title="Edit Category"
        fields={[
          {
            name: "name",
            label: "Name",
            type: "text",
            defaultValue: selectedCategory?.name,
          },
          {
            name: "description",
            label: "Description",
            type: "text",
            defaultValue: selectedCategory?.description,
          },
        ]}
        onSubmit={handleEditSubmit}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Category"
        description={`Are you sure you want to delete ${selectedCategory?.name}? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
