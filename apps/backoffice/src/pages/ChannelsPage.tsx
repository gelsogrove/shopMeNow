import { useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Bug, CheckCircle2, AlertCircle, X, Phone } from "lucide-react"
import { toast } from "@/lib/toast"
import { workspaceApi } from "@/services/workspaceApi"
import ChatWidget from "@/components/ChatWidget"
import { IMG_BASE_URL } from "@/config"

interface Channel {
  id: string
  workspaceId?: string
  name: string
  description?: string
  url?: string
  whatsappPhoneNumber?: string
  debugMode?: boolean
  logoUrl?: string
  language?: string
  ownerId?: string
  planType?: string
  isActive?: boolean
  channelStatus?: boolean
  deletedAt?: string | null
  creditBalance?: number
  owner?: {
    id: string
    email: string
    firstName?: string
    lastName?: string
    status?: string
  }
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [widgetOpen, setWidgetOpen] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Channel | null>(null)
  const [widgetLanguages, setWidgetLanguages] = useState<Record<string, string>>({})
  const [playgroundPhoneNumbers, setPlaygroundPhoneNumbers] = useState<Record<string, string>>({})
  const [phoneValidationErrors, setPhoneValidationErrors] = useState<Record<string, string>>({})
  const [widgetAutoOpen, setWidgetAutoOpen] = useState(false)
  const apiUrl = import.meta.env.VITE_API_URL || undefined

  /**
   * Validate phone number prefix
   * Supported: +39 (IT), +34 (ES), +351 (PT), +1 (EN), +44 (EN)
   */
  const validatePhoneNumber = (phone: string): { valid: boolean; message?: string; detectedLanguage?: string } => {
    if (!phone || phone.trim() === "") {
      return { valid: true } // Empty is valid (will use default)
    }

    const trimmed = phone.trim()

    // Must start with +
    if (!trimmed.startsWith("+")) {
      return { valid: false, message: "Phone must start with + (e.g., +39)" }
    }

    // Detect language from prefix
    if (trimmed.startsWith("+39")) {
      return { valid: true, detectedLanguage: "it" }
    }
    if (trimmed.startsWith("+34")) {
      return { valid: true, detectedLanguage: "es" }
    }
    if (trimmed.startsWith("+351")) {
      return { valid: true, detectedLanguage: "pt" }
    }
    if (trimmed.startsWith("+1") || trimmed.startsWith("+44")) {
      return { valid: true, detectedLanguage: "en" }
    }

    // Unknown prefix - still valid but defaults to English
    return { valid: true, detectedLanguage: "en" }
  }

  const handlePhoneNumberChange = (workspaceId: string, value: string) => {
    setPlaygroundPhoneNumbers((prev) => ({
      ...prev,
      [workspaceId]: value,
    }))

    // Validate and auto-update language
    const validation = validatePhoneNumber(value)
    if (validation.valid) {
      setPhoneValidationErrors((prev) => {
        const next = { ...prev }
        delete next[workspaceId]
        return next
      })

      // Auto-update language if detected
      if (validation.detectedLanguage) {
        setWidgetLanguages((prev) => ({
          ...prev,
          [workspaceId]: validation.detectedLanguage!,
        }))
      }
    } else {
      setPhoneValidationErrors((prev) => ({
        ...prev,
        [workspaceId]: validation.message || "Invalid phone number",
      }))
    }
  }

  const normalizeLanguage = (value?: string) => {
    const normalized = (value || "").toLowerCase()
    if (normalized.startsWith("it")) return "it"
    if (normalized.startsWith("en")) return "en"
    if (normalized.startsWith("es")) return "es"
    if (normalized.startsWith("pt")) return "pt"
    return "it"
  }

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const allChannels = await workspaceApi.getAll()
        console.log("🔍 CHANNELS RICEVUTI:", allChannels)
        console.log("🔍 LOGOS:", allChannels.map((c: any) => ({ name: c.name, logoUrl: c.logoUrl })))
        const visibleChannels = allChannels.filter((channel: Channel) => !channel.deletedAt)
        setChannels(visibleChannels)
        setWidgetLanguages((prev) => {
          const next = { ...prev }
          visibleChannels.forEach((channel: Channel) => {
            if (!next[channel.id]) {
              next[channel.id] = normalizeLanguage(channel.language)
            }
          })
          return next
        })
      } catch (error) {
        console.error("Failed to fetch channels:", error)
        toast.error("Failed to load channels")
      } finally {
        setLoading(false)
      }
    }

    fetchChannels()
  }, [])

  // Apri widget quando selezionato
  useEffect(() => {
    if (selectedWorkspaceId) {
      setWidgetOpen(true)
    }
  }, [selectedWorkspaceId])

  const getWorkspaceId = (channel: Channel) => channel.id || channel.workspaceId || ""

  const handleLogoClick = (channel: Channel, autoOpen = false) => {
    const workspaceId = getWorkspaceId(channel)
    if (!workspaceId) {
      toast.error("Missing workspace ID for this channel. Please refresh.")
      return
    }
    setWidgetAutoOpen(autoOpen)
    setSelectedWorkspace(channel)
    setSelectedWorkspaceId(workspaceId)
    setWidgetOpen(true)
  }

  const handleLanguageChange = (workspaceId: string, value: string) => {
    setWidgetLanguages((prev) => ({
      ...prev,
      [workspaceId]: value,
    }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Channels</h1>
        <div className="bg-white rounded-lg border p-6 text-center">
          <p className="text-gray-600">Loading channels...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Channels</h1>
        <p className="text-gray-600 mt-2">
          Test your chatbot widget on all your channels. Usage here is completely free.
        </p>
      </div>

      {channels.length === 0 ? (
        <div className="bg-white rounded-lg border p-6 text-center">
          <p className="text-gray-600">No channels available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map((channel) => {
            const workspaceId = getWorkspaceId(channel)
            const isChannelActive = channel.channelStatus ?? channel.isActive ?? true
            const isDebugEnabled = channel.debugMode === true
            const ownerStatus = channel.owner?.status

            return (
              <div key={workspaceId || channel.name} className="bg-white rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleLogoClick(channel, true)}
                          className="flex-shrink-0 hover:scale-110 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 rounded-full"
                          title="Click to test widget"
                          disabled={!workspaceId}
                        >
                          {channel.logoUrl ? (
                            <img 
                              src={channel.logoUrl.startsWith('http') ? channel.logoUrl : `${IMG_BASE_URL}${channel.logoUrl}`}
                              alt={`${channel.name} logo`}
                              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-green-400 via-green-500 to-green-600 border-2 border-white shadow-md">
                              <span className="text-white font-bold text-xl">
                                {channel.name.substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </button>
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900">{channel.name}</h3>
                          {channel.description && (
                            <p className="text-sm text-gray-600 mt-1">{channel.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {channel.deletedAt && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                            <X className="w-3 h-3" />
                            Deleted
                          </span>
                        )}
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full border ${isChannelActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                            {isChannelActive ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {isChannelActive ? 'Channel Active' : 'Channel Inactive'}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full border ${isDebugEnabled ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            <Bug className="w-3 h-3" />
                            Debug {isDebugEnabled ? 'ON' : 'OFF'}
                          </span>
                          {ownerStatus && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full border ${ownerStatus === 'ACTIVE' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                              <AlertCircle className="w-3 h-3" />
                              Owner {ownerStatus.toLowerCase()}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                            {(channel as any).businessType === 'ecommerce' ? '🛒 E-commerce' : 'ℹ️ Info'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Widget Language
                    </span>
                    <Select
                      value={widgetLanguages[channel.id] || "it"}
                      onValueChange={(value) => handleLanguageChange(channel.id, value)}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-xs">
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">Italian (IT)</SelectItem>
                        <SelectItem value="en">English (EN)</SelectItem>
                        <SelectItem value="es">Spanish (ES)</SelectItem>
                        <SelectItem value="pt">Portuguese (PT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 📱 NEW: Playground Phone Number Input */}
                  <div className="space-y-2">
                    <Label htmlFor={`phone-${channel.id}`} className="text-xs font-medium text-gray-700 flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      Playground Phone Number
                    </Label>
                    <Input
                      id={`phone-${channel.id}`}
                      type="text"
                      placeholder="+39 999 1234567"
                      value={playgroundPhoneNumbers[channel.id] || ""}
                      onChange={(e) => handlePhoneNumberChange(channel.id, e.target.value)}
                      className={`text-xs h-8 ${phoneValidationErrors[channel.id] ? "border-red-500" : ""}`}
                    />
                    {phoneValidationErrors[channel.id] && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {phoneValidationErrors[channel.id]}
                      </p>
                    )}
                    {!phoneValidationErrors[channel.id] && playgroundPhoneNumbers[channel.id] && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Valid • Auto-detected: {widgetLanguages[channel.id]?.toUpperCase()}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      💡 Prefix detection: +39 (IT), +34 (ES), +351 (PT), +1/+44 (EN)
                    </p>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <span className="font-medium">Owner ID:</span> {channel.ownerId || 'N/A'}
                    </p>
                    {channel.owner && (
                      <p>
                        <span className="font-medium">Owner:</span> {channel.owner.email}
                      </p>
                    )}
                    {channel.url && (
                      <p>
                        <span className="font-medium">Website:</span>{' '}
                        <a href={channel.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {channel.url}
                        </a>
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Plan:</span> {channel.planType || 'N/A'}
                    </p>
                    <p>
                      <span className="font-medium">Credits:</span>{' '}
                      <span className="font-bold text-green-600">
                        {channel.creditBalance !== undefined ? channel.creditBalance.toLocaleString() : 'N/A'}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium">Channel Status:</span>{' '}
                      <span className={isChannelActive ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {isChannelActive ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium">Debug Mode:</span>{' '}
                      <span className={isDebugEnabled ? 'text-amber-700 font-medium' : 'text-rose-700 font-medium'}>
                        {isDebugEnabled ? 'ACTIVE' : 'OFF'}
                      </span>
                    </p>
                    {ownerStatus && (
                      <p>
                        <span className="font-medium">Owner Status:</span>{' '}
                        <span className={ownerStatus === 'ACTIVE' ? 'text-blue-700 font-medium' : 'text-red-600 font-medium'}>
                          {ownerStatus}
                        </span>
                      </p>
                    )}
                    {channel.whatsappPhoneNumber && (
                      <p>
                        <span className="font-medium">WhatsApp:</span> {channel.whatsappPhoneNumber}
                      </p>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-xs text-blue-900">
                      💡 <span className="font-medium">Test Mode:</span> Admin tests don't deduct credits.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleLogoClick(channel, true)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 px-3 rounded transition-colors"
                      disabled={!workspaceId}
                    >
                      Test Widget
                    </button>
                    <button
                      onClick={() => {
                        handleLogoClick(channel, true)
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-3 rounded transition-colors"
                      disabled={!workspaceId}
                    >
                      Open in Playground
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Chat Widget per testing */}
      {selectedWorkspaceId && selectedWorkspace && (
        <Dialog
          open={widgetOpen}
          onOpenChange={(open) => {
            setWidgetOpen(open)
            if (!open) {
              setSelectedWorkspaceId(null)
              setSelectedWorkspace(null)
              setWidgetAutoOpen(false)
            }
          }}
        >
          <DialogContent className="max-w-[420px] p-0 overflow-hidden">
            <div className="relative w-[380px] h-[620px]">
              <ChatWidget
                key={`${selectedWorkspaceId}-${widgetAutoOpen ? "open" : "closed"}`}
                workspaceId={selectedWorkspaceId}
                logoUrl={selectedWorkspace.logoUrl ? 
                  (selectedWorkspace.logoUrl.startsWith('http') ? selectedWorkspace.logoUrl : `${IMG_BASE_URL}${selectedWorkspace.logoUrl}`) 
                  : undefined
                }
                title={selectedWorkspace.name}
                position="bottom-right"
                phoneNumber={playgroundPhoneNumbers[selectedWorkspaceId] || selectedWorkspace.whatsappPhoneNumber || "+39 999 1234567"} // 📱 Use custom or default
                language={widgetLanguages[selectedWorkspaceId] || "it"}
                debugMode={selectedWorkspace.debugMode === true} // 🐛 Pass debug mode status
                isPlayground={true} // 🧪 PLAYGROUND: Never deduct credits
                autoOpen={widgetAutoOpen}
                forceEmbedded={true}
                apiUrl={apiUrl}
                onOpenChange={(isOpen) => {
                  if (!isOpen) {
                    setWidgetOpen(false)
                    setSelectedWorkspaceId(null)
                    setSelectedWorkspace(null)
                    setWidgetAutoOpen(false)
                  }
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
