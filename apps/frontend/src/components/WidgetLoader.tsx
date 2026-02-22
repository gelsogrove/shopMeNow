import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useLanguage } from "@/contexts/LanguageContext"

/**
 * WidgetLoader - Loads the chat widget script dynamically from platform configuration
 * Injects window.eChatbotConfig with language from header dropdown
 * 
 * Widget visibility rules:
 * - ONLY show on "/" (home/login page)
 * - HIDE on all other routes (workspace-selection, dashboard, etc.)
 * - ✅ ONLY for informational channels (sellsProductsAndServices = false)
 * - ❌ NEVER for e-commerce channels (sellsProductsAndServices = true)
 * 
 * Widget script format (injected into page):
 * <script>
 *   window.eChatbotConfig = {
 *     workspaceId: "...",
 *     apiUrl: "...",
 *     title: "...",
 *     language: "es", // From header dropdown
 *     primaryColor: "#22c55e"
 *   };
 * </script>
 * <script src="https://www.echatbot.ai/widget.js" async></script>
 */

export function WidgetLoader() {
  const location = useLocation()
  const { workspace } = useWorkspace()
  const { language } = useLanguage() // Get language from header dropdown

  // Check if widget should be visible
  const isHomePage = location.pathname === "/"
  // Always allow widget on homepage; target workspace suitability is enforced by the backend
  const shouldShowWidget = isHomePage

  // Load widget script dynamically from platform config
  useEffect(() => {
    const clearWidgetConfig = () => {
      if (typeof window !== 'undefined' && (window as any).eChatbotConfig) {
        delete (window as any).eChatbotConfig
      }
    }

    if (!shouldShowWidget) {
      clearWidgetConfig()
      return
    }

    const loadWidget = async () => {
      try {
        const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"
        const response = await fetch(`${apiBaseUrl}/platform-config/widget-config`)

        if (!response.ok) {
          console.error("❌ Failed to fetch widget config:", response.status)
          return
        }

        const payload = await response.json().catch((err) => {
          console.error("❌ Widget config: failed to parse JSON", err)
          return null
        })

        // Validate payload shape
        const config = payload?.data?.config
        if (
          !payload?.success ||
          !config ||
          typeof config !== "object" ||
          typeof config.workspaceId !== "string"
        ) {
          console.log(
            "⚠️ No widget configured:",
            payload?.data?.error || "Unknown shape",
            "payload:",
            payload
          )
          clearWidgetConfig()
          return
        }

        if (payload?.data?.showWidgetChatbot === false) {
          console.log("⚠️ Widget disabled by platform config")
          clearWidgetConfig()
          return
        }

        // Inject window.eChatbotConfig with widget config (fallback to header language)
        // RULE: Header language (explicit user selection) takes priority over workspace defaultLanguage
        (window as any).eChatbotConfig = {
          workspaceId: config.workspaceId,
          apiUrl: apiBaseUrl,
          title: config.title,
          language: language || config.language,
          primaryColor: config.primaryColor,
          logoUrl: config.logoUrl,
          useChannelLogo: config.useChannelLogo ?? false,
          icon: config.icon || workspace?.widgetIcon || "chat",
        }

        // Notify any live widget listeners to re-render with the new config
        window.dispatchEvent(new Event("echatbot-config-updated"))

        console.log("✅ Widget config injected:", {
          workspaceId: config.workspaceId,
          language: language || config.language,
          title: config.title,
          icon: config.icon || "chat",
          primaryColor: config.primaryColor,
        })

        // Load widget script (local component - ChatWidget will read window.eChatbotConfig)
        // For now, we use the React component directly
        // In production, this would load an external script:
        // const script = document.createElement("script")
        // script.src = "https://www.echatbot.ai/widget.js"
        // script.async = true
        // document.body.appendChild(script)

      } catch (error) {
        console.error("❌ Failed to load widget:", error)
        clearWidgetConfig()
      }
    }

    loadWidget()

    // Cleanup on unmount or when rules change
    return () => {
      clearWidgetConfig()
      window.dispatchEvent(new Event("echatbot-config-updated"))
    }
  }, [shouldShowWidget, language]) // Re-inject config when language changes

  return null // Widget is now injected via window.eChatbotConfig
}
