import { useEffect, useRef } from "react"
import { IMG_BASE_URL } from "@/config"

/**
 * Mounts the REAL production widget (`/widget.js` + `window.eChatbotConfig`)
 * for a workspace, already open — the same embed a customer pastes on their
 * own site, so what is previewed is exactly what ships.
 *
 * Deliberately NOT the React <ChatWidget>: that one is the widget's internals
 * rendered in-app, so a bug in the embed (iframe params, launcher sizing,
 * openByDefault) stays invisible until a customer hits it.
 *
 * `openByDefault` is what "simulates the click": widget.js starts the iframe
 * at full panel size instead of the 100x100 launcher bubble, so no synthetic
 * click into a cross-origin iframe is needed.
 */

interface WidgetConfigSource {
  id: string
  name?: string
  logoUrl?: string
  widgetTitle?: string
  widgetLanguage?: string
  widgetPrimaryColor?: string
  widgetIcon?: string
  widgetUseChannelLogo?: boolean
}

interface EmbeddedWidgetPreviewProps {
  workspace: WidgetConfigSource
  /** Corner the widget anchors to; matches the embed snippet default. */
  position?: "bottom-right" | "bottom-left"
  /** Panel open on mount (no launcher bubble to click first). */
  openByDefault?: boolean
  /**
   * Called when the panel is closed from inside the widget (its X, or a click
   * on the dimming backdrop). Lets the host drop the widget entirely instead
   * of keeping a mounted-but-closed launcher around.
   */
  onClose?: () => void
}

/**
 * Absolute logo URL: widget.js forwards it as an iframe query param, so a
 * relative path resolved against the embed origin would 404.
 */
const resolveLogoUrl = (logoUrl?: string): string => {
  if (!logoUrl) return ""
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl
  const path = logoUrl.startsWith("/") ? logoUrl : `/${logoUrl}`
  return `${IMG_BASE_URL}${path}`
}

const resolveApiUrl = (): string => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return `${window.location.origin}/api/v1`
  }
  return "http://localhost:3001/api/v1"
}

export function EmbeddedWidgetPreview({
  workspace,
  position = "bottom-right",
  openByDefault = true,
  onClose,
}: EmbeddedWidgetPreviewProps) {
  // Kept in a ref so a caller passing an inline arrow does not tear down and
  // remount the whole widget (and its conversation) on every render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!onCloseRef.current) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "echatbot-widget-toggle" || event.data.open) return
      onCloseRef.current?.()
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  useEffect(() => {
    const w = window as unknown as {
      eChatbotConfig?: Record<string, unknown>
      _eChatbotWidget?: { destroy?: () => void }
      eChatbotWidget?: { init?: (config: Record<string, unknown>) => unknown }
    }

    // Only emitted when a logo actually exists, otherwise the widget forwards a
    // blank logoUrl query param to the embed iframe.
    const logoUrl = workspace.widgetUseChannelLogo ? resolveLogoUrl(workspace.logoUrl) : ""

    const config: Record<string, unknown> = {
      workspaceId: workspace.id,
      apiUrl: resolveApiUrl(),
      position,
      title: workspace.widgetTitle || workspace.name || "",
      primaryColor: workspace.widgetPrimaryColor || "",
      icon: workspace.widgetIcon || "chat",
      language: workspace.widgetLanguage || "",
      useChannelLogo: workspace.widgetUseChannelLogo ?? false,
      openByDefault,
      ...(logoUrl ? { logoUrl } : {}),
    }

    // A previous instance may still be mounted (switching workspace cards):
    // tear it down first so two widgets never stack in the corner.
    w._eChatbotWidget?.destroy?.()
    delete w._eChatbotWidget
    w.eChatbotConfig = config

    // widget.js auto-initializes from window.eChatbotConfig, but only on its
    // first evaluation — the IIFE does not re-run when the tag is re-appended.
    // So init() explicitly when the script is already loaded in this session.
    let script: HTMLScriptElement | undefined
    if (w.eChatbotWidget?.init) {
      w.eChatbotWidget.init(config)
    } else {
      // Same-origin: /widget.js is served by this frontend in dev and prod.
      script = document.createElement("script")
      script.src = "/widget.js"
      script.async = true
      document.body.appendChild(script)
    }

    return () => {
      w._eChatbotWidget?.destroy?.()
      delete w._eChatbotWidget
      delete w.eChatbotConfig
      script?.remove()
    }
  }, [
    workspace.id,
    workspace.name,
    workspace.logoUrl,
    workspace.widgetTitle,
    workspace.widgetLanguage,
    workspace.widgetPrimaryColor,
    workspace.widgetIcon,
    workspace.widgetUseChannelLogo,
    position,
    openByDefault,
  ])

  return null
}
