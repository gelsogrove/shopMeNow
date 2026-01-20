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
  const isEcommerce = workspace?.sellsProductsAndServices === true
  const shouldShowWidget = isHomePage && !isEcommerce

  // Load widget script dynamically from platform config
  useEffect(() => {
    const clearWidgetConfig = () => {
      if ((window as any).eChatbotConfig) {
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

        const data = await response.json()
        
        // Check if widget should be shown
        if (!data.success || !data.data?.config) {
          console.log("⚠️ No widget configured:", data.data?.error || "Unknown")
          clearWidgetConfig()
          return
        }

        if (data.data?.showWidgetChatbot === false) {
          console.log("⚠️ Widget disabled by platform config")
          clearWidgetConfig()
          return
        }

        const config = data.data.config

        // Inject window.eChatbotConfig with language from header dropdown
        (window as any).eChatbotConfig = {
          workspaceId: config.workspaceId,
          apiUrl: apiBaseUrl,
          title: config.title,
          language: language, // Use language from header dropdown
          primaryColor: config.primaryColor,
          logoUrl: config.logoUrl,
        }

        console.log("✅ Widget config injected:", {
          workspaceId: config.workspaceId,
          language: language,
          title: config.title,
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
    }
  }, [shouldShowWidget, language]) // Re-inject config when language changes

  return null // Widget is now injected via window.eChatbotConfig
}
