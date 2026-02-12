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
import { Calendar, Megaphone, Trash2, Users, Clock, Power, Pencil, Globe } from "lucide-react"
import { useEffect, useState } from "react"
import { useWorkspace } from "../../contexts/WorkspaceContext"
import { useBilling } from "@/contexts/BillingContext"
import { toast } from "../../lib/toast"
import { api } from "../../services/api"

interface Campaign {
  id: string
  name: string
  status: string
  frequency: string
  isActive: boolean
  targetingType: string
  sendAt?: string | null
  nextRunAt?: string | null
  lastRunAt?: string | null
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
  const {
    creditBalance,
    billingOverview,
    refreshOverview,
    isLoadingOverview,
  } = useBilling()
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
      if (!billingOverview && !isLoadingOverview) {
        void refreshOverview()
      }
    }
  }, [workspace?.id])

  const pushCost = billingOverview?.limits.pushCost ?? 1.0
  const hasEnoughCreditForPush = creditBalance >= pushCost

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
    if (!hasEnoughCreditForPush) {
      toast.error(
        `Insufficient credit for a campaign. Need at least $${pushCost.toFixed(
          2
        )}, current balance $${creditBalance.toFixed(2)}.`
      )
      return
    }
    setSelectedCampaign(null)
    setCampaignSheetOpen(true)
  }

  const handleEditCampaign = (campaign: Campaign) => {
    if (!hasEnoughCreditForPush) {
      toast.error(
        `Insufficient credit to edit/run this campaign. Need $${pushCost.toFixed(
          2
        )}, balance $${creditBalance.toFixed(2)}.`
      )
      return
    }
    setSelectedCampaign(campaign)
    setCampaignSheetOpen(true)
  }

  // Handle campaign form submission (create/update)
  const handleCampaignSubmit = async (formData: any, campaignId?: string) => {
    try {
      if (campaignId) {
        await api.put(
          `/workspaces/${workspace?.id}/push-campaigns/${campaignId}`,
          formData
        )
        toast.success("Campaign updated")
      } else {
        await api.post(`/workspaces/${workspace?.id}/push-campaigns`, formData)
        toast.success("Campaign created")
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
      size: 220,
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
      accessorKey: "targetingType",
      header: "Targeting",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          {row.original.targetingType === "ALL" && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              All
            </Badge>
          )}
          {row.original.targetingType === "MANUAL" && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              Manual
            </Badge>
          )}
          {row.original.targetingType === "TAGS" && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              By Tag
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "frequency",
      header: "Frequency",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.frequency.toLowerCase()}
        </Badge>
      ),
    },
    {
      accessorKey: "sendAt",
      header: "Next Run",
      cell: ({ row }) => {
        const date = row.original.nextRunAt || row.original.sendAt
        return (
          <div className="flex items-center gap-1 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            {date ? new Date(date).toLocaleString() : "Asap"}
          </div>
        )
      },
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
      header: "Sent",
      cell: ({ row }) => (
        <div className="text-sm text-gray-700">
          {row.original.actualSent ?? 0}
        </div>
      ),
    },
    {
      accessorKey: "actualFailed",
      header: "Failed",
      cell: ({ row }) => (
        <div className="text-sm text-gray-700">
          {row.original.actualFailed ?? 0}
        </div>
      ),
    },
    {
      accessorKey: "actualSkipped",
      header: "Skipped",
      cell: ({ row }) => (
        <div className="text-sm text-gray-700">
          {row.original.actualSkipped ?? 0}
        </div>
      ),
    },
  ]

const renderActions = (campaign: Campaign) => {
    const isTerminalStatus = ["COMPLETED", "CANCELLED", "FAILED"].includes(
      campaign.status || ""
    )
    const isCampaignActive =
      campaign.isActive !== false && campaign.status !== "PAUSED"

    return (
      <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEditCampaign(campaign)}
              className="h-8 w-8 p-0 flex items-center justify-center"
            >
              <Pencil className="h-4 w-4 text-gray-700" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Edit Campaign</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <button
        type="button"
        onClick={() =>
          isCampaignActive ? handlePause(campaign) : handleResume(campaign)
        }
        disabled={isTerminalStatus}
        aria-pressed={isCampaignActive}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
          isCampaignActive
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-gray-200 bg-gray-100 text-gray-600"
        } disabled:opacity-50`}
      >
        <Power className="h-3.5 w-3.5" />
        <span>{isCampaignActive ? "Pause" : "Resume"}</span>
        <span
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            isCampaignActive ? "bg-green-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              isCampaignActive ? "translate-x-4" : "translate-x-1"
            }`}
          />
        </span>
      </button>

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
}

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
      {!hasEnoughCreditForPush && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You need at least ${pushCost.toFixed(2)} of credit to create or edit a push campaign.
          Current balance: ${creditBalance.toFixed(2)}. Please recharge first.
        </div>
      )}
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
        className="overflow-hidden"
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
