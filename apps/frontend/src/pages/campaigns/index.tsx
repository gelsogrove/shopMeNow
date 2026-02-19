import { useEffect, useState } from "react"
import {
  Megaphone,
  Clock,
  Users,
  Sparkles,
  Globe,
  ListChecks,
  History,
  Pencil,
  Pause,
  Play,
  Trash2,
  Info,
  ShieldCheck,
  Eye,
} from "lucide-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { CampaignSheet } from "@/components/shared/CampaignSheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useBilling } from "@/contexts/BillingContext"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useNavigate } from "react-router-dom"

interface Campaign {
  id: string
  name: string
  status: string
  frequency: string
  isActive: boolean
  isExpired?: boolean
  errorBreakdown?: { status: string; code: string | null; count: number }[]
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

  // Message History State
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [sentMessages, setSentMessages] = useState<any[]>([])
  const [activeHistoryCampaign, setActiveHistoryCampaign] = useState<string | null>(null)

  // Security Check State
  const [securityLoading, setSecurityLoading] = useState<string | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    if (workspace?.id) {
      loadCampaigns()
      if (!billingOverview && !isLoadingOverview) {
        void refreshOverview()
      }
    } else if (!workspace) {
      // If workspace is explicitly null/undefined, stop loading
      setLoading(false)
    }
  }, [workspace?.id, workspace])

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

  const handleDelete = async (campaign: Campaign) => {
    try {
      await api.delete(`/workspaces/${workspace?.id}/push-campaigns/${campaign.id}`)
      toast.success("Campaign deleted")
      loadCampaigns()
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error deleting campaign")
    }
  }

  const handleSecurityCheck = async (campaign: Campaign) => {
    try {
      setSecurityLoading(campaign.id)
      const { data } = await api.post(`/workspaces/${workspace?.id}/push-campaigns/${campaign.id}/security-check`)
      if (data.safe) {
        toast.success("✅ Content safety check passed!")
      } else {
        toast.error(`🚫 Restricted: ${data.blockedReason}`, { duration: 5000 })
      }
    } catch (error) {
      toast.error("Failed to perform security check")
    } finally {
      setSecurityLoading(null)
    }
  }

  const handleViewHistory = async (campaign: Campaign) => {
    try {
      setHistoryOpen(true)
      setHistoryLoading(true)
      setActiveHistoryCampaign(campaign.name)
      const { data } = await api.get(`/workspaces/${workspace?.id}/push-campaigns/${campaign.id}/sent-messages`)
      setSentMessages(data.data || [])
    } catch (error) {
      toast.error("Failed to load message history")
    } finally {
      setHistoryLoading(false)
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
      // Preserve targeting + recipients; if recipients exist but targetingType is missing/ALL, infer MANUAL
      const merged = { ...campaign, ...data }
      const hasManualRecipients =
        Array.isArray(merged.targetCustomerIds) && merged.targetCustomerIds.length > 0
      const hasRecipientCount = (merged.expectedRecipients || 0) > 0

      // If the campaign has recipients but targetingType is missing/ALL, treat it as MANUAL
      if ((!merged.targetingType || merged.targetingType === "ALL") && (hasManualRecipients || hasRecipientCount)) {
        merged.targetingType = "MANUAL"
      }
      setSelectedCampaign(merged)
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
    const isCampaignActive = campaign.status === "SCHEDULED" || campaign.status === "RUNNING"
    const excludedCount = (campaign.actualFailed ?? 0) + (campaign.actualSkipped ?? 0)
    const totalRecipients =
      (campaign as any).recipientsTotal ??
      campaign.expectedRecipients ??
      ((campaign as any).recipientsPending ?? 0) + excludedCount + (campaign.actualSent ?? 0)
    const schedulerOff =
      campaign.isActive === false &&
      campaign.status !== "SCHEDULED" &&
      campaign.status !== "RUNNING"

    const nextRunLabel = date
      ? new Date(date).toLocaleString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Not scheduled"

    const lastRunLabel = campaign.lastRunAt
      ? new Date(campaign.lastRunAt).toLocaleString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Never run"

    const frequencyLabel = (campaign.frequency || "").toLowerCase() === "once"
      ? "One-shot"
      : campaign.frequency?.toLowerCase()

    const targetingBadge =
      campaign.targetingType === "ALL"
        ? { icon: <Globe className="w-3 h-3" />, label: "All" }
        : campaign.targetingType === "MANUAL"
          ? { icon: <Users className="w-3 h-3" />, label: "Manual" }
          : { icon: <Sparkles className="w-3 h-3" />, label: "By Tag" }

    const errorLabel = (code?: string | null) => {
      if (!code) return "Unknown"
      const map: Record<string, string> = {
        OPT_OUT: "No marketing consent",
        BLACKLISTED: "Blacklisted",
        CHATBOT_INACTIVE: "Chatbot inactive",
        INVALID_PHONE: "Invalid phone",
        NO_CUSTOMER: "Customer not found",
        NOT_TARGET: "No longer in target",
      }
      return map[code] || code
    }

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
                {campaign.isExpired ? "EXPIRED" :
                  campaign.status === "COMPLETED" ? "COMPLETED" :
                    campaign.status === "SCHEDULED" ? "SCHEDULED" :
                      campaign.status === "RUNNING" ? "RUNNING" :
                        campaign.status === "PAUSED" ? "PAUSED" :
                          campaign.status === "CANCELLED" ? "CANCELLED" :
                            campaign.status === "FAILED" ? "FAILED" :
                              campaign.status === "DRAFT" ? "DRAFT" :
                                campaign.status}
              </Badge>
              {schedulerOff && (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                  Scheduler off
                </Badge>
              )}
              {campaign.isExpired && (
                <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Past scheduled time
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Badge variant="outline" className="flex items-center gap-1">
                {targetingBadge.icon}
                {targetingBadge.label}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {frequencyLabel}
              </Badge>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-gray-400" />
                {date ? new Date(date).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Asap"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/queue')}
              className="h-8 w-8 p-0"
              title="Open WhatsApp queue"
            >
              <ListChecks className="h-4 w-4 text-slate-700" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSecurityCheck(campaign)}
              disabled={securityLoading === campaign.id}
              className="h-8 w-8 p-0"
              title="Security Check"
            >
              <ShieldCheck className={`h-4 w-4 ${securityLoading === campaign.id ? 'animate-pulse text-slate-400' : 'text-slate-700'}`} />
            </Button>
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
              onClick={() => handleDelete(campaign)}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Schedule</span>
              <Badge variant="outline" className="uppercase tracking-wide">
                {campaign.status === "RUNNING" ? "ACTIVE" : campaign.status}
              </Badge>
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">Next: {nextRunLabel}</div>
            <div className="text-[11px] text-slate-500">Last run: {lastRunLabel}</div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Error queue & retention</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/queue')}
                className="h-7 px-2 text-slate-700"
              >
                <History className="w-3.5 h-3.5 mr-1" /> Queue
              </Button>
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {(campaign.actualFailed ?? 0) + (campaign.actualSkipped ?? 0)} exclusions (last run)
            </div>
            <div className="text-[11px] text-slate-500">
              Details kept in queue logs; auto-clean every 30 days.
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Total Recipients</div>
            <div className="mt-1 text-base font-semibold">{totalRecipients}</div>
            <div className="text-[11px] text-slate-500">
              Pending + Sent + Excluded = { (campaign as any).recipientsPending ?? 0 } / {campaign.actualSent ?? 0} / {excludedCount}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Pending Recipients</div>
            <div className="mt-1 text-base font-semibold">
              {(campaign as any).recipientsPending ?? campaign.expectedRecipients ?? 0}
            </div>
          </div>
          <div
            className={`rounded-lg border border-slate-100 bg-slate-50 p-3 ${campaign.actualSent && campaign.actualSent > 0 ? "cursor-pointer hover:bg-slate-100 transition-colors" : ""}`}
            onClick={() => campaign.actualSent && campaign.actualSent > 0 && handleViewHistory(campaign)}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Sent</div>
              {campaign.actualSent && campaign.actualSent > 0 && (
                <Eye className="w-3 h-3 text-slate-400" />
              )}
            </div>
            <div className="mt-1 text-base font-semibold">{campaign.actualSent ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              Excluded Contacts
              {(campaign.errorBreakdown?.length || 0) > 0 && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-slate-400 cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-slate-900 text-slate-50 text-xs">
                      <div className="font-semibold mb-1">Exclusion details</div>
                      <ul className="space-y-1">
                        {campaign.errorBreakdown?.map((e, idx) => (
                          <li key={idx} className="flex justify-between gap-3">
                            <span className="capitalize">
                              {errorLabel(e.code)}
                            </span>
                            <span className="font-semibold">{e.count}</span>
                          </li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="mt-1 text-base font-semibold">
              {excludedCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Excluded = failed + skipped (opt-out/blacklist/invalid). Open queue for per-contact reasons.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show message if no workspace selected
  if (!workspace?.id) {
    return (
      <PageLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Megaphone className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-green-600">WhatsApp Campaigns</h1>
              <p className="text-sm text-gray-500">No workspace selected</p>
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-slate-600">
              Please select a workspace to view and manage your campaigns.
            </p>
          </div>
        </div>
      </PageLayout>
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

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Message History</DialogTitle>
            <DialogDescription>
              Recent 100 messages sent for campaign: <strong>{activeHistoryCampaign}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            {historyLoading ? (
              <div className="py-10 text-center text-slate-500">Loading history...</div>
            ) : sentMessages.length === 0 ? (
              <div className="py-10 text-center text-slate-500">No messages found in history</div>
            ) : (
              <div className="space-y-3">
                {sentMessages.map((msg) => (
                  <div key={msg.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-medium text-slate-700">{msg.phoneNumber}</span>
                      <span>{new Date(msg.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-3 italic">"{msg.messageContent}"</p>
                    <div className="mt-2 flex justify-end">
                      <Badge variant="outline" className="text-[10px] h-4">
                        {msg.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
