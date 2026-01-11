import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { toast } from "@/lib/toast"
import { workspaceApi } from "@/services/workspaceApi"

// Decode JWT token to extract claims
function decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

export default function WidgetPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [embedCode, setEmbedCode] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Get workspaceId from token and localStorage
  useEffect(() => {
    const token = localStorage.getItem('backoffice_token')
    if (token) {
      const decoded = decodeJWT(token)
      // First try from token claim
      if (decoded?.workspaceId) {
        console.log("✅ WorkspaceId from token:", decoded.workspaceId)
        setWorkspaceId(decoded.workspaceId)
        return
      }
    }
    // Fallback: look for workspace ID in localStorage (set from frontend)
    const savedWorkspaceId = localStorage.getItem('echatbot-workspace-id')
    if (savedWorkspaceId) {
      console.log("✅ WorkspaceId from localStorage:", savedWorkspaceId)
      setWorkspaceId(savedWorkspaceId)
      return
    }
    // Last fallback: parse from currentWorkspace JSON
    try {
      const workspaceJson = localStorage.getItem('currentWorkspace')
      if (workspaceJson) {
        const workspace = JSON.parse(workspaceJson)
        if (workspace?.id) {
          console.log("✅ WorkspaceId from currentWorkspace:", workspace.id)
          setWorkspaceId(workspace.id)
          return
        }
      }
    } catch (e) {
      console.error("Failed to parse workspace from localStorage:", e)
    }
    
    // No workspace found - show error after short delay to allow UI to render
    console.error("❌ No workspaceId found anywhere!")
    setLoading(false)
  }, [])

  useEffect(() => {
    // Only fetch if we have a workspaceId
    if (!workspaceId) {
      return
    }

    const fetchEmbedCode = async () => {
      try {
        const response = await workspaceApi.getWidgetEmbedCode(workspaceId)
        setEmbedCode(response.embedCode)
      } catch (error) {
        console.error("Failed to fetch embed code:", error)
        toast.error("Failed to load widget embed code")
      } finally {
        setLoading(false)
      }
    }

    fetchEmbedCode()
  }, [workspaceId])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      toast.success("Embed code copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
      toast.error("Failed to copy to clipboard")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Chat Widget</h1>
        <p className="text-gray-600 mt-2">
          Embed eChatbot chat widget on your website
        </p>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Your Workspace ID</h2>
          <div className="flex items-center gap-2 bg-gray-100 p-3 rounded">
            <code className="flex-1 font-mono text-sm">{workspaceId}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(workspaceId || "")
                toast.success("Workspace ID copied!")
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Embed Code</h2>
          <p className="text-gray-600 text-sm mb-3">
            Copy the code below and paste it into your website HTML (before
            closing &lt;/body&gt; tag)
          </p>

          {loading ? (
            <div className="bg-gray-100 p-4 rounded h-40 flex items-center justify-center">
              Loading...
            </div>
          ) : (
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-4">
              <pre>{embedCode}</pre>
            </div>
          )}

          <Button
            onClick={handleCopy}
            disabled={!embedCode || loading}
            className="w-full"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" /> Copy Embed Code
              </>
            )}
          </Button>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold mb-4">How to use</h2>
          <ol className="space-y-3 text-sm text-gray-700">
            <li>
              <span className="font-semibold">1. Copy the embed code above</span>
            </li>
            <li>
              <span className="font-semibold">2. Paste it into your website</span>{" "}
              - Add it just before the closing &lt;/body&gt; tag
            </li>
            <li>
              <span className="font-semibold">3. Customize (optional)</span> -
              Edit the position, language, and theme in the script
            </li>
            <li>
              <span className="font-semibold">4. Test it</span> - Reload your
              website and the chat widget should appear
            </li>
          </ol>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold mb-2">Widget Information</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Widget ID: {workspaceId}</li>
            <li>• Supported languages: Italian (it), Spanish (es), English (en)</li>
            <li>• Default position: Bottom-right corner</li>
            <li>• Rate limit: 50 messages per hour per visitor</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
