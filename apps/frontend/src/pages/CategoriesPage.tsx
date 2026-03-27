import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { categoriesApi, type Category } from "@/services/categoriesApi"
import { FolderTree } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

export function CategoriesPage() {
  // Stato per la ricerca
  const [searchValue, setSearchValue] = useState("")
  // Stato per le categorie
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  // Stato per il dialog di aggiunta
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const { workspace } = useWorkspace()

  const loadCategories = async () => {
    if (!workspace?.id) return
    try {
      setLoading(true)
      const response = await categoriesApi.getAllForWorkspace(workspace.id)
      setCategories(response || [])
    } catch (error) {
      logger.error("Error loading categories:", error)
      toast.error("Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCategories()
  }, [workspace?.id])

  // Filtra le categorie in base alla ricerca
  const filteredCategories = useMemo(() => {
    if (!searchValue.trim()) return categories
    const term = searchValue.toLowerCase()
    return categories.filter((cat) =>
      `${cat.name} ${cat.description || ""}`.toLowerCase().includes(term)
    )
  }, [categories, searchValue])

  const columns = [
    { header: "Name", accessorKey: "name" as const },
    { header: "Description", accessorKey: "description" as const },
    { header: "Status", accessorKey: "isActive" as const },
    { header: "Slug", accessorKey: "slug" as const },
  ]

  return (
    <PageLayout>
      <div className="container pl-0 pr-4 pt-4 pb-4">
        <div className="grid grid-cols-12 gap-0">
          <div className="col-span-11 col-start-1">
            <PageHeader
              title="Categories"
              titleIcon={<FolderTree className="mr-2 h-6 w-6 text-green-500" />}
              searchValue={searchValue}
              onSearch={setSearchValue}
              searchPlaceholder="Search categories..."
              itemCount={categories.length}
              onAdd={() => setShowAddCategoryDialog(true)}
              addButtonText="Add"
            />

            <div className="mt-6 w-full">
              <DataTable
                columns={columns}
                data={filteredCategories}
                globalFilter={searchValue}
                isLoading={loading}
              />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
