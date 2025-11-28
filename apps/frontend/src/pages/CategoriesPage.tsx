import { PageLayout } from "@/components/layout/PageLayout"
import { FolderTree } from "lucide-react"
import { useEffect, useState } from "react"
import { DataTable } from "../components/ui/data-table"
import { PageHeader } from "../components/ui/page-header"

export function CategoriesPage() {
  // Stato per la ricerca
  const [searchValue, setSearchValue] = useState("")
  // Stato per le categorie
  const [categories, setCategories] = useState<any[]>([])
  // Stato per il dialog di aggiunta
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)

  // Definizione colonne (placeholder, da personalizzare)
  const columns = [] // TODO: Definisci le colonne per DataTable

  // Effetto per caricare le categorie (placeholder fetch)
  useEffect(() => {
    // TODO: Sostituisci con la fetch reale delle categorie
    setCategories([])
  }, [])

  // Filtra le categorie in base alla ricerca
  const filteredCategories = categories.filter((cat) =>
    cat.name?.toLowerCase().includes(searchValue.toLowerCase())
  )

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
              />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
