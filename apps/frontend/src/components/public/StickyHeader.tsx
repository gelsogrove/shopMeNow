import designSystem from "@/styles/designSystem"
import React, { useEffect, useState } from "react"
import { MobileMenu } from "./MobileMenu"

interface StickyHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  logoUrl?: string | null
  showMenu?: boolean
  token?: string | null
  currentPage?: "cart" | "orders" | "profile"
  customerLanguage?: string
  isEcommerce?: boolean
}

/**
 * StickyHeader - Header fisso per tutte le pagine pubbliche
 * Features:
 * - Sticky positioning con shadow on scroll
 * - Menu hamburger per mobile
 * - Responsive title/subtitle
 * - Multilanguage support
 */
export const StickyHeader: React.FC<StickyHeaderProps> = ({
  title,
  subtitle,
  icon,
  logoUrl,
  showMenu = true,
  token,
  currentPage,
  customerLanguage,
  isEcommerce = true,
}) => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Detect scroll to add shadow
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isMenuOpen])

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: designSystem.zIndex.sticky,
          backgroundColor: designSystem.colors.background.card,
          borderBottom: `1px solid ${designSystem.colors.border.light}`,
          transition: designSystem.transition.all,
          boxShadow: isScrolled ? designSystem.shadow.md : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: designSystem.components.header.height,
            padding: designSystem.components.header.padding,
            maxWidth: "1280px",
            margin: "0 auto",
          }}
        >
          {/* Left: Icon + Title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flex: 1,
              minWidth: 0,
            }}
          >
            {/* Logo or Icon */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={title}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: designSystem.borderRadius.lg,
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : icon ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "36px",
                  height: "36px",
                  borderRadius: designSystem.borderRadius.lg,
                  background: `linear-gradient(135deg, ${designSystem.colors.primary[500]}, ${designSystem.colors.secondary[500]})`,
                  color: designSystem.colors.text.inverse,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
            ) : null}
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <h1
                style={{
                  fontSize: designSystem.typography.fontSize.lg,
                  fontWeight: designSystem.typography.fontWeight.bold,
                  color: designSystem.colors.text.primary,
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  style={{
                    fontSize: designSystem.typography.fontSize.sm,
                    color: designSystem.colors.text.secondary,
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right: Menu Button */}
          {showMenu && (
            <button
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open menu"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "44px",
                height: "44px",
                borderRadius: designSystem.borderRadius.lg,
                border: "none",
                background: "transparent",
                color: designSystem.colors.text.primary,
                cursor: "pointer",
                transition: designSystem.transition.colors,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  designSystem.colors.background.hover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Menu Layer */}
      {showMenu && (
        <MobileMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          token={token}
          currentPage={currentPage}
          customerLanguage={customerLanguage}
          isEcommerce={isEcommerce}
        />
      )}
    </>
  )
}
