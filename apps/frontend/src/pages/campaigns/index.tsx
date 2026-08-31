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
  Rocket,
  Trash2,
  Info,
  ShieldCheck,
  Eye,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ban,
  FileText,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
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
  lastError?: string | null
  expectedRecipients?: number | null
  actualSent?: number | null
  actualFailed?: number | null
  actualSkipped?: number | null
  costPerMessage?: string
  messageContent?: string
  createdAt?: string
  updatedAt?: string
}

// Status configuration
const STATUS_CONFIG: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; icon: React.ReactNode }> = {
  DRAFT: { variant: "outline", icon: <FileText className="w-3 h-3" /> },
  SCHEDULED: { variant: "secondary", icon: <Clock className="w-3 h-3" /> },
  RUNNING: { variant: "default", icon: <Play className="w-3 h-3" /> },
  PAUSED: { variant: "outline", icon: <Pause className="w-3 h-3" /> },
  COMPLETED: { variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
  FAILED: { variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
  CANCELLED: { variant: "destructive", icon: <Ban className="w-3 h-3" /> },
}

const TARGETING_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  ALL: { icon: <Globe className="w-3 h-3" />, label: "All Customers" },
  MANUAL: { icon: <Users className="w-3 h-3" />, label: "Manual Selection" },
  TAGS: { icon: <Sparkles className="w-3 h-3" />, label: "By Tags" },
  SELECTED: { icon: <ListChecks className="w-3 h-3" />, label: "Selected" },
}

const ERROR_LABELS: Record<string, string> = {
  OPT_OUT: "No marketing consent",
  BLACKLISTED: "Blacklisted",
  CHATBOT_INACTIVE: "Chatbot inactive",
  INVALID_PHONE: "Invalid phone",
  NO_CUSTOMER: "Customer not found",
  NOT_TARGET: "No longer in target",
}

// Helper: Format date to English locale
const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return "Not scheduled"
  return new Date(dateStr).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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

  // Delete Confirmation State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null)

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

  const handleRunNow = async (campaign: Campaign) => {
    if (!hasEnoughCreditForPush) {
      toast.error(
        `Insufficient credit to run this campaign. Need $${pushCost.toFixed(
          2
        )}, balance $${creditBalance.toFixed(2)}.`
      )
      return
    }
    try {
      await api.post(`/workspaces/${workspace?.id}/push-campaigns/${campaign.id}/run-now`)
      toast.success("Campaign forced to run")
      loadCampaigns()
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to run campaign")
    }
  }

  const handleDelete = async (campaign: Campaign) => {
    setCampaignToDelete(campaign)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!campaignToDelete) return
    
    try {
      await api.delete(`/workspaces/${workspace?.id}/push-campaigns/${campaignToDelete.id}`)
      toast.success("Campaign deleted")
      loadCampaigns()
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error deleting campaign")
    } finally {
      setDeleteDialogOpen(false)
      setCampaignToDelete(null)
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
        const { data } = await api.post(`/workspaces/${workspace?.id}/push-campaigns`, formData)
        toast.success("Campaign created")
        // 🏪 The merchant package doesn't cover the whole segment: surface the
        // backend's warning so the owner isn't surprised by the mid-run pause.
        if (data?.quotaWarning) {
          toast.warning(data.quotaWarning)
        }
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

    const frequencyLabel = (campaign.frequency || "").toLowerCase() === "once"
      ? "One-shot"
      : campaign.frequency?.charAt(0).toUpperCase() + campaign.frequency?.slice(1).toLowerCase()

    const targetingInfo = TARGETING_CONFIG[campaign.targetingType] || TARGETING_CONFIG.ALL
    const statusInfo = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT

    // Calculate progress percentage
    const sent = campaign.actualSent ?? 0
    const progress = totalRecipients > 0 ? Math.round((sent / totalRecipients) * 100) : 0

    // Message preview (truncate to 80 chars)
    const messagePreview = campaign.messageContent 
      ? campaign.messageContent.length > 80
        ? campaign.messageContent.substring(0, 80) + "..."
        : campaign.messageContent
      : null

    return (
      <div
        key={campaign.id}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Header: Title + Status + Actions */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-slate-900 truncate">{campaign.name}</h3>
              <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                {statusInfo.icon}
                {campaign.isExpired ? "EXPIRED" : campaign.status}
              </Badge>
              {schedulerOff && (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                  Scheduler OFF
                </Badge>
              )}
            </div>
            
            {/* Targeting + Frequency */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="flex items-center gap-1">
                {targetingInfo.icon}
                {targetingInfo.label}
              </Badge>
              <Badge variant="outline" className="capitalize">{frequencyLabel}</Badge>
              <div className="flex items-center gap-1 text-slate-600">
                <Clock className="w-3 h-3" />
                {formatDate(date)}
              </div>
            </div>
          </div>

          {/* Action Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4 text-slate-700" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleEditCampaign(campaign)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Campaign
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRunNow(campaign)}>
                <Rocket className="mr-2 h-4 w-4 text-emerald-600" />
                Run Now
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => (isCampaignActive ? handlePause(campaign) : handleResume(campaign))}
              >
                {isCampaignActive ? (
                  <>
                    <Pause className="mr-2 h-4 w-4 text-amber-600" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4 text-emerald-600" />
                    Resume
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSecurityCheck(campaign)} disabled={securityLoading === campaign.id}>
                <ShieldCheck className={`mr-2 h-4 w-4 ${securityLoading === campaign.id ? 'animate-pulse' : ''}`} />
                Security Check
              </DropdownMenuItem>
              {sent > 0 && (
                <DropdownMenuItem onClick={() => handleViewHistory(campaign)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View History
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate('/queue')}>
                <ListChecks className="mr-2 h-4 w-4" />
                View Queue
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDelete(campaign)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Progress Bar */}
        {totalRecipients > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span>Campaign Progress</span>
              <span>{progress}% ({sent}/{totalRecipients})</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Message Preview */}
        {messagePreview && (
          <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500 mb-1">Message Preview</div>
            <p className="text-sm text-slate-700 italic line-clamp-2">"{messagePreview}"</p>
          </div>
        )}

        {/* Stats Grid: Total, Pending, Sent, Failed+Skipped */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
            <div className="text-xs text-slate-500">Total</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{totalRecipients}</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
            <div className="text-xs text-slate-500">Pending</div>
            <div className="mt-1 text-lg font-semibold text-amber-600">
              {(campaign as any).recipientsPending ?? campaign.expectedRecipients ?? 0}
            </div>
          </div>
          <div 
            className={`rounded-lg border border-slate-100 bg-slate-50 p-3 text-center ${sent > 0 ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''}`}
            onClick={() => sent > 0 && handleViewHistory(campaign)}
            title={sent > 0 ? "Click to view history" : ""}
          >
            <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
              <span>Sent</span>
              {sent > 0 && <Eye className="w-3 h-3" />}
            </div>
            <div className="mt-1 text-lg font-semibold text-emerald-600">{sent}</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
            <div className="text-xs text-slate-500">Failed+Skipped</div>
            <div className="mt-1 text-lg font-semibold text-red-600">{excludedCount}</div>
          </div>
        </div>

        {/* Error Breakdown */}
        {campaign.errorBreakdown && campaign.errorBreakdown.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs font-medium text-amber-900 mb-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Error Breakdown
            </div>
            <div className="space-y-1">
              {campaign.errorBreakdown.map((err, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-amber-800">{ERROR_LABELS[err.code || ""] || err.code || "Unknown"}</span>
                  <Badge variant="outline" className="text-[10px] h-4">{err.count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Error */}
        {campaign.lastError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-xs font-medium text-red-900 mb-1 flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              Last Error
            </div>
            <p className="text-xs text-red-800">{campaign.lastError}</p>
          </div>
        )}

        {/* Schedule Footer */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <div>
                <span className="font-medium">Next:</span> {formatDate(campaign.nextRunAt || campaign.sendAt)}
              </div>
              <div>
                <span className="font-medium">Last:</span> {formatDate(campaign.lastRunAt) || "Never"}
              </div>
            </div>
            {campaign.costPerMessage && (
              <Badge variant="outline" className="text-xs">
                €{parseFloat(campaign.costPerMessage).toFixed(2)}/msg
              </Badge>
            )}
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
          <div className="relative md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search campaigns..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/merchants")}
          >
            Merchants
          </Button>
          <Button onClick={handleAddCampaign} className="bg-emerald-600 hover:bg-emerald-700">
            + New Campaign
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status"></div>
            <div className="mt-3 text-sm text-slate-500">Loading campaigns...</div>
          </div>
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
                      <span>{formatDate(msg.createdAt)}</span>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{campaignToDelete?.name}"</strong>?
              This action cannot be undone. All campaign data and recipient history will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCampaignToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
