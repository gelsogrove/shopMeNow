import React from "react"

type MobileShellTone = "slate" | "emerald" | "sand"
type MobileShellWidth = "compact" | "wide"

interface PublicMobileShellProps {
  children: React.ReactNode
  /** Accent color used for glow elements (defaults to primary blue) */
  accentColor?: string
  /** Background palette */
  tone?: MobileShellTone
  /** Max content width */
  maxWidth?: MobileShellWidth
  className?: string
}

/**
 * PublicMobileShell
 * Lightweight layout wrapper optimized for mobile-first public flows (registration, profile, short links).
 * Provides safe-area padding, atmospheric gradient background, and a constrained readable width.
 */
export const PublicMobileShell: React.FC<PublicMobileShellProps> = ({
  children,
  accentColor = "#0ea5e9",
  tone = "slate",
  maxWidth = "compact",
  className = "",
}) => {
  const toneBackgrounds: Record<MobileShellTone, string> = {
    slate: "linear-gradient(135deg, #0b1021 0%, #0f172a 55%, #111827 100%)",
    emerald: "linear-gradient(145deg, #032a21 0%, #064e3b 55%, #0f172a 100%)",
    sand: "linear-gradient(145deg, #0f172a 0%, #1f2937 45%, #312e81 100%)",
  }

  const widths: Record<MobileShellWidth, string> = {
    compact: "720px",
    wide: "1080px",
  }

  return (
    <div
      className="min-h-screen w-full relative"
      style={{
        background: toneBackgrounds[tone],
      }}
      data-public-mobile-shell
    >
      {/* Accent glows — pointer-events-none so they never block interaction */}
      <div
        className="pointer-events-none fixed inset-0 opacity-40 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute w-[280px] h-[280px] rounded-full blur-3xl"
          style={{
            top: "-60px",
            left: "-40px",
            background: `radial-gradient(circle, ${accentColor} 0%, transparent 60%)`,
          }}
        />
        <div
          className="absolute w-[320px] h-[320px] rounded-full blur-3xl"
          style={{
            bottom: "-120px",
            right: "-80px",
            background: `radial-gradient(circle, ${accentColor}AA 0%, transparent 60%)`,
          }}
        />
      </div>

      {/* Content container — scrolls naturally with the page */}
      <div className="relative z-10 flex justify-center">
        <div
          className={`w-full ${className}`}
          style={{
            maxWidth: widths[maxWidth],
            paddingLeft: "clamp(16px, 4vw, 28px)",
            paddingRight: "clamp(16px, 4vw, 28px)",
            paddingTop: "calc(20px + env(safe-area-inset-top, 0px))",
            paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
