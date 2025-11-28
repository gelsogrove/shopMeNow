import React, { useEffect, useRef, useState } from "react"
import { getPublicPageTexts } from "../../utils/publicPageTranslations"

interface PublicPageLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  customerLanguage?: string
  token?: string | null
  currentPage?: "cart" | "orders" | "profile" | "gdpr"
  showNavigation?: boolean
  icon?: React.ReactNode
  className?: string
}

export const PublicPageLayout: React.FC<PublicPageLayoutProps> = ({
  children,
  title,
  subtitle,
  customerLanguage,
  token,
  currentPage,
  showNavigation = true,
  icon,
  className = "",
}) => {
  const texts = getPublicPageTexts(customerLanguage)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 🛒 Navigate to different pages using same token
  const handleNavigation = (page: "cart" | "orders" | "profile" | "gdpr") => {
    if (!token) return

    const urls = {
      cart: `/checkout?token=${token}`,
      orders: `/orders-public?token=${token}`,
      profile: `/customer-profile?token=${token}`,
      gdpr: `/gdpr?token=${token}`, // Per ora placeholder
    }

    setIsMenuOpen(false) // Chiudi il menu dopo la navigazione
    window.location.href = urls[page]
  }

  // Chiudi il menu quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Menu items con icone e stato
  const menuItems = [
    {
      key: "cart",
      label: texts.viewCart,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01"
          />
        </svg>
      ),
    },
    {
      key: "orders",
      label: texts.viewOrders,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      key: "profile",
      label: texts.viewProfile,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    {
      key: "gdpr",
      label: "GDPR",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
  ]

  return (
    <div className={`min-h-screen bg-gray-100 ${className}`}>
      {/* Header uniforme */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            {/* Titolo con icona */}
            <div className="flex items-center gap-3">
              {icon && <div className="text-green-600">{icon}</div>}
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-sm sm:text-base text-gray-600 mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Menu Hamburger */}
            {showNavigation && token && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg transition-colors flex items-center justify-center"
                  title="Menu"
                >
                  {/* Icona hamburger (3 linee) */}
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    {menuItems.map((item) => {
                      const isActive = currentPage === item.key
                      return (
                        <button
                          key={item.key}
                          onClick={() =>
                            handleNavigation(
                              item.key as "cart" | "orders" | "profile" | "gdpr"
                            )
                          }
                          className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                            isActive
                              ? "bg-blue-50 text-blue-700 border-r-4 border-blue-700"
                              : "text-gray-700"
                          }`}
                        >
                          <span
                            className={
                              isActive ? "text-blue-700" : "text-gray-500"
                            }
                          >
                            {item.icon}
                          </span>
                          <span
                            className={`font-medium ${
                              isActive ? "text-blue-700" : "text-gray-700"
                            }`}
                          >
                            {item.label}
                          </span>
                          {isActive && (
                            <span className="ml-auto">
                              <svg
                                className="h-4 w-4 text-blue-700"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content con padding uniforme */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default PublicPageLayout
