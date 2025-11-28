import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { FormDialog } from "@/components/shared/FormDialog"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { useState } from "react"

interface Language {
  id: string
  name: string
  code: string
  status: "active" | "inactive"
}

const initialLanguages: Language[] = [
  {
    id: "1",
    name: "Spanish",
    code: "es",
    status: "active",
  },
  {
    id: "2",
    name: "English",
    code: "en",
    status: "inactive",
  },
  {
    id: "3",
    name: "Italian",
    code: "it",
    status: "inactive",
  },
]

export function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>(initialLanguages)
  const [searchValue, setSearchValue] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(
    null
  )

  const filteredLanguages = languages.filter((language) =>
    Object.values(language).some((value) =>
      value.toString().toLowerCase().includes(searchValue.toLowerCase())
    )
  )

  const handleToggleStatus = (language: Language) => {
    if (language.status === "inactive") {
      setLanguages(
        languages.map((l) => ({
          ...l,
          status: l.id === language.id ? "active" : "inactive",
        }))
      )
    }
  }

  const columns = [
    { header: "Name", accessorKey: "name" as keyof Language },
    { header: "Code", accessorKey: "code" as keyof Language },
    {
      header: "Status",
      accessorKey: "status" as keyof Language,
      cell: ({ row }: { row: { original: Language } }) => (
        <Button
          variant={row.original.status === "active" ? "default" : "outline"}
          onClick={() => handleToggleStatus(row.original)}
          className="w-24 cursor-pointer"
        >
          <StatusBadge status={row.original.status}>
            {row.original.status.charAt(0).toUpperCase() +
              row.original.status.slice(1)}
          </StatusBadge>
        </Button>
      ),
    },
  ]

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const newLanguage: Language = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.get("name") as string,
      code: formData.get("code") as string,
      status: "inactive",
    }

    setLanguages([...languages, newLanguage])
    setShowAddDialog(false)
  }

  const handleEdit = (language: Language) => {
    setSelectedLanguage(language)
    setShowEditDialog(true)
  }

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedLanguage) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const updatedLanguage: Language = {
      ...selectedLanguage,
      name: formData.get("name") as string,
      code: formData.get("code") as string,
      status: selectedLanguage.status,
    }

    setLanguages(
      languages.map((l) => (l.id === selectedLanguage.id ? updatedLanguage : l))
    )
    setShowEditDialog(false)
    setSelectedLanguage(null)
  }

  const handleDelete = (language: Language) => {
    if (
      language.status === "active" &&
      languages.filter((l) => l.status === "active").length === 1
    ) {
      alert("Cannot delete the only active language")
      return
    }
    setSelectedLanguage(language)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = () => {
    if (!selectedLanguage) return
    setLanguages(languages.filter((l) => l.id !== selectedLanguage.id))
    setShowDeleteDialog(false)
    setSelectedLanguage(null)
  }

  return (
    <div className="container mx-auto py-6">
      <Alert className="mb-6 bg-pink-50 border border-pink-200 text-pink-800">
        <AlertCircle className="h-5 w-5 text-pink-500" />
        <AlertDescription className="ml-2 text-sm font-medium">
          Only one language can be active at a time. Setting a language as
          active will automatically deactivate all others.
        </AlertDescription>
      </Alert>

      <PageHeader
        title="Languages"
        searchValue={searchValue}
        onSearch={setSearchValue}
        searchPlaceholder="Search languages..."
        onAdd={() => setShowAddDialog(true)}
        itemCount={filteredLanguages.length}
      />

      <div className="mt-6">
        <DataTable
          data={filteredLanguages}
          columns={columns}
          globalFilter={searchValue}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <FormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        title="Add New Language"
        fields={[
          {
            name: "name",
            label: "Name",
            type: "text",
          },
          {
            name: "code",
            label: "Code",
            type: "text",
          },
        ]}
        onSubmit={handleAdd}
      />

      <FormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        title="Edit Language"
        fields={[
          {
            name: "name",
            label: "Name",
            type: "text",
            defaultValue: selectedLanguage?.name,
          },
          {
            name: "code",
            label: "Code",
            type: "text",
            defaultValue: selectedLanguage?.code,
          },
        ]}
        onSubmit={handleEditSubmit}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Language"
        description={`Are you sure you want to delete ${selectedLanguage?.name}? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
