import { useEffect, useMemo } from "react"
import { ChatWidget } from "@/components/ChatWidget"

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
        "/logo.png",
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
