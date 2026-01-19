import { useEffect, useMemo } from "react"
import { ChatWidget } from "@/components/ChatWidget"

const getDefaultLogoDataUri = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Open chat">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#22c55e"/>
          <stop offset="100%" stop-color="#16a34a"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#g)"/>
      <path d="M26 32h48c4.4 0 8 3.6 8 8v18c0 4.4-3.6 8-8 8H52l-9 8v-8H26c-4.4 0-8-3.6-8-8V40c0-4.4 3.6-8 8-8Z" fill="#ffffff"/>
      <rect x="34" y="43" width="32" height="3.5" rx="1.75" fill="#22c55e"/>
      <rect x="34" y="50" width="14" height="4" rx="2" fill="#22c55e"/>
      <rect x="50" y="50" width="16" height="4" rx="2" fill="#22c55e"/>
    </svg>
  `
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const decodeParam = (value?: string | null) => {
  if (!value) return undefined
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function WidgetEmbedPage() {
  useEffect(() => {
    const prevHtmlBg = document.documentElement.style.background
    const prevBodyBg = document.body.style.background
    const prevBodyMargin = document.body.style.margin
    const prevOverflow = document.body.style.overflow

    document.documentElement.style.background = "transparent"
    document.body.style.background = "transparent"
    document.body.style.margin = "0"
    document.body.style.overflow = "hidden"

    return () => {
      document.documentElement.style.background = prevHtmlBg
      document.body.style.background = prevBodyBg
      document.body.style.margin = prevBodyMargin
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const config = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const workspaceId =
      decodeParam(params.get("workspaceId")) ||
      (window as any)?.eChatbotConfig?.workspaceId ||
      ""

    return {
      workspaceId,
      title: decodeParam(params.get("title")) || (window as any)?.eChatbotConfig?.title,
      logoUrl:
        decodeParam(params.get("logoUrl")) ||
        (window as any)?.eChatbotConfig?.logoUrl ||
        getDefaultLogoDataUri(),
      primaryColor:
        decodeParam(params.get("primaryColor")) ||
        (window as any)?.eChatbotConfig?.primaryColor,
      language:
        decodeParam(params.get("language")) ||
        (window as any)?.eChatbotConfig?.language,
      apiUrl:
        decodeParam(params.get("apiUrl")) ||
        (window as any)?.eChatbotConfig?.apiUrl,
    }
  }, [])

  if (!config.workspaceId) {
    return null
  }

  return (
    <div className="h-screen w-screen bg-transparent">
      <ChatWidget
        workspaceId={config.workspaceId}
        title={config.title}
        logoUrl={config.logoUrl}
        primaryColor={config.primaryColor}
        language={config.language}
        apiUrl={config.apiUrl}
        onOpenChange={(open) => {
          window.parent?.postMessage(
            {
              type: "echatbot-widget-toggle",
              open,
            },
            "*"
          )
        }}
      />
    </div>
  )
}

export default WidgetEmbedPage
