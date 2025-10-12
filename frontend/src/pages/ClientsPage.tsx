import { ClientSheet } from "@/components/shared/ClientSheet"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { WhatsAppChatModal } from "@/components/shared/WhatsAppChatModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useChatList } from "@/contexts/ChatListContext"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { commonStyles } from "@/styles/common"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import {
  Bot,
  MessageSquare,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

// Shared interfaces
export interface ShippingAddress {
  street: string
  city: string
  zip: string
  country: string
}

// Invoice address interface
export interface InvoiceAddress {
  firstName?: string
  lastName?: string
  company?: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
  vatNumber?: string
  phone?: string
}

export interface Client {
  id: string
  name: string
  email: string
  company: string
  discount: number
  phone: string
  language: string
  notes?: string
  shippingAddress: ShippingAddress
  workspaceId?: string
  createdAt?: string
  updatedAt?: string
  last_privacy_version_accepted?: string
  push_notifications_consent?: boolean
  activeChatbot?: boolean
  invoiceAddress?: InvoiceAddress
  isBlacklisted?: boolean
}

const availableLanguages = ["Español", "English", "Italiano", "Português"]

// Effettua il parsing dell'indirizzo da una stringa
const parseAddress = (addressStr?: string | null): ShippingAddress => {
  if (!addressStr) {
    return { street: "", city: "", zip: "", country: "" }
  }

  try {
    // Prova a fare il parsing come JSON
    const parsed = JSON.parse(addressStr)
    if (typeof parsed === "object") {
      return {
        street: parsed.street || "",
        city: parsed.city || "",
        zip: parsed.zip || "",
        country: parsed.country || "",
      }
    }
  } catch (e) {
    // Se non è JSON, lo trattiamo come indirizzo semplice
    logger.warn("Failed to parse address as JSON:", addressStr)
  }

  // Default o fallback se il parsing fallisce
  return {
    street: addressStr,
    city: "",
    zip: "",
    country: "",
  }
}

// Converte un oggetto indirizzo in stringa
const stringifyAddress = (address: ShippingAddress): string => {
  return JSON.stringify(address)
}

export default function ClientsPage(): JSX.Element {
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [searchValue, setSearchValue] = useState("")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientSheetOpen, setClientSheetOpen] = useState(false)
  const [clientSheetMode, setClientSheetMode] = useState<"view" | "edit">(
    "view"
  )
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Stati per il dialogo di conferma eliminazione
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)
  const { chats: allChats } = useChatList()
  const [showPlayground, setShowPlayground] = useState(false)

  // Replace with useQuery
  const {
    data: clients = [],
    isLoading: isLoadingClients,
    isError,
    refetch: refetchClients,
  } = useQuery({
    queryKey: ["clients", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return []
      const customersResponse = await api.get(
        `/workspaces/${workspace.id}/customers`
      )
      const customersData =
        customersResponse.data.data || customersResponse.data

      // Map the client data
      const mappedClients = customersData.map((customer: any) => ({
        id: customer.id || "",
        name: customer.name || "",
        email: customer.email || "",
        company: customer.company || "",
        discount: customer.discount || 0,
        phone: customer.phone || "",
        language: customer.language || "English",
        notes: customer.notes || "",
        shippingAddress: parseAddress(customer.address),
        workspaceId: customer.workspaceId,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        last_privacy_version_accepted: customer.last_privacy_version_accepted,
        push_notifications_consent: customer.push_notifications_consent,
        activeChatbot:
          customer.activeChatbot !== undefined ? customer.activeChatbot : true,
        invoiceAddress: customer.invoiceAddress || undefined,
        isBlacklisted: customer.isBlacklisted || false,
      }))

      // Sort clients by ID in descending order (newer clients at the top)
      return mappedClients.sort((a: Client, b: Client) => {
        // If IDs are UUIDs or contain non-numeric characters, compare them as strings
        if (a.id > b.id) return -1
        if (a.id < b.id) return 1
        return 0
      })
    },
    enabled: !!workspace?.id,
  })

  // Controlla se c'è un parametro edit nell'URL per aprire automaticamente il form di modifica
  useEffect(() => {
    const clientIdToEdit = searchParams.get("edit")
    const sourceParam = searchParams.get("source")

    if (clientIdToEdit && clients.length > 0) {
      const clientToEdit = clients.find(
        (client: Client) => client.id === clientIdToEdit
      )

      if (clientToEdit) {
        logger.info("Opening client edit form for:", clientToEdit.name)
        setSelectedClient(clientToEdit)
        setClientSheetMode("edit")
        setClientSheetOpen(true)
      }
    }
  }, [clients, searchParams, navigate])

  // Use isLoading and clients from useQuery for rendering and filtering
  const filteredClients = clients.filter(
    (client: Client) =>
      client.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      client.email.toLowerCase().includes(searchValue.toLowerCase()) ||
      client.company.toLowerCase().includes(searchValue.toLowerCase()) ||
      client.phone.toLowerCase().includes(searchValue.toLowerCase())
  )

  // Handle sheet submission for new client
  const handleCreateClient = async (customerData: any) => {
    if (!workspace?.id) return

    try {
      // Create client in API
      const response = await api.post(
        `/workspaces/${workspace.id}/customers`,
        customerData
      )
      const newCustomer = response.data

      if (newCustomer) {
        // Add the new client to state with converted format
        await refetchClients()
        toast.success("Client created successfully", { duration: 1000 })

        // Close the form AFTER refetch completes
        setClientSheetOpen(false)
      }
    } catch (error) {
      logger.error("Error creating client:", error)
      toast.error("Failed to create client", { duration: 1000 })
    }
  }

  // Handle client form submission (create or update)
  const handleClientSubmit = (customerData: any, clientId?: string) => {
    if (clientId) {
      // Edit existing client
      handleUpdateClient(customerData, clientId)
    } else {
      // Create new client
      handleCreateClient(customerData)
    }
  }

  // Handle update client
  const handleUpdateClient = async (customerData: any, clientId: string) => {
    if (!workspace?.id) return

    try {
      console.log("=== FRONTEND UPDATE DEBUG ===")
      console.log("customerData.salesId:", customerData.salesId)
      console.log("Full customerData:", customerData)
      console.log("============================")

      logger.info("Updating customer with data:", customerData)
      logger.info("Customer ID:", clientId)
      logger.info("Workspace ID:", workspace.id)

      // Import the API functions
      const { update } = await import("@/services/clientsApi")

      // Update client using the clientsApi
      const updatedCustomer = await update(clientId, workspace.id, customerData)

      logger.info("Response from update API:", updatedCustomer)

      if (updatedCustomer) {
        // Update client in state with correct format and preserve existing data not returned by API
        await refetchClients()
        toast.success("Client updated successfully", { duration: 1000 })

        // Close the form AFTER refetch completes
        setClientSheetOpen(false)
        setSelectedClient(null)
      }
    } catch (error: any) {
      logger.error("Error updating client:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to update client",
        { duration: 1000 }
      )
    }
  }

  // Handle view chat history
  const handleViewChatHistory = async (client: Client) => {
    try {
      // 🚨 REMOVED: No longer using sessionId in URL
      // Chat selection now managed purely via React context
      
      // Navigate to chat page with client name as search filter
      // The ChatPage will auto-select the matching chat from context
      navigate(`/chat?client=${encodeURIComponent(client.name)}`)
    } catch (error) {
      logger.error("Error finding chat for client:", error)
      // Navigate to chat page with client name as search filter even if there's an error
      navigate(`/chat?client=${encodeURIComponent(client.name)}`)
    }
  }

  // Handle edit client
  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setClientSheetMode("edit")
    setClientSheetOpen(true)
  }

  // Handle view client details
  const handleView = (client: Client) => {
    setSelectedClient(client)
    setClientSheetMode("view")
    setClientSheetOpen(true)
  }

  // Handle delete client
  const handleDelete = (client: Client) => {
    setClientToDelete(client)
    setShowDeleteDialog(true)
  }

  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!workspace?.id || !clientToDelete) return

    try {
      // Delete client using customers API
      await api.delete(
        `/workspaces/${workspace.id}/customers/${clientToDelete.id}`
      )

      // Remove from state if successful
      await refetchClients()
      toast.success("Client deleted successfully", { duration: 1000 })
      setShowDeleteDialog(false)
      setClientToDelete(null)
    } catch (error) {
      logger.error("Error deleting client:", error)
      toast.error("Failed to delete client", { duration: 1000 })
    }
  }

  // Handle add new client
  const handleAddClient = () => {
    // Create an empty client template
    const newClient: Client = {
      id: "", // This will be assigned by the backend
      name: "",
      email: "",
      company: "",
      discount: 0,
      phone: "",
      language: "English",
      shippingAddress: {
        street: "",
        city: "",
        zip: "",
        country: "",
      },
      last_privacy_version_accepted: "",
      push_notifications_consent: false,
      activeChatbot: true,
      invoiceAddress: undefined,
    }
    setSelectedClient(newClient)
    setClientSheetMode("edit")
    setClientSheetOpen(true)
  }

  // Handle opening the new chat modal
  const handleOpenNewChat = () => {
    // Clear any existing selectedChat from localStorage first
    localStorage.removeItem("selectedChat")
    // Then open the chat modal
    setShowPlayground(true)
  }

  // Define columns for the DataTable in the requested order
  const columns: ColumnDef<Client>[] = [
    {
      header: "Phone",
      accessorKey: "phone",
    },
    {
      header: "Name",
      accessorKey: "name",
      size: 300,
      cell: ({ row }) => (
        <span className="min-w-[280px] block">
          {row.original.name}
          {row.original.company && ` (${row.original.company})`}
        </span>
      ),
    },
    {
      header: "Chatbot",
      accessorKey: "activeChatbot",
      cell: ({ row }) => (
        <div className="flex items-center">
          <Bot
            className={`h-4 w-4 mr-1 ${
              row.original.activeChatbot !== false
                ? "text-green-600"
                : "text-gray-400"
            }`}
          />
          <span
            className={`px-2 py-1 rounded-full text-xs ${
              row.original.activeChatbot !== false
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {row.original.activeChatbot !== false ? "Auto" : "Manual"}
          </span>
        </div>
      ),
    },
    {
      header: "Blocked",
      accessorKey: "isBlacklisted",
      cell: ({ row }) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            row.original.isBlacklisted
              ? "bg-red-100 text-red-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {row.original.isBlacklisted ? "YES" : "NO"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end items-center gap-2">
          {/* View orders for this client */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0 flex items-center justify-center"
                  onClick={() =>
                    navigate(
                      `/admin/orders?search=${encodeURIComponent(
                        row.original.name
                      )}`
                    )
                  }
                >
                  <span className="sr-only">View orders</span>
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View orders for this client</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Chat history button for all clients */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0 flex items-center justify-center"
                  onClick={() => handleViewChatHistory(row.original)}
                >
                  <span className="sr-only">Chat history</span>
                  <MessageSquare className={`h-4 w-4`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View chat history</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Edit button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0 flex items-center justify-center"
                  onClick={() => handleEdit(row.original)}
                >
                  <span className="sr-only">Edit</span>
                  <Pencil
                    className={`${commonStyles.actionIcon} ${commonStyles.primary}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Delete button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0 flex items-center justify-center hover:bg-red-50"
                  onClick={() => handleDelete(row.original)}
                >
                  <span className="sr-only">Delete</span>
                  <Trash2
                    className={`${commonStyles.actionIcon} text-red-600`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
  ]

  // In the return, use isLoading from useQuery
  if (isLoadingWorkspace || isLoadingClients) {
    return <div>Loading...</div>
  }

  if (isError) {
    return <div>Error loading clients.</div>
  }

  // Show error if no workspace selected
  if (!workspace?.id) {
    return <div>No workspace selected</div>
  }

  return (
    <div className="container pl-0 pr-4 pt-4 pb-4">
      <div className="grid grid-cols-12 gap-0">
        <div className="col-span-11 col-start-1">
          <PageHeader
            title="Clients"
            titleIcon={<Users className="mr-2 h-6 w-6 text-green-500" />}
            itemCount={filteredClients.length}
          />
          {/* Search and New Chat aligned to the right */}
          <div className="flex items-center justify-end gap-2 mb-4">
            <Input
              type="search"
              placeholder="Search clients..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleOpenNewChat}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Chat
            </Button>
          </div>
          <div className="mt-6 w-full">
            <DataTable
              columns={columns}
              data={filteredClients}
              globalFilter={searchValue}
            />
          </div>
        </div>
      </div>
      {/* WhatsApp Playground Modal */}
      <WhatsAppChatModal
        isOpen={showPlayground}
        onClose={() => {
          setShowPlayground(false)
          // Refresh the clients list when the WhatsApp modal closes
          refetchClients()
        }}
        channelName="WhatsApp Chat"
        phoneNumber={""}
        workspaceId={workspace?.id}
        selectedChat={null}
      />

      <ClientSheet
        client={selectedClient}
        open={clientSheetOpen}
        onOpenChange={setClientSheetOpen}
        onSubmit={handleClientSubmit}
        mode={clientSheetMode}
        availableLanguages={availableLanguages}
      />

      {/* Dialog di conferma eliminazione */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Client"
        description={`Are you sure you want to delete ${
          clientToDelete?.name || "this client"
        }? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}
