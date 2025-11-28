import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { FormDialog } from "@/components/shared/FormDialog"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ColumnDef } from "@tanstack/react-table"
import { MessageSquare } from "lucide-react"
import { useState } from "react"

interface User {
  id: string
  name: string
  email: string
  role: string
  status: "active" | "inactive"
}

interface ChatMessage {
  id: string
  userId: string
  message: string
  timestamp: string
  type: "sent" | "received"
}

const initialUsers: User[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    role: "Admin",
    status: "active",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "Editor",
    status: "active",
  },
]

const mockChatHistory: ChatMessage[] = [
  {
    id: "1",
    userId: "1",
    message: "Hello, how can I help you?",
    timestamp: "2024-03-20T10:00:00Z",
    type: "received",
  },
  {
    id: "2",
    userId: "1",
    message: "I need help with my order",
    timestamp: "2024-03-20T10:01:00Z",
    type: "sent",
  },
  {
    id: "3",
    userId: "1",
    message: "Sure, what's your order number?",
    timestamp: "2024-03-20T10:02:00Z",
    type: "received",
  },
]

export function UsersPage() {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [searchValue, setSearchValue] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showChatDialog, setShowChatDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [chatHistory] = useState<ChatMessage[]>(mockChatHistory)

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "role",
      header: "Role",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status}>
          {row.original.status.charAt(0).toUpperCase() +
            row.original.status.slice(1)}
        </StatusBadge>
      ),
    },
  ]

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as string,
      status: "active",
    }

    setUsers([...users, newUser])
    setShowAddDialog(false)
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setShowEditDialog(true)
  }

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedUser) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const updatedUser: User = {
      ...selectedUser,
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as string,
    }

    setUsers(users.map((u) => (u.id === selectedUser.id ? updatedUser : u)))
    setShowEditDialog(false)
    setSelectedUser(null)
  }

  const handleDelete = (user: User) => {
    setSelectedUser(user)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = () => {
    if (!selectedUser) return
    setUsers(users.filter((u) => u.id !== selectedUser.id))
    setShowDeleteDialog(false)
    setSelectedUser(null)
  }

  const handleViewChat = (user: User) => {
    setSelectedUser(user)
    setShowChatDialog(true)
  }

  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Users"
        searchValue={searchValue}
        onSearch={setSearchValue}
        searchPlaceholder="Search users..."
        onAdd={() => setShowAddDialog(true)}
        addButtonText="Add"
        itemCount={users.length}
      />

      <div className="mt-6">
        <DataTable<User>
          data={users}
          columns={columns}
          globalFilter={searchValue}
          onEdit={handleEdit}
          onDelete={handleDelete}
          renderActions={(user) => (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleViewChat(user)}
              className="hover:bg-blue-50"
            >
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </Button>
          )}
        />
      </div>

      <FormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        title="Add New User"
        fields={[
          {
            name: "name",
            label: "Name",
            type: "text",
          },
          {
            name: "email",
            label: "Email",
            type: "text",
          },
          {
            name: "role",
            label: "Role",
            type: "select",
            options: ["Admin", "Editor", "Viewer"],
          },
        ]}
        onSubmit={handleAdd}
      />

      <FormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        title="Edit User"
        fields={[
          {
            name: "name",
            label: "Name",
            type: "text",
            defaultValue: selectedUser?.name,
          },
          {
            name: "email",
            label: "Email",
            type: "text",
            defaultValue: selectedUser?.email,
          },
          {
            name: "role",
            label: "Role",
            type: "select",
            options: ["Admin", "Editor", "Viewer"],
            defaultValue: selectedUser?.role,
          },
        ]}
        onSubmit={handleEditSubmit}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete User"
        description={`Are you sure you want to delete ${selectedUser?.name}? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />

      <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Chat History - {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {chatHistory
              .filter((msg) => msg.userId === selectedUser?.id)
              .map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.type === "sent" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      msg.type === "sent"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {new Date(msg.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
