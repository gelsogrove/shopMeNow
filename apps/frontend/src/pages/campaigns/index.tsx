import { PageLayout } from "@/components/layout/PageLayout"
import { CampaignSheet } from "@/components/shared/CampaignSheet"
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
import { Calendar, Globe, Megaphone, Pause, Sparkles, Trash2, Users, Clock, CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useWorkspace } from "../../contexts/WorkspaceContext"
import { toast } from "../../lib/toast"
import { api } from "../../services/api"

interface Campaign {
  id: string
  name: string
  status: string
  sendAt?: string | null
  expectedRecipients?: number | null
  actualSent?: number | null
  actualFailed?: number | null
  actualSkipped?: number | null
  costPerMessage?: string
  createdAt?: string
  updatedAt?: string
}

export default function CampaignsPage() {
  const { workspace } = useWorkspace()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")

  // Campaign Sheet state
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null
  )
  const [campaignSheetOpen, setCampaignSheetOpen] = useState(false)
  const [campaignSheetMode] = useState<"view" | "edit">("edit")

  useEffect(() => {
    if (workspace?.id) {
      loadCampaigns()
    }
  }, [workspace?.id])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(
        `/workspaces/${workspace?.id}/push-campaigns`
      )
      setCampaigns(data.data || [])
    } catch (error) {
      toast.error("Error loading campaigns")
    } finally {
      setLoading(false)
    }
  }

  // Actions
  const handleRunNow = async (campaign: Campaign) => {
    try {
      await api.post(
        `/workspaces/${workspace?.id}/push-campaigns/${campaign.id}/run-now`
      )
      toast.success("Campaign queued to run now")
      loadCampaigns()
    } catch {
      toast.error("Error running campaign")
    }
  }

  const handlePause = async (campaign: Campaign) => {
    try {
      await api.post(
        `/workspaces/${workspace?.id}/push-campaigns/${campaign.id}/pause`
      )
      toast.success("Campaign paused")
      loadCampaigns()
    } catch {
      toast.error("Error pausing campaign")
    }
  }

  const handleResume = async (campaign: Campaign) => {
    try {
      await api.post(
        `/workspaces/${workspace?.id}/push-campaigns/${campaign.id}/resume`
      )
      toast.success("Campaign resumed")
      loadCampaigns()
    } catch {
      toast.error("Error resuming campaign")
    }
  }

  const handleCancel = async (campaign: Campaign) => {
    try {
      await api.post(
        `/workspaces/${workspace?.id}/push-campaigns/${campaign.id}/cancel`
      )
      toast.success("Campaign cancelled")
      loadCampaigns()
    } catch {
      toast.error("Error cancelling campaign")
    }
  }

  // Open sheet to create
  const handleAddCampaign = () => {
    setSelectedCampaign(null)
    setCampaignSheetOpen(true)
  }

  // Handle campaign form submission (create + optional schedule)
  const handleCampaignSubmit = async (formData: any) => {
    try {
      await api.post(`/workspaces/${workspace?.id}/push-campaigns`, formData)
      toast.success("Campaign created")
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
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <Badge
            variant={
              row.original.status === "COMPLETED"
                ? "default"
                : row.original.status === "FAILED" ||
                  row.original.status === "CANCELLED"
                ? "destructive"
                : "secondary"
            }
          >
            {row.original.status}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "sendAt",
      header: "Send at",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          {row.original.sendAt
            ? new Date(row.original.sendAt).toLocaleString()
            : "Now"}
        </div>
      ),
    },
    {
      accessorKey: "expectedRecipients",
      header: "Recipients",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <Users className="w-4 h-4 text-gray-400" />
          {row.original.expectedRecipients ?? 0}
        </div>
      ),
    },
    {
      accessorKey: "actualSent",
      header: "Sent/Failed/Skipped",
      cell: ({ row }) => (
        <div className="text-sm text-gray-700">
          {row.original.actualSent ?? 0} / {row.original.actualFailed ?? 0} /{" "}
          {row.original.actualSkipped ?? 0}
        </div>
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
              onClick={() => handleRunNow(campaign)}
              className="h-8 w-8 p-0 flex items-center justify-center"
              disabled={
                ["COMPLETED", "CANCELLED", "FAILED"].includes(
                  campaign.status || ""
                ) || campaign.expectedRecipients === 0
              }
            >
              <Megaphone className="h-4 w-4 text-green-600" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Run now</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {campaign.status === "PAUSED" ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleResume(campaign)}
                className="h-8 w-8 p-0 flex items-center justify-center"
                disabled={
                  ["COMPLETED", "CANCELLED", "FAILED"].includes(
                    campaign.status || ""
                  )
                }
              >
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePause(campaign)}
                className="h-8 w-8 p-0 flex items-center justify-center hover:bg-red-50"
                disabled={
                  ["COMPLETED", "CANCELLED", "FAILED"].includes(
                    campaign.status || ""
                  )
                }
              >
                <Pause className="h-4 w-4 text-amber-600" />
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent>
            <p>{campaign.status === "PAUSED" ? "Resume" : "Pause"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCancel(campaign)}
              className="h-8 w-8 p-0 flex items-center justify-center hover:bg-red-50"
              disabled={
                ["COMPLETED", "CANCELLED", "FAILED"].includes(
                  campaign.status || ""
                )
              }
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Cancel</p>
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
    </PageLayout>
  )
}
