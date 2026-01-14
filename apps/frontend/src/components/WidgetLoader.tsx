import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"

/**
 * WidgetLoader - Loads the chat widget from platform configuration
 * Fetches widget code from DB (platformConfig table) and executes it
 * This allows widget to appear on login page without authentication
 * 
 * Widget visibility rules:
 * - ONLY show on "/" (home/login page)
 * - HIDE on all other routes (workspace-selection, dashboard, etc.)
 * - Automatically cleanup when route changes
 */
export function WidgetLoader() {
  const [loaded, setLoaded] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const pathname = location.pathname
    
    // ✅ Widget should ONLY appear on home page
    const shouldShowWidget = pathname === "/"

    // 🧹 CLEANUP: If we're NOT on home page, ensure widget is destroyed
    if (!shouldShowWidget) {
      // Remove widget UI elements
      const widgetContainer = document.querySelector(".echatbot-widget-container")
      const widgetButton = document.getElementById("echatbot-button")
      const widgetIframe = document.getElementById("echatbot-iframe")
      const widgetStyles = document.getElementById("echatbot-widget-styles")
      
      if (widgetContainer) {
        console.log("🧹 Removing widget container")
        widgetContainer.remove()
      }
      if (widgetButton) {
        console.log("🧹 Removing widget button")
        widgetButton.remove()
      }
      if (widgetIframe) {
        console.log("🧹 Removing widget iframe")
        widgetIframe.remove()
      }
      if (widgetStyles) {
        console.log("🧹 Removing widget styles")
        widgetStyles.remove()
      }
      const widgetLoaderScript = document.getElementById("echatbot-widget-loader")
      const widgetConfigScript = document.getElementById("echatbot-widget-config")
      if (widgetLoaderScript) {
        console.log("🧹 Removing widget loader script")
        widgetLoaderScript.remove()
      }
      if (widgetConfigScript) {
        console.log("🧹 Removing widget config script")
        widgetConfigScript.remove()
      }
      
      // Destroy widget instance
      if ((window as any)._eChatbotWidget && typeof (window as any)._eChatbotWidget.destroy === 'function') {
        console.log("🧹 Destroying widget instance")
        try {
          (window as any)._eChatbotWidget.destroy()
        } catch (e) {
          console.warn("Widget destroy failed:", e)
        }
      }
      
      // Remove global widget objects
      if ((window as any).eChatbotWidget) {
        delete (window as any).eChatbotWidget
      }
      if ((window as any)._eChatbotWidget) {
        delete (window as any)._eChatbotWidget
      }
      if ((window as any).eChatbotConfig) {
        delete (window as any).eChatbotConfig
      }
      
      // Mark as not loaded
      if (loaded) {
        console.log("🧹 Widget cleanup completed for route:", pathname)
        setLoaded(false)
      }
      return
    }

    // 🚫 Don't load if not on home page
    if (!shouldShowWidget) {
      return
    }

    // 🚫 Don't load twice
    if (loaded) return

    const loadWidgetFromDB = async () => {
      try {
        const existingContainer = document.querySelector(".echatbot-widget-container")
        if (existingContainer) {
          console.log("♻️ Removing existing widget to refresh assets")
          existingContainer.remove()
        }

        // Fetch widget code from platform config (public endpoint, no auth needed)
        const response = await fetch("http://localhost:3001/api/v1/platform-config/widget-code")
        
        if (!response.ok) {
          console.error("Failed to fetch widget code:", response.status)
          return
        }

        const data = await response.json()
        
        // Check if widget should be shown (response is {success: true, data: {code: "..."}})
        if (!data.success || !data.data?.code) {
          console.log("No widget code configured")
          return
        }

        if (data.data?.showWidgetChatbot === false) {
          console.log("Widget disabled by platform config")
          return
        }

        if (data.data?.isValid === false) {
          console.warn("Widget code invalid:", data.data?.error || "Unknown error")
          return
        }

        // Execute the widget code (it contains workspaceId, logoUrl, etc from DB)
        let widgetCode = data.data.code
        const uiLanguage = localStorage.getItem("language")
        if (uiLanguage) {
          widgetCode = widgetCode
            .replace(/"language"\s*:\s*"[^"]*"/, `"language": "${uiLanguage}"`)
            .replace(/language\s*:\s*"[^"]*"/, `language: "${uiLanguage}"`)
        }
        const scriptElement = document.createElement("div")
        scriptElement.innerHTML = widgetCode
        
        const existingLoader = document.getElementById("echatbot-widget-loader")
        const existingConfig = document.getElementById("echatbot-widget-config")
        const existingStyles = document.getElementById("echatbot-widget-styles")
        const existingOverride = document.getElementById("echatbot-widget-override")
        if (existingLoader) existingLoader.remove()
        if (existingConfig) existingConfig.remove()
        if (existingStyles) existingStyles.remove()
        if (existingOverride) existingOverride.remove()

        document.querySelectorAll("style").forEach((styleEl) => {
          if (styleEl.textContent?.includes(".echatbot-widget-")) {
            styleEl.remove()
          }
        })

        // No override styles - let ChatWidget React component handle styling

        // Extract and execute all script tags
        const scripts = scriptElement.getElementsByTagName("script")
        for (let i = 0; i < scripts.length; i++) {
          const script = scripts[i]
          const newScript = document.createElement("script")
          
          if (script.src) {
            const hasQuery = script.src.includes("?")
            const cacheBuster = `v=${Date.now()}`
            newScript.src = `${script.src}${hasQuery ? "&" : "?"}${cacheBuster}`
            newScript.async = true
            newScript.id = "echatbot-widget-loader" // Add ID for tracking
          } else {
            newScript.textContent = script.textContent
            newScript.id = "echatbot-widget-config" // Add ID for tracking
          }
          
          document.body.appendChild(newScript)
        }

        setLoaded(true)
        console.log("✅ Widget loaded from platform config on route:", pathname)
        
      } catch (error) {
        console.error("Failed to load widget:", error)
      }
    }

    loadWidgetFromDB()
  }, [location.pathname, loaded]) // 🔄 Re-run when route changes

  // This component doesn't render anything
  return null
}
