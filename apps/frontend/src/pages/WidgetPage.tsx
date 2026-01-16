import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { toast } from "@/lib/toast"
import { useWorkspace } from "@/hooks/use-workspace"
import { storage } from "@/lib/storage"

export default function WidgetPage() {
  const { workspace } = useWorkspace()
  const [embedCode, setEmbedCode] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!workspace?.id) {
      toast.error("Workspace not found")
      setLoading(false)
      return
    }

    const fetchEmbedCode = async () => {
      try {
        const token = storage.getToken()
        if (!token) {
          toast.error("Authentication token not found")
          setLoading(false)
          return
        }

        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"
        const response = await fetch(
          `${apiUrl}/workspaces/${workspace.id}/widget/embed-code`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!response.ok) {
          throw new Error("Failed to fetch embed code")
        }

        const data = await response.json()
        setEmbedCode(data.embedCode)
      } catch (error) {
        console.error("Failed to fetch embed code:", error)
        toast.error("Failed to load widget embed code")
      } finally {
        setLoading(false)
      }
    }

    fetchEmbedCode()
  }, [workspace?.id])

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
            <code className="flex-1 font-mono text-sm">{workspace?.id}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(workspace?.id || "")
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
          ) : embedCode ? (
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-4">
              <pre>{embedCode}</pre>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm text-yellow-800 mb-4">
              No embed code available
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
            <li>• Widget ID: {workspace?.id}</li>
            <li>• Supported languages: Italian (it), Spanish (es), English (en)</li>
            <li>• Default position: Bottom-right corner</li>
            <li>• Rate limit: 50 messages per hour per visitor</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
