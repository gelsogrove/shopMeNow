import { PageLayout } from "@/components/layout/PageLayout"
import { CampaignSheet } from "@/components/shared/CampaignSheet"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { CrudPageContent } from "@/components/shared/CrudPageContent"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { commonStyles } from "@/styles/common"
import { ColumnDef } from "@tanstack/react-table"
import { Calendar, Globe, Megaphone, Pencil, Sparkles, Trash2, Users, Clock, CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useWorkspace } from "../../contexts/WorkspaceContext"
import { toast } from "../../lib/toast"
import { api } from "../../services/api"

interface Campaign {
  id: string
  name: string
  messagePreview: string
  frequency: string
  isActive: boolean
  targetType: string
  customerIds: string[]
  createdAt: string
  lastRunAt?: string
  _count: {
    sends: number
    feedbacks: number
  }
}

const frequencyLabels: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Bi-weekly",
  MONTHLY: "Monthly",
  BIMONTHLY: "Bi-monthly",
  QUARTERLY: "Quarterly",
  SEMIANNUAL: "Semi-annual",
  ANNUAL: "Annual",
}

export default function CampaignsPage() {
  const { workspace } = useWorkspace()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(
    null
  )

  // Campaign Sheet state
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null
  )
  const [campaignSheetOpen, setCampaignSheetOpen] = useState(false)
  const [campaignSheetMode, setCampaignSheetMode] = useState<"view" | "edit">(
    "edit"
  )

  useEffect(() => {
    if (workspace?.id) {
      loadCampaigns()
    }
  }, [workspace?.id])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/workspaces/${workspace?.id}/campaigns`)
      setCampaigns(data.data || [])
    } catch (error) {
      toast.error("Error loading campaigns")
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (campaign: Campaign) => {
    try {
      const { data } = await api.patch(
        `/workspaces/${workspace?.id}/campaigns/${campaign.id}/toggle`
      )
      toast.success(data.message)
      loadCampaigns()
    } catch (error) {
      toast.error("Error changing campaign status")
    }
  }

  const handleDeleteClick = (campaign: Campaign) => {
    setCampaignToDelete(campaign)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!campaignToDelete) return

    try {
      await api.delete(
        `/workspaces/${workspace?.id}/campaigns/${campaignToDelete.id}`
      )
      toast.success("Campaign deleted successfully")
      loadCampaigns()
      setShowDeleteDialog(false)
      setCampaignToDelete(null)
    } catch (error) {
      toast.error("Error deleting campaign")
    }
  }

  // Handle edit campaign
  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setCampaignSheetMode("edit")
    setCampaignSheetOpen(true)
  }

  // Handle add new campaign
  const handleAddCampaign = () => {
    setSelectedCampaign(null)
    setCampaignSheetMode("edit")
    setCampaignSheetOpen(true)
  }

  // Handle campaign form submission
  const handleCampaignSubmit = async (formData: any, campaignId?: string) => {
    try {
      if (campaignId) {
        // Update existing campaign
        await api.put(
          `/workspaces/${workspace?.id}/campaigns/${campaignId}`,
          formData
        )
        toast.success("Campaign updated successfully")
      } else {
        // Create new campaign
        await api.post(`/workspaces/${workspace?.id}/campaigns`, formData)
        toast.success("Campaign created successfully")
      }

      setCampaignSheetOpen(false)
      loadCampaigns()
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error saving campaign")
    }
  }

  // Filter campaigns based on search
  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchValue.toLowerCase())
  )

  // Define table columns
  const columns: ColumnDef<Campaign>[] = [
    {
      accessorKey: "name",
      header: "Name",
      size: 300,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
        </div>
      ),
    },
    {
      accessorKey: "frequency",
      header: "Frequency",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          {frequencyLabels[row.original.frequency] || row.original.frequency}
        </div>
      ),
    },
    {
      accessorKey: "targetType",
      header: "Recipients",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <Users className="w-4 h-4 text-gray-400" />
          {row.original.targetType === "ALL"
            ? "All customers"
            : `${row.original.customerIds.length} customers`}
        </div>
      ),
    },
    {
      accessorKey: "sends",
      header: "Sent",
      cell: ({ row }) => (
        <div className="text-sm text-gray-600">{row.original._count.sends}</div>
      ),
    },
    {
      accessorKey: "feedbacks",
      header: "Feedback",
      cell: ({ row }) => (
        <div className="text-sm text-gray-600">
          {row.original._count.feedbacks}
        </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.isActive ? "default" : "secondary"}
          className={
            row.original.isActive
              ? "bg-green-100 text-green-800 hover:bg-green-100"
              : ""
          }
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ]

  const renderActions = (campaign: Campaign) => (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEditCampaign(campaign)}
              className="h-8 w-8 p-0 flex items-center justify-center"
            >
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

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteClick(campaign)}
              className="h-8 w-8 p-0 flex items-center justify-center hover:bg-red-50"
            >
              <Trash2 className={commonStyles.actionIcon + " text-red-600"} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )

  const renderEmptyState = (
    <div className="text-center py-12">
      <Megaphone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        No campaigns yet
      </h3>
      <p className="text-gray-600 mb-6">
        Create your first automated WhatsApp campaign to engage with your
        customers
      </p>
    </div>
  )

  return (
    <PageLayout>
      {/* AI-Powered Campaign Info Box */}
      <div className="mb-6 bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 border border-purple-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-4">
          {/* AI Icon */}
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              AI-Powered Multilingual Campaigns
              <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                Smart
              </Badge>
            </h3>
            <p className="text-sm text-gray-600 mt-1 mb-4">
              Write your campaign in <b>your native language</b> - our AI automatically translates it to each customer's preferred language.
            </p>

            {/* How it works - Steps */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-600">1</div>
                <span className="text-xs text-gray-700">Write message in Italian</span>
              </div>
              <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">2</div>
                <span className="text-xs text-gray-700">Select recipients</span>
              </div>
              <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Clock className="w-3 h-3 text-indigo-600" />
                </div>
                <span className="text-xs text-gray-700">Scheduler runs daily at 10:00</span>
              </div>
              <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <Globe className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-xs text-gray-700">AI translates per customer</span>
              </div>
            </div>

            {/* Supported Languages */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-xs text-gray-500">Supported languages:</span>
              <div className="flex gap-1">
                <span className="px-2 py-0.5 bg-white rounded text-xs font-medium text-gray-700">🇮🇹 IT</span>
                <span className="px-2 py-0.5 bg-white rounded text-xs font-medium text-gray-700">🇬🇧 EN</span>
                <span className="px-2 py-0.5 bg-white rounded text-xs font-medium text-gray-700">🇪🇸 ES</span>
                <span className="px-2 py-0.5 bg-white rounded text-xs font-medium text-gray-700">🇵🇹 PT</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CrudPageContent
        title={<span className={commonStyles.primary}>WhatsApp Campaigns</span>}
        titleIcon={<Megaphone className={commonStyles.headerIcon} />}
        searchValue={searchValue}
        onSearch={setSearchValue}
        searchPlaceholder="Search campaigns..."
        onAdd={handleAddCampaign}
        addButtonText="New Campaign"
        data={filteredCampaigns}
        columns={columns}
        isLoading={loading}
        renderActions={renderActions}
        renderEmptyState={renderEmptyState}
        disablePagination={true}
      />

      <CampaignSheet
        campaign={selectedCampaign}
        open={campaignSheetOpen}
        onOpenChange={setCampaignSheetOpen}
        onSubmit={handleCampaignSubmit}
        mode={campaignSheetMode}
        workspaceId={workspace?.id}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Campaign"
        description={`Are you sure you want to delete "${campaignToDelete?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Delete"
        variant="destructive"
      />
    </PageLayout>
  )
}
