import { ChangeDetection, ClientSheet } from "@/components/shared/ClientSheet"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { WhatsAppChatModal } from "@/components/shared/WhatsAppChatModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { storage } from "@/lib/storage"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { pushNotificationService } from "@/services/pushNotificationService"
import { getLanguages, Language } from "@/services/workspaceApi"
import { commonStyles } from "@/styles/common"
import { useQuery } from "@tanstack/react-query"
import {
  Ban,
  Bot,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  ShoppingCart,
  Star,
  Trash2,
  User,
  Users,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
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
  isActive?: boolean // 🚨 CRITICAL: Campo per rilevare account activation (era 'enabled')
  feedback?: {
    rating: number
    comment?: string
    createdAt: string
  }
}

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

  // 🔥 State per il cliente selezionato - INIZIALIZZA da sessionStorage
  const [selectedClient, setSelectedClient] = useState<Client | null>(() => {
    const savedClientId = sessionStorage.getItem("selectedClientId")

    if (savedClientId) {
      // Ritorna un oggetto parziale temporaneo - verrà aggiornato dall'useEffect
      return { id: savedClientId } as Client
    }
    return null
  })

  // 🔥 State per l'ID da ripristinare da sessionStorage (letto una sola volta al mount)
  // ❌ NON PIÙ NECESSARIO - usiamo direttamente selectedClient

  const [clientSheetOpen, setClientSheetOpen] = useState(false)
  const [clientSheetMode, setClientSheetMode] = useState<"view" | "edit">(
    "view"
  )
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const hasRestoredRef = useRef(false) // Flag per evitare ripristini multipli

  // Stati per il dialogo di conferma eliminazione
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)
  const { chats: allChats, enableFetching } = useChatList()
  const [showPlayground, setShowPlayground] = useState(false)

  // 🆕 Enable chat fetching when entering this page (for chat count)
  useEffect(() => {
    enableFetching()
  }, [enableFetching])

  // 🆕 State for notification dialog
  const [showNotificationDialog, setShowNotificationDialog] = useState(false)
  const [notificationChanges, setNotificationChanges] = useState<{
    discountChanged: boolean
    chatbotActivated: boolean
    accountActivated: boolean
    oldDiscount: number
    newDiscount: number
  } | null>(null)
  const [pendingUpdate, setPendingUpdate] = useState<{
    clientId: string
    changes: ChangeDetection
  } | null>(null)

  // Convert Language[] to string[] (names only) for ClientSheet
  const { data: availableLanguagesData = [] } = useQuery<Language[]>({
    queryKey: ["languages", workspace?.id],
    queryFn: async () => getLanguages(),
    enabled: !!workspace?.id,
    retry: false,
  })

  // Convert Language[] to string[] (names only) for ClientSheet
  const availableLanguages = availableLanguagesData.map((lang) => lang.name)

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
        isActive: customer.isActive !== undefined ? customer.isActive : true, // 🚨 CRITICAL: Campo per rilevare account activation
        feedback:
          customer.feedbacks && customer.feedbacks.length > 0
            ? {
                rating: customer.feedbacks[0].rating,
                comment: customer.feedbacks[0].comment,
                createdAt: customer.feedbacks[0].createdAt,
              }
            : undefined,
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
    retry: false, // 🔥 FIX: Don't retry on session errors
    refetchOnWindowFocus: false, // 🔥 FIX: Non fare refetch quando la finestra recupera il focus (chiusura modal)
    refetchOnMount: false, // 🔥 FIX: Non fare refetch al mount del componente
    staleTime: 5 * 60 * 1000, // 🔥 FIX: I dati sono "fresh" per 5 minuti
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
        setSelectedClient(clientToEdit)
        setClientSheetMode("edit")
        setClientSheetOpen(true)
      }
    }
  }, [clients, searchParams, navigate])

  // 🔥 Gestione selezione cliente: completa i dati da sessionStorage
  useEffect(() => {
    // Aspetta che i dati siano caricati
    if (clients.length === 0 || isLoadingClients) return

    // Evita aggiornamenti multipli
    if (hasRestoredRef.current) {
      return
    }

    // ✅ Se selectedClient ha solo l'ID (oggetto parziale da sessionStorage), completalo
    if (selectedClient?.id && !selectedClient.name) {
      const fullClient = clients.find((c) => c.id === selectedClient.id)
      if (fullClient) {
        setSelectedClient(fullClient)
        hasRestoredRef.current = true
        return
      }
    }

    // Se selectedClient ha già tutti i dati (nome presente), non fare nulla
    if (selectedClient?.name) {
      hasRestoredRef.current = true
      return
    }
  }, [clients, isLoadingClients, selectedClient])

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
        // 🎯 SOLUZIONE SEMPLICE: Chiudi il form senza fare refetch!
        // Il nuovo cliente apparirà al prossimo caricamento naturale della pagina
        toast.success("Client created successfully", { duration: 1000 })
        setClientSheetOpen(false)
      }
    } catch (error: any) {
      const errorData = error?.response?.data
      if (
        errorData?.code === "PLAN_LIMIT_REACHED" ||
        errorData?.code === "CUSTOMER_LIMIT_REACHED"
      ) {
        toast.error(
          errorData.message ||
            "Customer limit reached for your plan. Upgrade to add more customers.",
          { duration: 3000 }
        )
      } else {
        toast.error("Failed to create client", { duration: 1000 })
      }
      logger.error("Error creating client:", error)
    }
  }

  // Handle client form submission (create or update)
  const handleClientSubmit = async (
    customerData: any,
    clientId?: string,
    changes?: ChangeDetection
  ) => {
    if (clientId) {
      await handleUpdateClient(customerData, clientId, changes)
    } else {
      await handleCreateClient(customerData)
    }
  }

  // Handle update client
  const handleUpdateClient = async (
    customerData: any,
    clientId: string,
    changes?: ChangeDetection
  ) => {
    if (!workspace?.id) {
      toast.error("No workspace selected")
      return
    }

    try {
      const { update } = await import("@/services/clientsApi")
      const updatedCustomer = await update(clientId, workspace.id, customerData)

      if (updatedCustomer) {
        toast.success("Client updated successfully", { duration: 2000 })

        // 🔍 Detect changes by comparing with original data
        if (selectedClient) {
          const oldDiscount = selectedClient.discount || 0
          const newDiscount = parseFloat(customerData.discount) || 0
          const discountChanged = oldDiscount !== newDiscount

          const oldChatbot =
            selectedClient.activeChatbot !== undefined
              ? selectedClient.activeChatbot
              : true
          const newChatbot =
            customerData.activeChatbot !== undefined
              ? customerData.activeChatbot
              : true
          const chatbotActivated = !oldChatbot && newChatbot

          // Show notification dialog if there are relevant changes
          if (discountChanged || chatbotActivated) {
            const detectedChanges: ChangeDetection = {
              hasChanges: true,
              discountChanged,
              chatbotActivated,
              oldDiscount,
              newDiscount,
              oldChatbot,
              newChatbot,
            }

            // Wait a moment for toast to be visible, then show dialog
            setTimeout(() => {
              setPendingUpdate({ clientId, changes: detectedChanges })
              setShowNotificationDialog(true)
            }, 500)

            // NON chiudere il Sheet qui - lo chiuderà handleNotificationConfirm
          } else {
            setClientSheetOpen(false)
          }
        } else {
          setClientSheetOpen(false)
        }
      }
    } catch (error: any) {
      logger.error("Error updating client:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to update client",
        { duration: 1000 }
      )
    }
  }

  // 🆕 Handle notification dialog confirm/cancel
  const handleNotificationConfirm = async (shouldNotify: boolean) => {
    setShowNotificationDialog(false)

    if (!shouldNotify || !pendingUpdate || !workspace?.id) {
      setClientSheetOpen(false) // Close immediately if not notifying
      setPendingUpdate(null)
      return
    }

    const { clientId, changes } = pendingUpdate

    try {
      // Send discount change notification
      if (changes.discountChanged) {
        await pushNotificationService.sendDiscountChange(
          workspace.id,
          [clientId],
          changes.newDiscount
        )
        toast.success(`Discount notification sent (${changes.newDiscount}%)`, {
          duration: 2000,
        })
      }

      // Send chatbot activation notification
      if (changes.chatbotActivated) {
        await pushNotificationService.sendChatbotReactivation(workspace.id, [
          clientId,
        ])
        toast.success("Chatbot activation notification sent", {
          duration: 2000,
        })
      }

      // ⏱️ Wait 2 seconds to let user see the success toast, then close sheet
      setTimeout(() => {
        setClientSheetOpen(false)
      }, 2000)
    } catch (error) {
      logger.error("Error sending notification:", error)
      toast.error("Failed to send notification", { duration: 2000 })
      // Close sheet immediately on error
      setClientSheetOpen(false)
    } finally {
      setPendingUpdate(null)
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
    // ✅ Salva in sessionStorage SOLO se è diverso da quello già salvato
    const currentSavedId = sessionStorage.getItem("selectedClientId")
    if (currentSavedId !== client.id) {
      sessionStorage.setItem("selectedClientId", client.id)
    }
    setClientSheetMode("edit")
    setClientSheetOpen(true)
  }

  // Handle view client details
  const handleView = (client: Client) => {
    setSelectedClient(client)
    // ✅ Salva in sessionStorage SOLO se è diverso da quello già salvato
    const currentSavedId = sessionStorage.getItem("selectedClientId")
    if (currentSavedId !== client.id) {
      sessionStorage.setItem("selectedClientId", client.id)
    }
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
    // Clear any existing selectedChat first
    storage.clearSelectedChat()
    // Then open the chat modal
    setShowPlayground(true)
  }

  // In the return, use isLoading from useQuery
  if (isLoadingWorkspace || isLoadingClients) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6 text-center">
          <p className="text-red-600">Error loading clients.</p>
        </CardContent>
      </Card>
    )
  }

  // Show error if no workspace selected
  if (!workspace?.id) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6 text-center">
          <p className="text-gray-600">No workspace selected</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card className="min-h-[calc(100vh-13.7rem)]">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Page Title + Search */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-green-600">Clients</h1>
              <span className="text-sm text-muted-foreground">({filteredClients.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="search"
                placeholder="Search clients..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="max-w-xs bg-white"
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
      </div>

      {/* Client Cards Grid */}
      {filteredClients.length === 0 ? (
            <Card className="bg-white">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No clients found</p>
                <p className="text-sm text-gray-400 mt-1">Start a new chat to add your first client</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.map((client) => (
                <Card 
                  key={client.id} 
                  className="bg-white hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => handleView(client)}
                >
                  <CardContent className="p-4">
                    {/* Header with avatar and status badges */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                            {client.name || 'Unknown'}
                          </h3>
                          {client.company && (
                            <p className="text-xs text-gray-500">{client.company}</p>
                          )}
                        </div>
                      </div>
                      {/* Status badges */}
                      <div className="flex gap-1">
                        {client.isBlacklisted && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 flex items-center gap-1">
                            <Ban className="h-3 w-3" />
                            Blocked
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{client.phone || 'No phone'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bot className={`h-4 w-4 ${client.activeChatbot !== false ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          client.activeChatbot !== false 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {client.activeChatbot !== false ? 'Chatbot Active' : 'Manual Mode'}
                        </span>
                        {client.feedback && (
                          <div className="flex items-center gap-0.5 ml-auto">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < client.feedback!.rating
                                    ? "text-yellow-500 fill-yellow-500"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-1 pt-3 border-t border-gray-100">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/admin/orders?search=${encodeURIComponent(client.name)}`)
                              }}
                            >
                              <ShoppingCart className="h-4 w-4 text-blue-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Orders</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewChatHistory(client)
                              }}
                            >
                              <MessageSquare className="h-4 w-4 text-gray-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Chat History</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(client)
                              }}
                            >
                              <Pencil className="h-4 w-4 text-green-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(client)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>

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
    </>
  )
}
