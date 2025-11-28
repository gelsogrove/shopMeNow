import { ArrowLeft, Home, Package, ShoppingCart, User } from "lucide-react"
import React, { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { mobileClasses } from "../../styles/theme"

interface MobileLayoutProps {
  title: string
  children: ReactNode
  showBackButton?: boolean
  backUrl?: string
  headerActions?: ReactNode
  showBottomNav?: boolean
  currentPage?: "home" | "orders" | "cart" | "profile"
  className?: string
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  title,
  children,
  showBackButton = false,
  backUrl,
  headerActions,
  showBottomNav = true,
  currentPage = "home",
  className = "",
}) => {
  const navigate = useNavigate()

  const handleBack = () => {
    if (backUrl) {
      navigate(backUrl)
    } else {
      navigate(-1)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Mobile Header */}
      <header className={mobileClasses.mobileHeader}>
        <div className="relative flex items-center justify-center">
          {/* Back Button */}
          {showBackButton && (
            <button
              onClick={handleBack}
              className={mobileClasses.mobileBackButton}
              aria-label="Torna indietro"
            >
              <ArrowLeft className="h-5 w-5 text-neutral-600" />
            </button>
          )}

          {/* Title */}
          <h1 className={mobileClasses.mobileTitle}>{title}</h1>

          {/* Header Actions */}
          {headerActions && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {headerActions}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 ${mobileClasses.container} py-4 ${className}`}>
        {children}
      </main>

      {/* Bottom Navigation */}
      {showBottomNav && <BottomNavigation currentPage={currentPage} />}
    </div>
  )
}

// Bottom Navigation Component
interface BottomNavigationProps {
  currentPage: "home" | "orders" | "cart" | "profile"
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ currentPage }) => {
  const navigate = useNavigate()

  const navItems = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      onClick: () => navigate("/"),
    },
    {
      id: "orders",
      label: "Ordini",
      icon: Package,
      onClick: () => navigate("/orders"),
    },
    {
      id: "cart",
      label: "Carrello",
      icon: ShoppingCart,
      onClick: () => navigate("/checkout"),
    },
    {
      id: "profile",
      label: "Profilo",
      icon: User,
      onClick: () => navigate("/profile"),
    },
  ]

  return (
    <nav className="sticky bottom-0 z-50 bg-white border-t border-neutral-200 px-2 py-2 safe-area-inset-bottom">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id

          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors min-w-0 flex-1 ${
                isActive
                  ? "text-primary-500 bg-primary-50"
                  : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
