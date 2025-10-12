import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Save, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { api } from "../../services/api"
import { useWorkspace } from "../../contexts/WorkspaceContext"

interface Customer {
  id: string
  name: string
  email: string
  phone: string
}

const frequencyOptions = [
  { value: "WEEKLY", label: "Weekly (every 7 days)" },
  { value: "BIWEEKLY", label: "Bi-weekly (every 14 days)" },
  { value: "MONTHLY", label: "Monthly (every 30 days)" },
  { value: "BIMONTHLY", label: "Bi-monthly (every 60 days)" },
  { value: "QUARTERLY", label: "Quarterly (every 90 days)" },
  { value: "SEMIANNUAL", label: "Semi-annual (every 6 months)" },
  { value: "ANNUAL", label: "Annual (yearly)" },
]

export default function CampaignFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { workspace } = useWorkspace()
  const isEdit = !!id

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])

  const [formData, setFormData] = useState({
    name: "",
    messagePreview: "",
    frequency: "MONTHLY",
    targetType: "ALL",
    customerIds: [] as string[],
    isActive: true,
  })

  useEffect(() => {
    loadCustomers()
    if (isEdit && id) {
      loadCampaign(id)
    }
  }, [isEdit, id])

  const loadCustomers = async () => {
    try {
      const { data } = await api.get(`/workspaces/${workspace?.id}/customers`)
      setCustomers(data.data || [])
    } catch (error) {
      console.error("Error loading customers:", error)
    }
  }

  const loadCampaign = async (campaignId: string) => {
    try {
      setLoading(true)
      const { data } = await api.get(
        `/workspaces/${workspace?.id}/campaigns/${campaignId}`
      )
      setFormData({
        name: data.name,
        messagePreview: data.messagePreview,
        frequency: data.frequency,
        targetType: data.targetType,
        customerIds: data.customerIds || [],
        isActive: data.isActive,
      })
    } catch (error) {
      toast.error("Errore nel caricamento della campagna")
      navigate("/campaigns")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error("Please enter campaign name")
      return
    }

    if (!formData.messagePreview.trim()) {
      toast.error("Please enter campaign message")
      return
    }

    if (
      formData.targetType === "SELECTED" &&
      formData.customerIds.length === 0
    ) {
      toast.error("Please select at least one customer")
      return
    }

    try {
      setSaving(true)

      if (isEdit && id) {
        await api.put(`/workspaces/${workspace?.id}/campaigns/${id}`, formData)
        toast.success("Campaign updated!")
      } else {
        await api.post(`/workspaces/${workspace?.id}/campaigns`, formData)
        toast.success("Campaign created!")
      }

      navigate("/campaigns")
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Error saving campaign"
      )
    } finally {
      setSaving(false)
    }
  }

  const insertToken = (token: string) => {
    const textarea = document.getElementById(
      "messagePreview"
    ) as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = formData.messagePreview
    const before = text.substring(0, start)
    const after = text.substring(end)

    setFormData({
      ...formData,
      messagePreview: before + token + after,
    })

    // Set cursor after inserted token
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/campaigns")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to campaigns
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? "Edit Campaign" : "New Campaign"}
        </h1>
        <p className="text-gray-600 mt-1">
          Configure WhatsApp campaign details
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Campaign Name */}
        <div className="bg-white rounded-lg shadow p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Campaign Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            placeholder="e.g., Semi-annual Feedback Request"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
        </div>

        {/* Message */}
        <div className="bg-white rounded-lg shadow p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message *
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Use <code className="bg-gray-100 px-1 py-0.5 rounded">{"{{nome}}"}</code> for customer name.
            Click buttons to insert links with secure tokens.
          </p>

          <textarea
            id="messagePreview"
            value={formData.messagePreview}
            onChange={(e) =>
              setFormData({ ...formData, messagePreview: e.target.value })
            }
            rows={6}
            placeholder={`Hello {{nome}},\n\nDid you like our service?\nLeave us a review: [FEEDBACK]\n\nThank you! 🙏`}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
            required
          />

          {/* Token Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => insertToken("[FEEDBACK]")}
              className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              + [FEEDBACK]
            </button>
            <button
              type="button"
              onClick={() => insertToken("[ORDER_REVIEW]")}
              className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              + [ORDER_REVIEW]
            </button>
            <button
              type="button"
              onClick={() => insertToken("{{nome}}")}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              + {"{{nome}}"}
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            {formData.messagePreview.length}/500 characters
          </p>
        </div>

        {/* Frequency */}
        <div className="bg-white rounded-lg shadow p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Send Frequency *
          </label>
          <select
            value={formData.frequency}
            onChange={(e) =>
              setFormData({ ...formData, frequency: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {frequencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Target Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Recipients *
          </label>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                value="ALL"
                checked={formData.targetType === "ALL"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    targetType: e.target.value,
                    customerIds: [],
                  })
                }
                className="w-4 h-4 text-green-600"
              />
              <div>
                <span className="font-medium">All active customers</span>
                <p className="text-sm text-gray-500">
                  Campaign will be sent to all workspace customers
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                value="SELECTED"
                checked={formData.targetType === "SELECTED"}
                onChange={(e) =>
                  setFormData({ ...formData, targetType: e.target.value })
                }
                className="w-4 h-4 text-green-600"
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
          {formData.targetType === "SELECTED" && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Customers
              </label>
              <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                {customers.map((customer) => (
                  <label
                    key={customer.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={formData.customerIds.includes(customer.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            customerIds: [
                              ...formData.customerIds,
                              customer.id,
                            ],
                          })
                        } else {
                          setFormData({
                            ...formData,
                            customerIds: formData.customerIds.filter(
                              (id) => id !== customer.id
                            ),
                          })
                        }
                      }}
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
              <p className="text-sm text-gray-600 mt-2">
                {formData.customerIds.length} customer(s) selected
              </p>
            </div>
          )}
        </div>

        {/* Active Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
              className="w-5 h-5 text-green-600 rounded"
            />
            <div>
              <span className="font-medium">Active campaign</span>
              <p className="text-sm text-gray-500">
                If inactive, campaign will not send messages
              </p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/campaigns")}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {isEdit ? "Update Campaign" : "Create Campaign"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
