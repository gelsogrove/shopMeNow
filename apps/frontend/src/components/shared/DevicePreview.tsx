import React from "react"

export type DeviceLayoutType = "modal" | "orders-list" | "checkout" | "inline"

interface DevicePreviewProps {
  isOpen: boolean
  previewUrl: string | null
  onClose: () => void
  iframeKey: number
  layoutType?: DeviceLayoutType // "modal" (full popup), "inline" (split view), "orders-list", "checkout"
}

/**
 * 📱 Device Preview Component
 * Renders an iPhone mockup with iframe content
 * Supports multiple layout types:
 * - "modal" (ChatPage) - full screen overlay popup
 * - "inline" (WhatsAppChatModal) - right column in split view
 * - "orders-list" - orders list with status badges
 * - "checkout" - checkout flow with steps
 */
export const DevicePreview: React.FC<DevicePreviewProps> = ({
  isOpen,
  previewUrl,
  onClose,
  iframeKey,
  layoutType = "modal",
}) => {
  if (!isOpen || !previewUrl) return null

  // Device frame content (iPhone mockup) - IDENTICAL for all layouts
  // Design: iPhone with NOTCH (like first image - 404 page)
  const deviceContent = (
    <div className="relative w-full h-full bg-black rounded-[32px] border-[16px] border-gray-900 shadow-2xl overflow-hidden flex flex-col">
      {/* TOP BAR with NOTCH */}
      <div className="relative bg-black h-10 flex items-center justify-between px-6 text-white text-xs">
        {/* Left side - Time */}
        <span className="font-semibold">9:41</span>

        {/* CENTER NOTCH */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-7 bg-black rounded-b-3xl"></div>

        {/* Right side - Icons */}
        <div className="flex gap-1 items-center">
          <span>📶</span>
          <span>📡</span>
          <span>🔋</span>
        </div>
      </div>

      {/* Screen Content - main area with white background */}
      <div className="flex-1 bg-white overflow-hidden flex flex-col">
        {/* iframe - takes full space */}
        {previewUrl ? (
          <iframe
            key={iframeKey}
            src={previewUrl}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms"
            title="Device Preview"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <span className="text-gray-400 text-sm">
              Click a link to preview
            </span>
          </div>
        )}
      </div>
    </div>
  )

  // UNIFIED LAYOUT - Same for ALL (modal, inline, orders, checkout)
  // Like the LEFT image - device in split view with close button

  // Modal version has overlay background, but SAME device layout
  if (layoutType === "modal") {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="relative flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button - Red circle top right */}
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center hover:bg-red-700 z-50 shadow-lg font-bold text-xl"
            title="Close preview"
          >
            ✕
          </button>

          {/* Device Frame - iPhone */}
          <div style={{ width: "380px", aspectRatio: "9/19.5" }}>
            {deviceContent}
          </div>
        </div>
      </div>
    )
  }

  // ALL other layouts - IDENTICAL to modal device (just without overlay)
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Close Button - Red circle top right - SAME position */}
      <button
        onClick={onClose}
        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center hover:bg-red-700 z-50 shadow-lg font-bold text-xl"
        title="Close preview"
      >
        ✕
      </button>

      {/* Device Frame */}
      <div className="relative w-full h-full">{deviceContent}</div>
    </div>
  )
}
