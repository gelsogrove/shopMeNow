import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ExternalLink, TestTube, Bug, CheckCircle2, MessageCircle, X } from "lucide-react"
import { toast } from "@/lib/toast"
import { workspaceApi } from "@/services/workspaceApi"
import ChatWidget from "@/components/ChatWidget"
import { IMG_BASE_URL } from "@/config"

interface Channel {
  id: string
  name: string
  description?: string
  url?: string
  whatsappPhoneNumber?: string
  debugMode?: boolean
  logoUrl?: string
  ownerId?: string
  planType?: string
  isActive?: boolean
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

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const allChannels = await workspaceApi.getAll()
        console.log("🔍 CHANNELS RICEVUTI:", allChannels)
        console.log("🔍 LOGOS:", allChannels.map((c: any) => ({ name: c.name, logoUrl: c.logoUrl })))
        setChannels(allChannels)
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

  const handleLogoClick = (channel: Channel) => {
    setSelectedWorkspace(channel)
    setSelectedWorkspaceId(channel.id)
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
          {channels.map((channel) => (
            <div key={channel.id} className="bg-white rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Logo del workspace - CLICKABLE */}
                      <button
                        onClick={() => handleLogoClick(channel)}
                        className="flex-shrink-0 hover:scale-110 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 rounded-full"
                        title="Click to test widget"
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
                      <h3 className="text-lg font-semibold text-gray-900">{channel.name}</h3>
                    </div>
                    {/* Debug Mode Badge - TRUE/FALSE */}
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${channel.debugMode === true ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-gray-100 text-gray-700 border border-gray-300'}`}>
                      <Bug className="w-3 h-3" />
                      Debug: {channel.debugMode === true ? 'TRUE' : 'FALSE'}
                    </span>
                  </div>
                  {channel.description && (
                    <p className="text-sm text-gray-600 mt-1">{channel.description}</p>
                  )}
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
                    <span className="font-medium">User Status:</span>{' '}
                    <span className={channel.isActive ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {channel.isActive ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </p>
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat Widget per testing */}
      {selectedWorkspaceId && widgetOpen && selectedWorkspace && (
        <ChatWidget
          workspaceId={selectedWorkspaceId}
          logoUrl={selectedWorkspace.logoUrl ? 
            (selectedWorkspace.logoUrl.startsWith('http') ? selectedWorkspace.logoUrl : `${IMG_BASE_URL}${selectedWorkspace.logoUrl}`) 
            : undefined
          }
          title={selectedWorkspace.name}
          position="bottom-right"
          onOpenChange={(isOpen) => {
            setWidgetOpen(isOpen)
            if (!isOpen) {
              setSelectedWorkspaceId(null)
              setSelectedWorkspace(null)
            }
          }}
        />
      )}
    </div>
  )
}
