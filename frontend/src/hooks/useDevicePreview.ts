import { DeviceLayoutType } from "@/components/shared/DevicePreview"
import { useEffect, useState } from "react"

/**
 * 📱 Custom Hook for Device Preview
 * Manages device preview state (URL, visibility, iframe reload, layout)
 * Used by ChatPage, WhatsAppChatModal, and any other component needing device preview
 */
export const useDevicePreview = (
  initialLayoutType: DeviceLayoutType = "modal"
) => {
  const [showPreview, setShowPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const [layoutType, setLayoutType] =
    useState<DeviceLayoutType>(initialLayoutType)

  // Reload iframe when URL changes
  useEffect(() => {
    if (previewUrl) {
      setIframeKey((prev) => prev + 1)
    }
  }, [previewUrl])

  // Open preview with URL
  const openPreview = (url: string) => {
    setPreviewUrl(url)
    setShowPreview(true)
  }

  // Close preview
  const closePreview = () => {
    setShowPreview(false)
    setPreviewUrl(null)
  }

  // Change layout type
  const setLayout = (newLayout: DeviceLayoutType) => {
    setLayoutType(newLayout)
  }

  return {
    showPreview,
    previewUrl,
    iframeKey,
    layoutType,
    openPreview,
    closePreview,
    setLayout,
    setShowPreview,
    setPreviewUrl,
  }
}
