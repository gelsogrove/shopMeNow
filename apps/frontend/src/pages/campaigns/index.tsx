import { useEffect, useState } from "react"
import { Megaphone, Clock, Users, Sparkles, Globe, Pencil, Pause, Play, Trash2 } from "lucide-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { CampaignSheet } from "@/components/shared/CampaignSheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useBilling } from "@/contexts/BillingContext"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"

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
  const { creditBalance, billingOverview, refreshOverview, isLoadingOverview } = useBilling()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [campaignSheetOpen, setCampaignSheetOpen] = useState(false)

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
      const { data } = await api.get(`/workspaces/${workspace?.id}/push-campaigns`)
      setCampaigns(data.data || [])
    } catch (error) {
      toast.error("Error loading campaigns")
    } finally {
      setLoading(false)
    }
  }

  const handlePause = async (campaign: Campaign) => {
    try {
      await api.post(`/workspaces/${workspace?.id}/push-campaigns/${campaign.id}/pause`)
      toast.success("Campaign paused")
      loadCampaigns()
    } catch {
      toast.error("Error pausing campaign")
    }
  }

  const handleResume = async (campaign: Campaign) => {
    try {
      await api.post(`/workspaces/${workspace?.id}/push-campaigns/${campaign.id}/resume`)
      toast.success("Campaign resumed")
      loadCampaigns()
    } catch {
      toast.error("Error resuming campaign")
    }
  }

  const handleCancel = async (campaign: Campaign) => {
    try {
      await api.post(`/workspaces/${workspace?.id}/push-campaigns/${campaign.id}/cancel`)
      toast.success("Campaign cancelled")
      loadCampaigns()
    } catch {
      toast.error("Error cancelling campaign")
    }
  }

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

  const handleEditCampaign = async (campaign: Campaign) => {
    if (!hasEnoughCreditForPush) {
      toast.error(
        `Insufficient credit to edit/run this campaign. Need $${pushCost.toFixed(
          2
        )}, balance $${creditBalance.toFixed(2)}.`
      )
      return
    }

    try {
      const { data } = await api.get(`/workspaces/${workspace?.id}/push-campaigns/${campaign.id}`)
      setSelectedCampaign({ ...campaign, ...data })
      setCampaignSheetOpen(true)
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Unable to load campaign"
      toast.error(msg)
    }
  }

  const handleCampaignSubmit = async (formData: any, campaignId?: string) => {
    try {
      if (campaignId) {
        await api.put(`/workspaces/${workspace?.id}/push-campaigns/${campaignId}`, formData)
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

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchValue.toLowerCase())
  )

  const renderCard = (campaign: Campaign) => {
    const date = campaign.nextRunAt || campaign.sendAt
    const isTerminalStatus = ["COMPLETED", "CANCELLED", "FAILED"].includes(campaign.status || "")
    const isCampaignActive = campaign.isActive !== false && campaign.status !== "PAUSED"

    const targetingBadge =
      campaign.targetingType === "ALL"
        ? { icon: <Globe className="w-3 h-3" />, label: "All" }
        : campaign.targetingType === "MANUAL"
        ? { icon: <Users className="w-3 h-3" />, label: "Manual" }
        : { icon: <Sparkles className="w-3 h-3" />, label: "By Tag" }

    return (
      <div
        key={campaign.id}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{campaign.name}</h3>
              <Badge
                variant={
                  campaign.status === "COMPLETED"
                    ? "default"
                    : campaign.status === "FAILED" || campaign.status === "CANCELLED"
                    ? "destructive"
                    : "secondary"
                }
              >
                {campaign.status}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Badge variant="outline" className="flex items-center gap-1">
                {targetingBadge.icon}
                {targetingBadge.label}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {campaign.frequency.toLowerCase()}
              </Badge>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-gray-400" />
                {date ? new Date(date).toLocaleString() : "Asap"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEditCampaign(campaign)}
              className="h-8 w-8 p-0"
            >
              <Pencil className="h-4 w-4 text-slate-700" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (isCampaignActive ? handlePause(campaign) : handleResume(campaign))}
              disabled={isTerminalStatus}
              className="h-8 w-8 p-0"
            >
              {isCampaignActive ? (
                <Pause className="h-4 w-4 text-amber-600" />
              ) : (
                <Play className="h-4 w-4 text-emerald-600" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCancel(campaign)}
              disabled={isTerminalStatus}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Recipients</div>
            <div className="mt-1 text-base font-semibold">{campaign.expectedRecipients ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Sent</div>
            <div className="mt-1 text-base font-semibold">{campaign.actualSent ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Failed / Skipped</div>
            <div className="mt-1 text-base font-semibold">
              {(campaign.actualFailed ?? 0) + (campaign.actualSkipped ?? 0)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PageLayout>
      {!hasEnoughCreditForPush && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You need at least ${pushCost.toFixed(2)} of credit to create or edit a push campaign.
          Current balance: ${creditBalance.toFixed(2)}. Please recharge first.
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-emerald-600" />
          <h1 className="text-xl font-semibold text-slate-900">WhatsApp Campaigns</h1>
          <span className="text-sm text-slate-500">({filteredCampaigns.length} items)</span>
        </div>
        <div className="flex flex-1 gap-3 md:flex-none">
          <Input
            placeholder="Search campaigns..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="md:w-64"
          />
          <Button onClick={handleAddCampaign} className="bg-emerald-600 hover:bg-emerald-700">
            + New Campaign
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          Loading...
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <h3 className="text-lg font-medium text-slate-900 mb-2">No campaigns yet</h3>
          <p className="text-slate-600 mb-4">
            Create your first automated WhatsApp campaign to engage your customers.
          </p>
          <Button onClick={handleAddCampaign} className="bg-emerald-600 hover:bg-emerald-700">
            + New Campaign
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCampaigns.map(renderCard)}
        </div>
      )}

      <CampaignSheet
        campaign={selectedCampaign}
        open={campaignSheetOpen}
        onOpenChange={setCampaignSheetOpen}
        onSubmit={handleCampaignSubmit}
        mode="edit"
        workspaceId={workspace?.id}
      />
    </PageLayout>
  )
}
