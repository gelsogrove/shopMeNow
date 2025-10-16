import designSystem from "@/styles/designSystem"
import {
  publicPageTranslations,
  type SupportedLanguage,
} from "@/utils/publicPageTranslations"
import React from "react"
import { useNavigate } from "react-router-dom"

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  token?: string | null
  currentPage?: "cart" | "orders" | "profile"
  customerLanguage?: string
}

interface MenuItem {
  icon: string
  label: string
  path: string
  page: "cart" | "orders" | "profile"
}

/**
 * MobileMenu - Full-screen menu overlay per mobile
 * Features:
 * - Full-screen layer con animazione slide-in
 * - Menu items con icone e highlight attivo
 * - Close button in alto
 * - Backdrop con dismiss
 */
export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  token,
  currentPage = "cart",
  customerLanguage = "it",
}) => {
  const navigate = useNavigate()

  // Get translations based on customer language
  const langCode = (customerLanguage?.toUpperCase() ||
    "IT") as SupportedLanguage
  const t = publicPageTranslations[langCode] || publicPageTranslations.IT

  // Menu items configuration
  const menuItems: MenuItem[] = [
    {
      icon: "🛒",
      label: t.cart,
      path: `/checkout?token=${token}`,
      page: "cart",
    },
    {
      icon: "📦",
      label: t.myOrders,
      path: `/orders-public?token=${token}`,
      page: "orders",
    },
    {
      icon: "👤",
      label: t.profile,
      path: `/customer-profile?token=${token}`,
      page: "profile",
    },
  ]

  const handleMenuItemClick = (path: string) => {
    onClose()
    navigate(path)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: designSystem.zIndex.modalBackdrop,
          animation: "fadeIn 250ms ease-out",
        }}
      />

      {/* Menu Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(320px, 85vw)",
          backgroundColor: designSystem.colors.background.card,
          zIndex: designSystem.zIndex.modal,
          boxShadow: designSystem.shadow["2xl"],
          animation: "slideInRight 250ms ease-out",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: designSystem.spacing[4],
            borderBottom: `1px solid ${designSystem.colors.border.light}`,
          }}
        >
          <h2
            style={{
              fontSize: designSystem.typography.fontSize.xl,
              fontWeight: designSystem.typography.fontWeight.bold,
              color: designSystem.colors.text.primary,
              margin: 0,
            }}
          >
            {t.menuTitle}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              borderRadius: designSystem.borderRadius.lg,
              border: "none",
              background: "transparent",
              color: designSystem.colors.text.secondary,
              cursor: "pointer",
              transition: designSystem.transition.colors,
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Menu Items */}
        <nav
          style={{
            flex: 1,
            padding: designSystem.spacing[2],
            overflowY: "auto",
          }}
        >
          {menuItems.map((item) => {
            const isActive = item.page === currentPage
            return (
              <button
                key={item.page}
                onClick={() => handleMenuItemClick(item.path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: designSystem.spacing[3],
                  width: "100%",
                  padding: designSystem.spacing[4],
                  marginBottom: designSystem.spacing[2],
                  border: "none",
                  borderRadius: designSystem.borderRadius.lg,
                  background: isActive
                    ? `linear-gradient(135deg, ${designSystem.colors.primary[50]}, ${designSystem.colors.secondary[50]})`
                    : "transparent",
                  color: isActive
                    ? designSystem.colors.primary[700]
                    : designSystem.colors.text.primary,
                  fontSize: designSystem.typography.fontSize.base,
                  fontWeight: isActive
                    ? designSystem.typography.fontWeight.semibold
                    : designSystem.typography.fontWeight.normal,
                  cursor: "pointer",
                  transition: designSystem.transition.all,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor =
                      designSystem.colors.background.hover
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent"
                  }
                }}
              >
                <span style={{ fontSize: "24px" }}>{item.icon}</span>
                <span>{item.label}</span>
                {isActive && (
                  <svg
                    style={{ marginLeft: "auto" }}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer Info */}
        <div
          style={{
            padding: designSystem.spacing[4],
            borderTop: `1px solid ${designSystem.colors.border.light}`,
            fontSize: designSystem.typography.fontSize.sm,
            color: designSystem.colors.text.tertiary,
            textAlign: "center",
          }}
        >
          ShopME v1.0
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  )
}
