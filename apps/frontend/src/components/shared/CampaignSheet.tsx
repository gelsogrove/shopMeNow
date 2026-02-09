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
  const [throttlePerSecond, setThrottlePerSecond] = useState<number | "">("")
  const [batchSize, setBatchSize] = useState<number | "">("")

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
      setMessage(campaign.message || campaign.bodyPreview || "")
      setFrequency(campaign.frequency || "ONCE")
      setIsActive(campaign.isActive ?? true)
      setTargetingType(campaign.targetingType || "ALL")
      setTargetCustomerIds(campaign.targetCustomerIds || [])
      setTagId(campaign.tagId || null)
      setSendAt(campaign.sendAt ? campaign.sendAt.slice(0, 16) : "")
      setThrottlePerSecond(
        campaign.throttlePerSecond !== undefined &&
          campaign.throttlePerSecond !== null
          ? campaign.throttlePerSecond
          : ""
      )
      setBatchSize(
        campaign.batchSize !== undefined && campaign.batchSize !== null
          ? campaign.batchSize
          : ""
      )
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
      setThrottlePerSecond("")
      setBatchSize("")
    }
  }, [campaign])

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

      // Filter valid customers for PUSH campaigns:
      // - isBlacklisted = false (not blocked)
      // - isActive = true (active)
      // - push_notifications_consent = true (have given push consent)
      const validCustomers = (data.data || []).filter((customer: Customer) => {
        const isBlocked = customer.isBlacklisted === true
        const isActive = customer.isActive !== false
        const hasPushConsent = customer.push_notifications_consent === true

        const isValid = !isBlocked && isActive && hasPushConsent

        // Debug log (only excluded customers)
        if (!isValid) {
          const reasons = []
          if (isBlocked) reasons.push("blocked")
          if (!isActive) reasons.push("inactive")
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

    const formData = {
      name: name.trim(),
      message: trimmedMessage,
      frequency,
      isActive,
      targetingType,
      targetCustomerIds,
      tagId,
      sendAt: sendAtDate,
      throttlePerSecond:
        throttlePerSecond === "" ? undefined : Number(throttlePerSecond),
      batchSize: batchSize === "" ? undefined : Number(batchSize),
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
    if (targetCustomerIds.includes(customerId)) {
      setTargetCustomerIds(targetCustomerIds.filter((id) => id !== customerId))
    } else {
      setTargetCustomerIds([...targetCustomerIds, customerId])
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
                value={frequency}
                onValueChange={setFrequency}
                disabled={!isEditMode}
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
                value={targetingType}
                onValueChange={setTargetingType}
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
                <ScrollArea className="h-48 rounded-md border p-4 bg-slate-50">
                  {customers.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      No active customers with push consent found.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {customers.map((customer) => (
                        <div
                          key={customer.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={customer.id}
                            checked={targetCustomerIds.includes(customer.id)}
                            onCheckedChange={() =>
                              toggleCustomerSelection(customer.id)
                            }
                            disabled={!isEditMode}
                          />
                          <Label
                            htmlFor={customer.id}
                            className="text-sm font-normal cursor-pointer truncate"
                            title={`${customer.name} (${customer.phone})`}
                          >
                            {customer.name}
                            <span className="text-gray-400 ml-1">
                              ({customer.phone})
                            </span>
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
          <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
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
                  placeholder="10"
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
                    setBatchSize(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  placeholder="50"
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
                    setRecipientMode(e.target.value as "ALL" | "SELECTED" | "TAGS")
                    setCustomerIds([])
                    setSelectedTags([])
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
                  onChange={(e) => {
                    setRecipientMode(e.target.value as "ALL" | "SELECTED" | "TAGS")
                    setSelectedTags([])
                  }}
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

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  value="TAGS"
                  checked={recipientMode === "TAGS"}
                  onChange={(e) => {
                    setRecipientMode(e.target.value as "ALL" | "SELECTED" | "TAGS")
                    setCustomerIds([])
                  }}
                  disabled={!isEditMode}
                  className="mt-1 w-4 h-4 text-green-600"
                />
                <div>
                  <span className="font-medium">Customers by tags</span>
                  <p className="text-sm text-gray-500">
                    Send to customers matching selected tags
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
            {recipientMode === "TAGS" && (
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label>Select Tags</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault()
                          addTagsFromInput()
                        }
                      }}
                      placeholder="milano, roma, pasta"
                      disabled={!isEditMode}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addTagsFromInput}
                      disabled={!isEditMode}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Tags are matched case-insensitively.
                  </p>
                </div>

                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 border border-green-200 hover:bg-green-200"
                        disabled={!isEditMode}
                      >
                        {tag} ✕
                      </button>
                    ))}
                  </div>
                )}

                {availableTags.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Available tags</p>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-2 py-1 rounded-full text-xs border ${
                            selectedTags.includes(tag)
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-white text-gray-700 border-gray-200"
                          }`}
                          disabled={!isEditMode}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  {taggedCustomerIds.length} customer(s) match the selected tags
                </p>
              </div>
            )}
            {recipientMode === "ALL" && (
              <p className="text-sm text-gray-600 mt-1">
                All {customers.length} eligible customers will receive this campaign.
              </p>
            )}
            {recipientMode === "TAGS" && selectedTags.length === 0 && (
              <p className="text-sm text-gray-600 mt-1">
                Select one or more tags to build your audience.
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
