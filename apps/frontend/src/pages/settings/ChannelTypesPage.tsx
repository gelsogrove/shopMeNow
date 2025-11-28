import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { FormDialog } from "@/components/shared/FormDialog"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { useState } from "react"

interface ChannelType {
  id: string
  name: string
  code: string
  status: "active" | "inactive"
}

const initialChannelTypes: ChannelType[] = [
  {
    id: "1",
    name: "WhatsApp",
    code: "whatsapp",
    status: "active",
  },
  {
    id: "2",
    name: "Messenger",
    code: "messenger",
    status: "active",
  },
  {
    id: "3",
    name: "Instagram",
    code: "instagram",
    status: "inactive",
  },
]

export function ChannelTypesPage() {
  const [channelTypes, setChannelTypes] = useState<ChannelType[]>(initialChannelTypes)
  const [searchValue, setSearchValue] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedChannelType, setSelectedChannelType] = useState<ChannelType | null>(
    null
  )

  const filteredChannelTypes = channelTypes.filter((channelType) =>
    Object.values(channelType).some((value) =>
      value.toString().toLowerCase().includes(searchValue.toLowerCase())
    )
  )

  const handleToggleStatus = (channelType: ChannelType) => {
    setChannelTypes(
      channelTypes.map((c) => ({
        ...c,
        status: c.id === channelType.id 
          ? (c.status === "active" ? "inactive" : "active")
          : c.status,
      }))
    )
  }

  const columns = [
    { header: "Name", accessorKey: "name" as keyof ChannelType },
    { header: "Code", accessorKey: "code" as keyof ChannelType },
    {
      header: "Status",
      accessorKey: "status" as keyof ChannelType,
      cell: ({ row }: { row: { original: ChannelType } }) => (
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

    const newChannelType: ChannelType = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.get("name") as string,
      code: formData.get("code") as string,
      status: "inactive",
    }

    setChannelTypes([...channelTypes, newChannelType])
    setShowAddDialog(false)
  }

  const handleEdit = (channelType: ChannelType) => {
    setSelectedChannelType(channelType)
    setShowEditDialog(true)
  }

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedChannelType) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const updatedChannelType: ChannelType = {
      ...selectedChannelType,
      name: formData.get("name") as string,
      code: formData.get("code") as string,
      status: selectedChannelType.status,
    }

    setChannelTypes(
      channelTypes.map((c) => (c.id === selectedChannelType.id ? updatedChannelType : c))
    )
    setShowEditDialog(false)
    setSelectedChannelType(null)
  }

  const handleDelete = (channelType: ChannelType) => {
    setSelectedChannelType(channelType)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = () => {
    if (!selectedChannelType) return
    setChannelTypes(channelTypes.filter((c) => c.id !== selectedChannelType.id))
    setShowDeleteDialog(false)
    setSelectedChannelType(null)
  }

  return (
    <div className="container mx-auto py-6">
      <Alert className="mb-6 bg-blue-50 border border-blue-200 text-blue-800">
        <AlertCircle className="h-5 w-5 text-blue-500" />
        <AlertDescription className="ml-2 text-sm font-medium">
          Channel types determine the communication channels available in your workspace.
        </AlertDescription>
      </Alert>

      <PageHeader
        title="Channel Types"
        searchValue={searchValue}
        onSearch={setSearchValue}
        searchPlaceholder="Search channel types..."
        onAdd={() => setShowAddDialog(true)}
        itemCount={filteredChannelTypes.length}
      />

      <div className="mt-6">
        <DataTable
          data={filteredChannelTypes}
          columns={columns}
          globalFilter={searchValue}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <FormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        title="Add New Channel Type"
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
        title="Edit Channel Type"
        fields={[
          {
            name: "name",
            label: "Name",
            type: "text",
            defaultValue: selectedChannelType?.name,
          },
          {
            name: "code",
            label: "Code",
            type: "text",
            defaultValue: selectedChannelType?.code,
          },
        ]}
        onSubmit={handleEditSubmit}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Channel Type"
        description={`Are you sure you want to delete ${selectedChannelType?.name}? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
