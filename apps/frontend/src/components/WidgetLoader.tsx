import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { ChatWidget } from "@/components/ChatWidget"

/**
 * WidgetLoader - Loads the chat widget from platform configuration
 * Uses the ChatWidget React component directly instead of script injection
 * 
 * Widget visibility rules:
 * - ONLY show on "/" (home/login page)
 * - HIDE on all other routes (workspace-selection, dashboard, etc.)
 * - ✅ ONLY for informational channels (sellsProductsAndServices = false)
 * - ❌ NEVER for e-commerce channels (sellsProductsAndServices = true)
 */

interface WidgetConfig {
  workspaceId: string
  logoUrl?: string
  title?: string
  primaryColor?: string
  showWidgetChatbot?: boolean
}

export function WidgetLoader() {
  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const { workspace } = useWorkspace()

  // Check if widget should be visible
  const isHomePage = location.pathname === "/"
  const isEcommerce = workspace?.sellsProductsAndServices === true
  const shouldShowWidget = isHomePage && !isEcommerce

  // Fetch widget config from platform config
  useEffect(() => {
    if (!shouldShowWidget) {
      setConfig(null)
      setLoading(false)
      return
    }

    const fetchWidgetConfig = async () => {
      try {
        const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"
        const response = await fetch(`${apiBaseUrl}/platform-config/widget-code`)
        
        if (!response.ok) {
          console.error("Failed to fetch widget config:", response.status)
          setLoading(false)
          return
        }

        const data = await response.json()
        
        // Check if widget should be shown
        if (!data.success || !data.data?.code) {
          console.log("No widget code configured")
          setLoading(false)
          return
        }

        if (data.data?.showWidgetChatbot === false) {
          console.log("Widget disabled by platform config")
          setLoading(false)
          return
        }

        // Extract workspaceId from the widget code
        const workspaceIdMatch = data.data.code.match(/"workspaceId"\s*:\s*["']([^"']+)["']|workspaceId\s*:\s*["']([^"']+)["']/)
        const workspaceId = workspaceIdMatch ? (workspaceIdMatch[1] || workspaceIdMatch[2]) : null

        if (!workspaceId) {
          console.error("No workspaceId found in widget code")
          setLoading(false)
          return
        }

        // Extract other config from the code
        const logoUrlMatch = data.data.code.match(/"logoUrl"\s*:\s*["']([^"']+)["']|logoUrl\s*:\s*["']([^"']+)["']/)
        const titleMatch = data.data.code.match(/"title"\s*:\s*["']([^"']+)["']|title\s*:\s*["']([^"']+)["']/)
        const primaryColorMatch = data.data.code.match(/"primaryColor"\s*:\s*["']([^"']+)["']|primaryColor\s*:\s*["']([^"']+)["']/)

        setConfig({
          workspaceId,
          logoUrl: logoUrlMatch ? (logoUrlMatch[1] || logoUrlMatch[2]) : undefined,
          title: titleMatch ? (titleMatch[1] || titleMatch[2]) : "Chat with us 💬",
          primaryColor: primaryColorMatch ? (primaryColorMatch[1] || primaryColorMatch[2]) : "#22c55e",
          showWidgetChatbot: data.data.showWidgetChatbot !== false,
        })

        console.log("✅ Widget config loaded, workspaceId:", workspaceId)
        setLoading(false)
        
      } catch (error) {
        console.error("Failed to load widget config:", error)
        setLoading(false)
      }
    }

    fetchWidgetConfig()
  }, [shouldShowWidget])

  // Don't render anything if loading, no config, or shouldn't show
  if (loading || !config || !shouldShowWidget) {
    return null
  }

  // Render the ChatWidget component directly
  return (
    <ChatWidget
      workspaceId={config.workspaceId}
      logoUrl={config.logoUrl}
      title={config.title}
      primaryColor={config.primaryColor}
      position="bottom-right"
    />
  )
}
