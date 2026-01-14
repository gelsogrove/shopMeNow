import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import ChatWidget from "@/components/ChatWidget"

export default function WidgetTestPage() {
  const [searchParams] = useSearchParams()
  const workspaceId = searchParams.get("workspaceId")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!workspaceId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-8 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-gray-600">No workspaceId provided in URL</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Widget Test Mode</h1>
          <p className="text-gray-600">
            Testing widget for workspace: <span className="font-mono text-blue-600">{workspaceId}</span>
          </p>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-blue-900">
              💡 <span className="font-medium">Test Mode Active:</span> All messages sent here are completely free and won't deduct any credits from your account.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Test the Widget</h2>
          <p className="text-gray-600 mb-6">
            The chat widget should appear in the bottom-right corner of your screen. Try sending messages to test your chatbot configuration.
          </p>

          <div className="bg-gray-50 rounded border-2 border-dashed border-gray-300 p-12 text-center text-gray-500">
            <p>Widget is active - check bottom-right corner 👉</p>
          </div>

          <div className="mt-6 text-sm text-gray-600 space-y-2">
            <p>• Your chatbot responses will appear in the widget</p>
            <p>• Test different message types and scenarios</p>
            <p>• All messages are free in test mode</p>
            <p>• No credits will be deducted</p>
          </div>
        </div>
      </div>

      {/* Widget Component */}
      {mounted && <ChatWidget workspaceId={workspaceId} isTestMode={true} />}
    </div>
  )
}
