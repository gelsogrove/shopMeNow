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

  // Additional state
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load customers when sheet opens
  useEffect(() => {
    if (open && workspaceId) {
      loadCustomers()
    }
  }, [open, workspaceId])

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
    }
  }, [campaign])

  // Convert an ISO date string to a local datetime-local input value (yyyy-MM-ddTHH:mm)
  const toLocalInputValue = (isoString: string) => {
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) return ""
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const availableTags = Array.from(
    new Set(
      customers.flatMap((customer) =>
        (customer.tags || []).map((tag) => tag.toLowerCase())
      )
    )
  ).sort()

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Please enter campaign name")
      return
    }

    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      toast.error("Please enter campaign message")
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

    const formData = {
      name: name.trim(),
      message: trimmedMessage,
      frequency: normalizedFrequency,
      isActive,
      targetingType: normalizedTargeting,
      targetCustomerIds,
      tagId,
      sendAt: sendAtDate,
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

          {/* Message */}
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

          {/* Targeting */}
          <div className="space-y-4 pt-4 border-t">
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
                <Select
                  value={tagId || ""}
                  onValueChange={setTagId}
                  disabled={!isEditMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

          {/* Schedule Controls */}
          <div className="grid gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="sendAt">First Send At</Label>
              <Input
                id="sendAt"
                type="datetime-local"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
                disabled={!isEditMode}
              />
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
