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
  isBlacklisted?: boolean
  push_notifications_consent?: boolean
  last_privacy_version_accepted?: string
}

interface Campaign {
  id: string
  name: string
  bodyPreview?: string
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
  const [messagePreview, setMessagePreview] = useState("")
  const [sendAt, setSendAt] = useState<string>("")
  const [throttlePerSecond, setThrottlePerSecond] = useState<number | "">("")
  const [batchSize, setBatchSize] = useState<number | "">("")
  const [recipientMode, setRecipientMode] = useState<"ALL" | "SELECTED">("ALL")
  const [customerIds, setCustomerIds] = useState<string[]>([])

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
      setName(campaign.name || "")
      setMessagePreview(campaign.bodyPreview || "")
      setSendAt(
        campaign.sendAt ? campaign.sendAt.slice(0, 16) : ""
      )
      setThrottlePerSecond(
        campaign.throttlePerSecond !== undefined && campaign.throttlePerSecond !== null
          ? campaign.throttlePerSecond
          : ""
      )
      setBatchSize(
        campaign.batchSize !== undefined && campaign.batchSize !== null
          ? campaign.batchSize
          : ""
      )
      setRecipientMode("ALL")
      setCustomerIds([])
    } else {
      // Reset form for new campaign
      setName("")
      setMessagePreview("")
      setSendAt("")
      setThrottlePerSecond("")
      setBatchSize("")
      setRecipientMode("ALL")
      setCustomerIds([])
    }
  }, [campaign])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/workspaces/${workspaceId}/customers`)

      // 🔥 Filtra clienti validi per campagne PUSH:
      // - isBlacklisted = false (non bloccati)
      // - isActive = true (attivi)
      // - push_notifications_consent = true (hanno dato consenso push)
      const validCustomers = (data.data || []).filter((customer: Customer) => {
        const isBlocked = customer.isBlacklisted === true
        const isActive = customer.isActive !== false
        const hasPushConsent = customer.push_notifications_consent === true

        const isValid = !isBlocked && isActive && hasPushConsent

        // Log per debug (solo clienti esclusi)
        if (!isValid) {
          const reasons = []
          if (isBlocked) reasons.push("blocked")
          if (!isActive) reasons.push("inactive")
          if (!hasPushConsent) reasons.push("no push consent")
          logger.info(`Cliente ${customer.name} escluso: ${reasons.join(", ")}`)
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

    const trimmedMessage = messagePreview.trim()
    if (!trimmedMessage) {
      toast.error("Please enter campaign message (body)")
      return
    }

    const selectedIds =
      recipientMode === "ALL" ? customers.map((c) => c.id) : customerIds

    if (selectedIds.length === 0) {
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

    const formData = {
      name: name.trim(),
      bodyPreview: trimmedMessage,
      sendAt: sendAtDate,
      throttlePerSecond:
        throttlePerSecond === "" ? undefined : Number(throttlePerSecond),
      batchSize: batchSize === "" ? undefined : Number(batchSize),
      recipients: {
        customerIds: selectedIds,
      },
    }

    try {
      setSaving(true)
      await onSubmit(formData, campaign?.id)
    } catch (error) {
      logger.error("Error submitting campaign:", error)
    } finally {
      setSaving(false)
    }
  }

  const toggleCustomerSelection = (customerId: string) => {
    if (customerIds.includes(customerId)) {
      setCustomerIds(customerIds.filter((id) => id !== customerId))
    } else {
      setCustomerIds([...customerIds, customerId])
    }
  }

  const isEditMode = mode === "edit"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
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
          {/* Campaign Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Campaign Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Semi-annual Feedback Request"
              disabled={!isEditMode}
              required
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="campaign-message">
              Message <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-gray-500">
              Write your campaign message here.
            </p>
            <Textarea
              id="campaign-message"
              value={messagePreview}
              onChange={(e) => setMessagePreview(e.target.value)}
              rows={6}
              placeholder="Hello!\n\nDid you like our service?\n\nThank you! 🙏"
              className="font-mono text-sm"
              disabled={!isEditMode}
              required
            />

            <p className="text-xs text-gray-500">
              {messagePreview.length}/500 characters
            </p>

            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Available variables</div>
              <div className="flex flex-wrap gap-2">
                <code className="px-2 py-1 rounded bg-white border border-slate-200">{"{{name}}"}</code>
                <code className="px-2 py-1 rounded bg-white border border-slate-200">{"{{firstName}}"}</code>
                <code className="px-2 py-1 rounded bg-white border border-slate-200">{"{{lastName}}"}</code>
                <code className="px-2 py-1 rounded bg-white border border-slate-200">{"{{email}}"}</code>
                <code className="px-2 py-1 rounded bg-white border border-slate-200">{"{{phone}}"}</code>
                <code className="px-2 py-1 rounded bg-white border border-slate-200">{"{{company}}"}</code>
                <code className="px-2 py-1 rounded bg-white border border-slate-200">{"{{workspace}}"}</code>
              </div>
              <p className="text-[11px] text-slate-600">
                Variables are replaced per recipient. Missing data stay as placeholders.
              </p>
              <p className="text-[11px] text-slate-600">
                🌍 Each message is translated automatically to the customer&apos;s language (it/en/es/pt) before sending.
              </p>
            </div>
          </div>

          {/* Schedule & controls */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sendAt">Send time (optional)</Label>
              <Input
                id="sendAt"
                type="datetime-local"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
                disabled={!isEditMode}
              />
              <p className="text-xs text-gray-500">
                Leave empty to send as soon as the scheduler picks the job.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="throttle">Msgs/sec</Label>
                <Input
                  id="throttle"
                  type="number"
                  min={1}
                  value={throttlePerSecond}
                  onChange={(e) =>
                    setThrottlePerSecond(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  placeholder="Default (10)"
                  disabled={!isEditMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batchSize">Batch size</Label>
                <Input
                  id="batchSize"
                  type="number"
                  min={1}
                  value={batchSize}
                  onChange={(e) =>
                    setBatchSize(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="Default (50)"
                  disabled={!isEditMode}
                />
              </div>
            </div>
          </div>

          {/* Target Selection */}
          <div className="space-y-3">
            <Label>
              Recipients <span className="text-red-500">*</span>
            </Label>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  value="ALL"
                  checked={recipientMode === "ALL"}
                  onChange={(e) => {
                    setRecipientMode(e.target.value as "ALL" | "SELECTED")
                    setCustomerIds([])
                  }}
                  disabled={!isEditMode}
                  className="mt-1 w-4 h-4 text-green-600"
                />
                <div>
                  <span className="font-medium">All valid customers</span>
                  <p className="text-sm text-gray-500">
                    Campaign will be sent to all filtered customers ({customers.length})
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  value="SELECTED"
                  checked={recipientMode === "SELECTED"}
                  onChange={(e) =>
                    setRecipientMode(e.target.value as "ALL" | "SELECTED")
                  }
                  disabled={!isEditMode}
                  className="mt-1 w-4 h-4 text-green-600"
                />
                <div>
                  <span className="font-medium">Specific customers</span>
                  <p className="text-sm text-gray-500">
                    Manually select recipients
                  </p>
                </div>
              </label>
            </div>

            {/* Customer Selection (if SELECTED) */}
            {recipientMode === "SELECTED" && (
              <div className="mt-4">
                <Label className="mb-2">Select Customers</Label>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                    {customers.map((customer) => (
                      <label
                        key={customer.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={customerIds.includes(customer.id)}
                          onChange={() => toggleCustomerSelection(customer.id)}
                          disabled={!isEditMode}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {customer.name}
                            {customer.company && (
                              <span className="text-gray-500 font-normal"> - {customer.company}</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            {customer.email} • {customer.phone}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-600 mt-2">
                  {customerIds.length} customer(s) selected
                </p>
              </div>
            )}
            {recipientMode === "ALL" && (
              <p className="text-sm text-gray-600 mt-1">
                All {customers.length} eligible customers will receive this campaign.
              </p>
            )}
          </div>

          {/* Footer Actions */}
          {isEditMode && (
            <SheetFooter className="gap-2">
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
