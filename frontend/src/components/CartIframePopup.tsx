import { RotateCw, X } from "lucide-react"
import React, { useState } from "react"

interface CartIframePopupProps {
  isOpen: boolean
  onClose: () => void
  iframeSrc: string
  layoutType?: "modal" | "inline"
}

type ViewMode = "mobile" | "tablet" | "desktop"

export const CartIframePopup: React.FC<CartIframePopupProps> = ({
  isOpen,
  onClose,
  iframeSrc,
  layoutType = "modal",
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("mobile")
  const [iframeKey, setIframeKey] = useState(0) // 🔄 Key per forzare reload iframe

  const cycleViewMode = () => {
    if (viewMode === "mobile") setViewMode("tablet")
    else if (viewMode === "tablet") setViewMode("desktop")
    else setViewMode("mobile")
  }

  // 🔄 Refresh iframe content (force reload)
  const refreshIframe = () => {
    setIframeKey((prev) => prev + 1)
  }

  // Size for INLINE mode - fit in split view but not too small
  const getInlineViewModeSize = () => {
    if (viewMode === "mobile") {
      return {
        width: "min(390px, 95%)",
        height: "min(710px, 90vh)",
      }
    }
    if (viewMode === "tablet") {
      return {
        width: "min(798px, 95%)",
        height: "min(630px, 90vh)",
      }
    }
    // Desktop
    return {
      width: "min(1054px, 95%)",
      height: "min(730px, 90vh)",
    }
  }

  // Size for MODAL mode - full size
  const getViewModeSize = () => {
    if (viewMode === "mobile") {
      return {
        width: "min(440px, calc(100vw - 16px))",
        height: "min(840px, calc(100vh - 16px))",
      }
    }
    if (viewMode === "tablet") {
      return {
        width: "min(1024px, calc(100vw - 16px))",
        height: "min(768px, calc(100vh - 16px))",
      }
    }
    // Desktop
    return {
      width: "min(1440px, calc(100vw - 16px))",
      height: "min(900px, calc(100vh - 16px))",
    }
  }

  if (!isOpen) return null

  // Use appropriate sizing based on layout type
  const size =
    layoutType === "inline" ? getInlineViewModeSize() : getViewModeSize()

  // INLINE mode: render as split view on the right side (no backdrop)
  if (layoutType === "inline") {
    return (
      <div className="absolute inset-0 w-full h-full bg-white flex flex-col">
        {/* Header with controls */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Preview</h3>
          <div className="flex gap-2">
            <button
              onClick={cycleViewMode}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Cycle view mode"
            >
              <RotateCw className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close preview"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50 flex items-center justify-center">
          {/* Device Frame - smaller for split view */}
          <div
            className="relative flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 shadow-2xl transition-all duration-500"
            style={{
              width: size.width,
              height: size.height,
              borderRadius:
                viewMode === "desktop" ? "16px" : "clamp(32px, 5vw, 48px)",
              padding: viewMode === "desktop" ? "4px" : "10px",
              boxShadow:
                "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 2px 4px rgba(255, 255, 255, 0.1)",
            }}
          >
            {/* Phone Notch (Top) - Hidden on small screens and desktop mode */}
            {viewMode !== "desktop" && (
              <>
                <div
                  className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-b-3xl z-10"
                  style={{
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                  }}
                />

                {/* Camera and Sensors in Notch */}
                <div className="hidden sm:flex absolute top-1.5 left-1/2 -translate-x-1/2 items-center gap-2 z-20">
                  <div className="w-1.5 h-1.5 bg-gray-800 rounded-full" />
                  <div className="w-10 h-1 bg-gray-900 rounded-full" />
                </div>
              </>
            )}

            {/* Phone Screen */}
            <div
              className="flex-1 bg-white overflow-hidden"
              style={{
                borderRadius:
                  viewMode === "desktop" ? "12px" : "clamp(28px, 4.5vw, 36px)",
              }}
            >
              <iframe
                src={iframeSrc}
                className="w-full h-full"
                title="Customer Cart"
                sandbox="allow-scripts allow-same-origin allow-forms"
                scrolling="auto"
              />
            </div>

            {/* Phone Bottom Bar (Home Indicator) - Hidden in desktop mode */}
            {viewMode !== "desktop" && (
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/30 rounded-full" />
            )}
          </div>
        </div>
      </div>
    )
  }

  // MODAL mode: render as centered overlay (original behavior)
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Popup Container - Mobile Phone or Tablet Frame */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        {/* Device Frame */}
        <div
          className="relative flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 shadow-2xl transition-all duration-500"
          style={{
            width: size.width,
            height: size.height,
            borderRadius:
              viewMode === "desktop" ? "16px" : "clamp(32px, 5vw, 48px)",
            padding: viewMode === "desktop" ? "4px" : "10px",
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 2px 4px rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Phone Notch (Top) - Hidden on small screens and desktop mode */}
          {viewMode !== "desktop" && (
            <>
              <div
                className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-b-3xl z-10"
                style={{
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                }}
              />

              {/* Camera and Sensors in Notch */}
              <div className="hidden sm:flex absolute top-1.5 left-1/2 -translate-x-1/2 items-center gap-2 z-20">
                <div className="w-1.5 h-1.5 bg-gray-800 rounded-full" />
                <div className="w-10 h-1 bg-gray-900 rounded-full" />
              </div>
            </>
          )}

          {/* Rotate Button - Cycle through Mobile/Tablet/Desktop */}
          <button
            onClick={cycleViewMode}
            className="absolute -top-3 -right-14 flex items-center justify-center w-9 h-9 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-xl border-2 border-white z-[10000]"
            title="Cycle view mode"
          >
            <RotateCw className="h-4 w-4" />
          </button>

          {/* Close Button - Right next to phone */}
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 flex items-center justify-center w-9 h-9 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-xl border-2 border-white z-[10000]"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Phone Screen */}
          <div
            className="flex-1 bg-white overflow-hidden"
            style={{
              borderRadius:
                viewMode === "desktop" ? "12px" : "clamp(28px, 4.5vw, 36px)",
            }}
          >
            <iframe
              src={iframeSrc}
              className="w-full h-full"
              title="Customer Cart"
              sandbox="allow-scripts allow-same-origin allow-forms"
              scrolling="auto"
            />
          </div>

          {/* Phone Bottom Bar (Home Indicator) - Hidden in desktop mode */}
          {viewMode !== "desktop" && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/30 rounded-full" />
          )}
        </div>
      </div>
    </>
  )
}
