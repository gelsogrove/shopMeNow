import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  company?: string
  isActive?: boolean
  activeChatbot?: boolean
  isBlacklisted?: boolean
  push_notifications_consent?: boolean
  last_privacy_version_accepted?: string
  tags?: string[]
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Merchant, MerchantPush, merchantApi } from "@/services/merchantApi"

interface Campaign {
  id: string
  name: string
  message?: string
  bodyPreview?: string
  frequency: string
  isActive: boolean
  targetingType: string
  targetCustomerIds: string[]
  tagId?: string | null
  sendAt?: string | null
  throttlePerSecond?: number | null
  batchSize?: number | null
  expectedRecipients?: number | null
  createdAt?: string
  // 🏪 Merchant campaign: content snapshotted from the merchant's push,
  // sends debited from their package quota
  merchantId?: string | null
  merchantPushId?: string | null
  validFrom?: string | null
  validTo?: string | null
  sendWindowStart?: number | null
  sendWindowEnd?: number | null
}

interface CampaignSheetProps {
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any, campaignId?: string) => void
  mode: "view" | "edit"
  workspaceId?: string
}

export function CampaignSheet({
  campaign,
  open,
  onOpenChange,
  onSubmit,
  mode,
  workspaceId,
}: CampaignSheetProps) {
  // Form state
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [frequency, setFrequency] = useState("ONCE")
  const [isActive, setIsActive] = useState(true)
  const [targetingType, setTargetingType] = useState("ALL")
  const [targetCustomerIds, setTargetCustomerIds] = useState<string[]>([])
  const [tagId, setTagId] = useState<string | null>(null)
  const [sendAt, setSendAt] = useState<string>("")
  // 🏪 Merchant campaign state. contentType is the FIRST choice of the form
  // (Andrea, 2026-09-01: "o mandiamo il messaggio o mandiamo il push"): a
  // campaign sends EITHER a merchant creative OR a free message, explicitly.
  const [contentType, setContentType] = useState<"FREE" | "MERCHANT">("FREE")
  const [merchantId, setMerchantId] = useState<string | null>(null)
  const [merchantPushId, setMerchantPushId] = useState<string | null>(null)
  const [validFrom, setValidFrom] = useState<string>("")
  const [validTo, setValidTo] = useState<string>("")
  // 🕗 Daily send window (default 8→19): no notifications at night
  const [sendWindowStart, setSendWindowStart] = useState<number>(8)
  const [sendWindowEnd, setSendWindowEnd] = useState<number>(19)
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [merchantPushes, setMerchantPushes] = useState<MerchantPush[]>([])
  // 📊 Reachable audience, from the backend with the SAME eligibility rules
  // the send job applies — the form shows real numbers, never guesses.
  const [audienceTotal, setAudienceTotal] = useState<number | null>(null)
  const [audienceTags, setAudienceTags] = useState<Array<{ tag: string; count: number }>>([])

  // Additional state
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load customers when sheet opens
  useEffect(() => {
    if (open && workspaceId) {
      loadCustomers()
      loadMerchants()
      loadAudience()
    }
  }, [open, workspaceId])

  const loadAudience = async () => {
    if (!workspaceId) return
    try {
      const { data } = await api.get(`/workspaces/${workspaceId}/push-campaigns/audience`)
      setAudienceTotal(typeof data?.total === "number" ? data.total : null)
      setAudienceTags(Array.isArray(data?.tags) ? data.tags : [])
    } catch (error) {
      logger.error("Error loading campaign audience:", error)
      setAudienceTotal(null)
      setAudienceTags([])
    }
  }

  // The push dropdown offers only the selected merchant's ACTIVE creatives.
  useEffect(() => {
    if (!open || !workspaceId || !merchantId) {
      setMerchantPushes([])
      return
    }
    merchantApi
      .getPushes(workspaceId, merchantId)
      .then((pushes) => setMerchantPushes(pushes.filter((p) => p.isActive)))
      .catch((error) => {
        logger.error("Error loading merchant pushes:", error)
        setMerchantPushes([])
      })
  }, [open, workspaceId, merchantId])

  const loadMerchants = async () => {
    if (!workspaceId) return
    try {
      const all = await merchantApi.getMerchants(workspaceId)
      setMerchants(all.filter((m) => m.isActive))
    } catch (error) {
      // Non-blocking: campaigns without a merchant keep working.
      logger.error("Error loading merchants:", error)
      setMerchants([])
    }
  }

  // Reset form when campaign changes
  useEffect(() => {
    if (campaign) {
      const hasManualRecipients =
        Array.isArray(campaign.targetCustomerIds) &&
        campaign.targetCustomerIds.length > 0
      const hasRecipientCount = (campaign.expectedRecipients || 0) > 0

      const inferredTargeting = (
        campaign.targetingType ||
        (hasManualRecipients || hasRecipientCount ? "MANUAL" : "ALL")
      ).toUpperCase()

      setName(campaign.name || "")
      setMessage(campaign.message || campaign.bodyPreview || "")
      setFrequency((campaign.frequency || "ONCE").toUpperCase())
      setIsActive(campaign.isActive ?? true)
      setTargetingType(inferredTargeting)
      setTargetCustomerIds(campaign.targetCustomerIds || [])
      setTagId(campaign.tagId || null)
      setSendAt(campaign.sendAt ? toLocalInputValue(campaign.sendAt) : "")
      setContentType(campaign.merchantId ? "MERCHANT" : "FREE")
      setMerchantId(campaign.merchantId || null)
      setMerchantPushId(campaign.merchantPushId || null)
      setValidFrom(campaign.validFrom ? toLocalInputValue(campaign.validFrom) : "")
      setValidTo(campaign.validTo ? toLocalInputValue(campaign.validTo) : "")
      setSendWindowStart(campaign.sendWindowStart ?? 8)
      setSendWindowEnd(campaign.sendWindowEnd ?? 19)
    } else {
      // Reset form for new campaign
      setName("")
      setMessage("")
      setFrequency("ONCE")
      setIsActive(true)
      setTargetingType("ALL")
      setTargetCustomerIds([])
      setTagId(null)
      setSendAt("")
      setContentType("FREE")
      setMerchantId(null)
      setMerchantPushId(null)
      setValidFrom("")
      setValidTo("")
      setSendWindowStart(8)
      setSendWindowEnd(19)
    }
  }, [campaign])

  // Convert an ISO date string to a local datetime-local input value (yyyy-MM-ddTHH:mm)
  const toLocalInputValue = (isoString: string) => {
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) return ""
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/workspaces/${workspaceId}/customers`)

      // Filter valid customers for PUSH campaigns (align with backend rules):
      // - isBlacklisted = false (not blocked)
      // - activeChatbot = true (customer chatbot active)
      // - push_notifications_consent = true (have given push consent)
      const validCustomers = (data.data || []).filter((customer: Customer) => {
        const isBlocked = customer.isBlacklisted === true
        const chatbotActive = customer.activeChatbot !== false
        const hasPushConsent = customer.push_notifications_consent === true

        const isValid = !isBlocked && chatbotActive && hasPushConsent

        // Debug log (only excluded customers)
        if (!isValid) {
          const reasons = []
          if (isBlocked) reasons.push("blocked")
          if (!chatbotActive) reasons.push("chatbot inactive")
          if (!hasPushConsent) reasons.push("no push consent")
          logger.info(`Customer ${customer.name} excluded: ${reasons.join(", ")}`)
        }

        return isValid
      })

      setCustomers(validCustomers)

      logger.info(
        `Loaded ${validCustomers.length} valid customers out of ${
          data.data?.length || 0
        } total`
      )
    } catch (error) {
      logger.error("Error loading customers:", error)
      toast.error("Failed to load customers")
    } finally {
      setLoading(false)
    }
  }

  // Tag options: the audience endpoint first (exact-case names + counts with
  // the job's own eligibility rules); when it returns nothing (older backend,
  // network error) derive the same thing from the loaded eligible customers.
  // NEVER lowercased: array targeting (`tags has X`) is case-sensitive.
  const tagOptions =
    audienceTags.length > 0
      ? audienceTags
      : (() => {
          const counts = new Map<string, number>()
          for (const c of customers) {
            for (const raw of c.tags || []) {
              const tag = raw.trim()
              if (!tag) continue
              counts.set(tag, (counts.get(tag) || 0) + 1)
            }
          }
          return Array.from(counts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
        })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Please enter campaign name")
      return
    }

    // EITHER a free message OR a merchant push — never both (Andrea,
    // 2026-09-01: "o mandiamo il messaggio o mandiamo il push"). The
    // contentType choice decides which set of fields counts.
    const isMerchantCampaign = contentType === "MERCHANT"
    const trimmedMessage = isMerchantCampaign ? "" : message.trim()
    if (!isMerchantCampaign && !trimmedMessage) {
      toast.error("Please enter campaign message")
      return
    }
    if (isMerchantCampaign && !merchantId) {
      toast.error("Please select a merchant")
      return
    }
    if (isMerchantCampaign && !merchantPushId) {
      toast.error("Please select which push to send for this merchant")
      return
    }

    if (targetingType === "TAGS" && !tagId) {
      toast.error("Please select a tag")
      return
    }

    if (targetingType === "MANUAL" && targetCustomerIds.length === 0) {
      toast.error("Please select at least one recipient")
      return
    }

    let sendAtDate: string | null = null
    if (sendAt) {
      const parsed = new Date(sendAt)
      if (isNaN(parsed.getTime())) {
        toast.error("Invalid send date/time")
        return
      }
      sendAtDate = parsed.toISOString()
    }

    const normalizedFrequency = (frequency || "ONCE").toUpperCase()
    const normalizedTargeting = (targetingType || "ALL").toUpperCase()

    const toIsoOrNull = (value: string, label: string): string | null | undefined => {
      if (!value) return null
      const parsed = new Date(value)
      if (isNaN(parsed.getTime())) {
        toast.error(`Invalid ${label} date/time`)
        return undefined
      }
      return parsed.toISOString()
    }
    // The validity window applies to EVERY campaign (Andrea, 2026-09-01: "se
    // è finito l'evento non deve più mandare") — also a ONCE campaign paused
    // and resumed after the event must find the closed window and stop.
    const validFromIso = toIsoOrNull(validFrom, "start")
    if (validFromIso === undefined) return
    const validToIso = toIsoOrNull(validTo, "end")
    if (validToIso === undefined) return
    if (validFromIso && validToIso && validToIso <= validFromIso) {
      toast.error("End date must be after start date")
      return
    }
    if (sendWindowStart >= sendWindowEnd) {
      toast.error("Send window: 'from' hour must be before 'to' hour")
      return
    }

    const formData = {
      name: name.trim(),
      message: trimmedMessage,
      frequency: normalizedFrequency,
      isActive,
      targetingType: normalizedTargeting,
      targetCustomerIds,
      tagId,
      sendAt: sendAtDate,
      merchantId: isMerchantCampaign ? merchantId : null,
      merchantPushId: isMerchantCampaign ? merchantPushId : null,
      validFrom: validFromIso,
      validTo: validToIso,
      sendWindowStart,
      sendWindowEnd,
    }

    try {
      setSaving(true)
      await onSubmit(formData, campaign?.id)
    } catch (error) {
      logger.error("Error submitting campaign:", error)
      const apiMessage =
        (error as any)?.response?.data?.message ||
        (error as any)?.response?.data?.error
      if (apiMessage) {
        toast.error(apiMessage)
      } else {
        toast.error("Error saving campaign")
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleCustomerSelection = (customerId: string) => {
    if (targetCustomerIds.includes(customerId)) {
      setTargetCustomerIds(targetCustomerIds.filter((id) => id !== customerId))
    } else {
      setTargetCustomerIds([...targetCustomerIds, customerId])
    }
  }

  const isEditMode = mode === "edit"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {campaign
              ? isEditMode
                ? "Edit Campaign"
                : "Campaign Details"
              : "New Campaign"}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? "Modify campaign settings and recipients"
              : "View campaign details"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Whether the campaign should run according to schedule.
              </p>
            </div>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={!isEditMode}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Campaign Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Campaign Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Weekly Offers"
                disabled={!isEditMode}
                required
              />
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
            <Select
              value={frequency || "ONCE"}
              onValueChange={(v) => setFrequency(v.toUpperCase())}
              disabled={!isEditMode}
              required
            >
                <SelectTrigger id="frequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONCE">Once</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly (3 Months)</SelectItem>
                  <SelectItem value="SEMIANNUAL">Semiannual (6 Months)</SelectItem>
                </SelectContent>
              </Select>
              {frequency === "ONCE" && (
                <p className="text-xs text-muted-foreground">
                  One-time campaigns turn off automatically after the first run.
                </p>
              )}
            </div>
          </div>

          {/* ── STEP 1 · WHAT to send ─────────────────────────────────────
              One explicit choice (Andrea, 2026-09-01: "o mandiamo il
              messaggio o mandiamo il push"): merchant creative OR free
              message. Each shows only its own fields. */}
          <div className="space-y-4 pt-4 border-t">
            <Label className="text-sm font-semibold">1 · What to send</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!isEditMode}
                onClick={() => setContentType("FREE")}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  contentType === "FREE"
                    ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-semibold">Free message</div>
                <div className="text-xs text-slate-500">
                  Your own text, e.g. a Pro Loco announcement
                </div>
              </button>
              <button
                type="button"
                disabled={!isEditMode}
                onClick={() => setContentType("MERCHANT")}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  contentType === "MERCHANT"
                    ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-semibold">Merchant push</div>
                <div className="text-xs text-slate-500">
                  A creative from a merchant — debits their package
                </div>
              </button>
            </div>

            {contentType === "MERCHANT" && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      Merchant <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={merchantId ?? ""}
                      onValueChange={(v) => {
                        setMerchantId(v || null)
                        setMerchantPushId(null)
                      }}
                      disabled={!isEditMode}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a merchant" />
                      </SelectTrigger>
                      <SelectContent>
                        {merchants.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} · {m.quotaRemaining} push left
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {merchants.length === 0 && (
                      <p className="text-xs text-amber-600">
                        No active merchants yet — create one in Merchants first.
                      </p>
                    )}
                  </div>
                  {merchantId && (
                    <div className="space-y-2">
                      <Label>
                        Push <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={merchantPushId ?? ""}
                        onValueChange={(v) => setMerchantPushId(v || null)}
                        disabled={!isEditMode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a creative" />
                        </SelectTrigger>
                        <SelectContent>
                          {merchantPushes.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {merchantPushes.length === 0 && (
                        <p className="text-xs text-amber-600">
                          This merchant has no active pushes — add one in their page first.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {merchantPushId && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">
                      This is what customers will receive:
                    </p>
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-2">
                      {/* Uploaded creative photo, when there is one — same
                          public URL WhatsApp will fetch; hidden if none. */}
                      <img
                        src={`/api/v1/public/merchant-pushes/${merchantPushId}/photo.jpg`}
                        alt="Push photo"
                        className="max-h-40 rounded-md border border-emerald-200 object-contain"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = "none"
                        }}
                      />
                      <div className="whitespace-pre-wrap">
                        {(() => {
                          const p = merchantPushes.find((x) => x.id === merchantPushId)
                          if (!p) return "The campaign will send the selected push content."
                          return `*${p.title}*\n\n${p.text}${p.location ? `\n\n📍 ${p.location}` : ""}`
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Message — free-text campaigns only: either message OR push. */}
          {contentType === "FREE" && (
          <div className="space-y-2">
            <Label htmlFor="campaign-message">
              Message <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="campaign-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Hello {{name}}! Check out our new offers..."
              className="font-mono text-sm"
              disabled={!isEditMode}
              required
            />
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex flex-wrap gap-2">
              <code className="px-1 py-0.5 rounded bg-white">{"{{name}}"}</code>
              <code className="px-1 py-0.5 rounded bg-white">{"{{firstName}}"}</code>
              <code className="px-1 py-0.5 rounded bg-white">{"{{lastName}}"}</code>
              <code className="px-1 py-0.5 rounded bg-white">{"{{email}}"}</code>
              <code className="px-1 py-0.5 rounded bg-white">{"{{company}}"}</code>
            </div>
          </div>
          )}

          {/* ── STEP 2 · WHO receives it ── */}
          <div className="space-y-4 pt-4 border-t">
            <Label className="text-sm font-semibold">2 · Who receives it</Label>
            <div className="space-y-2">
              <Label>Targeting Type</Label>
              <Select
                value={targetingType || "ALL"}
                onValueChange={(v) => {
                  setTargetingType(v.toUpperCase())
                  // Reset recipients when switching away from manual to avoid stale counts
                  if (v.toUpperCase() !== "MANUAL") {
                    setTargetCustomerIds([])
                  }
                }}
                disabled={!isEditMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select targeting" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Active Customers</SelectItem>
                  <SelectItem value="MANUAL">Manual Selection</SelectItem>
                  <SelectItem value="TAGS">By Tag</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetingType === "TAGS" && (
              <div className="space-y-2">
                <Label>Select Tag</Label>
                {tagOptions.length === 0 ? (
                  <p className="text-xs text-slate-500 rounded-md border border-dashed p-3">
                    No tagged customers with push consent yet. Tags (e.g. INLOCO) are
                    added automatically by the chatbot during conversations — as guests
                    opt in, they will appear here with their counts.
                  </p>
                ) : (
                  <Select
                    value={tagId || ""}
                    onValueChange={setTagId}
                    disabled={!isEditMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tag" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Exact-case values from the backend: array targeting is
                          case-sensitive, a lowercased tag would match nobody. */}
                      {tagOptions.map(({ tag, count }) => (
                        <SelectItem key={tag} value={tag}>
                          {tag} · {count} customer{count === 1 ? "" : "s"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Live estimate, from the same eligibility rules the send job uses */}
            <div className="rounded-md bg-slate-50 border px-3 py-2 text-sm text-slate-700">
              {(() => {
                if (targetingType === "MANUAL")
                  return <>Will reach <b>{targetCustomerIds.length}</b> selected customer{targetCustomerIds.length === 1 ? "" : "s"}.</>
                if (targetingType === "TAGS") {
                  const t = tagOptions.find((x) => x.tag === tagId)
                  return tagId
                    ? <>Will reach <b>{t?.count ?? 0}</b> customer{(t?.count ?? 0) === 1 ? "" : "s"} tagged {tagId}.</>
                    : <>Pick a tag to see how many customers it reaches.</>
                }
                return audienceTotal === null
                  ? <>Estimating reachable customers…</>
                  : <>Will reach <b>{audienceTotal}</b> customer{audienceTotal === 1 ? "" : "s"} with push consent.</>
              })()}
            </div>

            {targetingType === "MANUAL" && (
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <Label>Recipients ({targetCustomerIds.length})</Label>
                  {isEditMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setTargetCustomerIds(
                          targetCustomerIds.length === customers.length
                            ? []
                            : customers.map((c) => c.id)
                        )
                      }
                    >
                      {targetCustomerIds.length === customers.length
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-80 rounded-md border p-4 bg-slate-50">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Loading customers...</p>
                      </div>
                    </div>
                  ) : customers.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      No active customers with push consent found.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {customers.map((customer) => (
                        <div
                          key={customer.id}
                          className="flex items-start space-x-2 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <Checkbox
                            id={customer.id}
                            checked={targetCustomerIds.includes(customer.id)}
                            onCheckedChange={() =>
                              toggleCustomerSelection(customer.id)
                            }
                            disabled={!isEditMode}
                            className="mt-1"
                          />
                          <Label
                            htmlFor={customer.id}
                            className="flex-1 text-sm font-normal cursor-pointer"
                          >
                            <div className="font-medium text-slate-900 truncate" title={customer.name}>
                              {customer.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate" title={customer.phone}>
                              {customer.phone}
                            </div>
                            {customer.tags && customer.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {customer.tags.slice(0, 3).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {customer.tags.length > 3 && (
                                  <span className="text-xs text-slate-500">
                                    +{customer.tags.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* ── STEP 3 · WHEN ── */}
          <div className="grid gap-4 pt-4 border-t">
            <Label className="text-sm font-semibold">3 · When</Label>
            <div className="space-y-2">
              <Label htmlFor="sendAt">First Send At</Label>
              <Input
                id="sendAt"
                type="datetime-local"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
                disabled={!isEditMode}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to send at the next scheduler run.
              </p>
            </div>
            {/* 🕗 Daily send window (Andrea, 2026-09-01: "dalle 8 alle 19 di
                default") — hours in the workspace timezone; the scheduler
                postpones anything outside them. */}
            <div className="space-y-2">
              <Label>Send between</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={String(sendWindowStart)}
                  onValueChange={(v) => setSendWindowStart(Number(v))}
                  disabled={!isEditMode}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-slate-500">and</span>
                <Select
                  value={String(sendWindowEnd)}
                  onValueChange={(v) => setSendWindowEnd(Number(v))}
                  disabled={!isEditMode}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Nothing is sent outside these hours — a run due at night waits
                for the window to open.
              </p>
            </div>

            {/* Validity window — for EVERY campaign: when the event is over,
                nothing goes out anymore, whatever happened in between. */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="valid-from">Valid from</Label>
                  <Input
                    id="valid-from"
                    type="datetime-local"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    disabled={!isEditMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid-to">Valid to</Label>
                  <Input
                    id="valid-to"
                    type="datetime-local"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    disabled={!isEditMode}
                  />
                  <p className="text-xs text-muted-foreground">
                    The campaign stops by itself after this date — e.g. when the
                    event is over, nothing more is sent.
                  </p>
                </div>
              </div>
          </div>

          {/* Footer Actions */}
          {isEditMode && (
            <SheetFooter className="gap-2 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-green-600 hover:bg-green-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : campaign ? (
                  "Save Changes"
                ) : (
                  "Create Campaign"
                )}
              </Button>
            </SheetFooter>
          )}
        </form>
      </SheetContent>
    </Sheet>
  )
}
