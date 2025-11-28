import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
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
  isBlacklisted?: boolean
  push_notifications_consent?: boolean
  last_privacy_version_accepted?: string
}

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
}

interface CampaignSheetProps {
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any, campaignId?: string) => void
  mode: "view" | "edit"
  workspaceId?: string
}

const frequencyOptions = [
  { value: "ONCE", label: "One-time (send once)" },
  { value: "WEEKLY", label: "Weekly (every 7 days)" },
  { value: "BIWEEKLY", label: "Bi-weekly (every 14 days)" },
  { value: "MONTHLY", label: "Monthly (every 30 days)" },
  { value: "BIMONTHLY", label: "Bi-monthly (every 60 days)" },
  { value: "QUARTERLY", label: "Quarterly (every 90 days)" },
  { value: "SEMIANNUAL", label: "Semi-annual (every 6 months)" },
  { value: "ANNUAL", label: "Annual (yearly)" },
]

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
  const [frequency, setFrequency] = useState("MONTHLY")
  const [targetType, setTargetType] = useState("ALL")
  const [customerIds, setCustomerIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)

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
      setMessagePreview(campaign.messagePreview || "")
      setFrequency(campaign.frequency || "MONTHLY")
      setTargetType(campaign.targetType || "ALL")
      setCustomerIds(campaign.customerIds || [])
      setIsActive(campaign.isActive !== undefined ? campaign.isActive : true)
    } else {
      // Reset form for new campaign
      setName("")
      setMessagePreview("")
      setFrequency("MONTHLY")
      setTargetType("ALL")
      setCustomerIds([])
      setIsActive(true)
    }
  }, [campaign])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/workspaces/${workspaceId}/customers`)

      // 🔥 Filtra clienti validi per campagne:
      // - Solo isBlacklisted = false (clienti non bloccati)
      // - isActive = true (clienti attivi)
      // NOTA: push_notifications_consent e GDPR verranno verificati al momento dell'invio
      const validCustomers = (data.data || []).filter((customer: Customer) => {
        const isBlocked = customer.isBlacklisted === true
        const isActive = customer.isActive !== false // default true se undefined

        const isValid = !isBlocked && isActive

        // Log per debug (solo clienti esclusi)
        if (!isValid) {
          const reasons = []
          if (isBlocked) reasons.push("blocked")
          if (!isActive) reasons.push("inactive")
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

    if (!messagePreview.trim()) {
      toast.error("Please enter campaign message")
      return
    }

    if (targetType === "SELECTED" && customerIds.length === 0) {
      toast.error("Please select at least one customer")
      return
    }

    const formData = {
      name,
      messagePreview,
      frequency,
      targetType,
      customerIds,
      isActive,
    }

    try {
      setSaving(true)
      onSubmit(formData, campaign?.id)
    } catch (error) {
      logger.error("Error submitting campaign:", error)
    } finally {
      setSaving(false)
    }
  }

  const insertToken = (token: string) => {
    const textarea = document.getElementById(
      "campaign-message"
    ) as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = messagePreview
    const before = text.substring(0, start)
    const after = text.substring(end)

    setMessagePreview(before + token + after)

    // Set cursor after inserted token
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + token.length, start + token.length)
    }, 0)
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
              Use{" "}
              <code className="bg-gray-100 px-1 py-0.5 rounded">
                {"{{nome}}"}
              </code>{" "}
              for customer name. Click buttons to insert links with secure
              tokens.
            </p>
            <Textarea
              id="campaign-message"
              value={messagePreview}
              onChange={(e) => setMessagePreview(e.target.value)}
              rows={6}
              placeholder={`Hello {{nome}},\n\nDid you like our service?\nLeave us a review: [FEEDBACK]\n\nThank you! 🙏`}
              className="font-mono text-sm"
              disabled={!isEditMode}
              required
            />

            {/* Token Buttons */}
            {isEditMode && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertToken("[FEEDBACK]")}
                  className="text-xs bg-green-50 border-green-200 hover:bg-green-100"
                >
                  + [FEEDBACK]
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertToken("[ORDER_REVIEW]")}
                  className="text-xs bg-green-50 border-green-200 hover:bg-green-100"
                >
                  + [ORDER_REVIEW]
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertToken("{{nome}}")}
                  className="text-xs"
                >
                  + {"{{nome}}"}
                </Button>
              </div>
            )}

            <p className="text-xs text-gray-500">
              {messagePreview.length}/500 characters
            </p>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">
              Send Frequency <span className="text-red-500">*</span>
            </Label>
            <Select
              value={frequency}
              onValueChange={setFrequency}
              disabled={!isEditMode}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  checked={targetType === "ALL"}
                  onChange={(e) => {
                    setTargetType(e.target.value)
                    setCustomerIds([])
                  }}
                  disabled={!isEditMode}
                  className="mt-1 w-4 h-4 text-green-600"
                />
                <div>
                  <span className="font-medium">All active customers</span>
                  <p className="text-sm text-gray-500">
                    Campaign will be sent to all workspace customers
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  value="SELECTED"
                  checked={targetType === "SELECTED"}
                  onChange={(e) => setTargetType(e.target.value)}
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
            {targetType === "SELECTED" && (
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
                          <p className="font-medium text-sm">{customer.name}</p>
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
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={!isEditMode}
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              <span className="font-medium">Active campaign</span>
              <p className="text-sm text-gray-500 font-normal">
                If inactive, campaign will not send messages
              </p>
            </Label>
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
