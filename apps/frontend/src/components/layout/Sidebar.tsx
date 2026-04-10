import { cn } from "@/lib/utils"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { IMG_BASE_URL } from "@/config"
import { storage } from "@/lib/storage"
import { useSupportUnreadCount } from "@/hooks/useSupportUnreadCount"
import {
  Bot,
  Building2,
  Calendar,
  Clock,
  HelpCircle,
  LifeBuoy,
  LucideIcon,
  Megaphone,
  MessageSquare,
  Package2,
  Percent,
  ShoppingCart,
  UserCircle,
  Users,
  Wrench,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { useLanguage } from "@/contexts/LanguageContext"

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

interface SidebarLink {
  href?: string // Made optional to allow non-navigable parent links
  label: string
  icon: LucideIcon
  badge?: number
  className?: string
  children?: SidebarLink[]
  isOpen?: boolean
  key?: string
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps = {}) {
  // Get workspace from context to check hasSalesAgents
  const { workspace } = useWorkspace()
  const { t } = useLanguage()
  console.log("🔍 Sidebar workspace:", workspace)
  console.log("🔍 sellsProductsAndServices:", workspace?.sellsProductsAndServices)
  const totalUnreadMessages = 0
  const location = useLocation()
  const isChatPage = location.pathname.startsWith("/chat")
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    ecommerce: false, // Inizialmente chiuso
  })
  const supportUnreadCount = useSupportUnreadCount(isChatPage)
  
  // Check if in impersonation mode (Feature 190)
  const [isImpersonating, setIsImpersonating] = useState(false)
  
  useEffect(() => {
    const { isImpersonating: impersonating } = storage.getImpersonationFlags()
    setIsImpersonating(impersonating)
  }, [])
  
  // Controlla se siamo in una pagina che fa parte del sottomenu E-commerce o Appointments
  useEffect(() => {
    const ecommercePages = ["/products", "/services", "/offers", "/sales", "/admin/orders"]
    const appointmentPages = ["/appointments", "/appointment-types", "/business-hours", "/blackout-periods"]
    if (ecommercePages.some((page) => location.pathname.startsWith(page))) {
      setExpandedItems((prev) => ({
        ...prev,
        ecommerce: true,
      }))
    }
    if (appointmentPages.some((page) => location.pathname.startsWith(page))) {
      setExpandedItems((prev) => ({
        ...prev,
        appointments: true,
      }))
    }
  }, [location.pathname])

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const baseLinks: SidebarLink[] = [
    {
      href: "/chat",
      label: t('nav.chatHistory'),
      icon: MessageSquare,
      badge: totalUnreadMessages > 0 ? totalUnreadMessages : undefined,
    },
    {
      href: "/clients",
      label: t('nav.clients'),
      icon: Users,
    },
    {
      href: "/faq",
      label: t('nav.faq'),
      icon: HelpCircle,
    },
    // E-commerce menu - only if sellsProductsAndServices is true
    ...(workspace?.sellsProductsAndServices === true ? [{
      label: t('nav.ecommerce'),
      icon: ShoppingCart,
      key: "ecommerce",
      children: [
        {
          href: "/products",
          label: t('nav.products'),
          icon: Package2,
        },
        {
          href: "/services",
          label: t('nav.services'),
          icon: Wrench,
        },
        {
          href: "/offers",
          label: t('nav.offers'),
          icon: Percent,
        },
        // Sales menu - only if hasSalesAgents is enabled
        ...(workspace?.hasSalesAgents === true ? [{
          href: "/sales",
          label: t('nav.sales'),
          icon: UserCircle,
        }] : []),
        {
          href: "/admin/orders",
          label: t('nav.orders'),
          icon: ShoppingCart,
        },
      ],
    }] : []),
    // Appointments menu - only if enableCalendarBooking is true
    ...(workspace?.enableCalendarBooking === true ? [{
      label: 'Appointments',
      icon: Calendar,
      key: "appointments",
      children: [
        {
          href: "/appointments",
          label: 'Booked Appointments',
          icon: Calendar,
        },
        {
          href: "/appointment-types",
          label: 'Appointment Types',
          icon: Package2,
        },
        {
          href: "/business-hours",
          label: 'Business Hours',
          icon: Clock,
        },
        {
          href: "/blackout-periods",
          label: 'Blackout Periods',
          icon: Calendar,
        },
      ],
    }] : []),
    {
      href: "/campaigns",
      label: t('nav.campaigns'),
      icon: Megaphone,
    },
    {
      href: "/support/tickets",
      label: t('nav.support'),
      icon: LifeBuoy,
      badge: supportUnreadCount > 0 ? supportUnreadCount : undefined,
    },
  ]

  const mainLinks = baseLinks

  return (
    <aside
      className={cn(
        "fixed top-16 bottom-0 left-0 w-72 bg-gray-100 border-r z-40 transition-transform duration-300 ease-in-out",
        // Mobile: slide in/out; Desktop: always visible
        isOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0"
      )}
    >
      <div className="flex flex-col h-full">
        
        {/* Channel Logo & Name Header */}
        <div className="px-4 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            {workspace?.logoUrl ? (
              <img
                src={workspace.logoUrl.startsWith('http') ? workspace.logoUrl : `${IMG_BASE_URL}${workspace.logoUrl}`}
                alt={workspace.name}
                className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-md"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl shadow-md">
                {workspace?.name?.charAt(0).toUpperCase() || 'C'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-gray-900 truncate">
                {workspace?.name || 'Channel'}
              </h2>
              <p className="text-xs text-gray-500">
                {workspace?.sellsProductsAndServices ? 'E-commerce' : 'Info'}
              </p>
            </div>
            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="md:hidden p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-6">
          {mainLinks.map((link) => (
            <div key={link.href}>
              {link.children ? (
                <div className="mb-1">
                  <button
                    onClick={() => toggleExpand(link.key || "unknown")}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                      expandedItems[link.key || "unknown"]
                        ? "bg-white text-green-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <link.icon className="h-6 w-6" />
                      {link.label}
                    </div>
                    <svg
                      className={`h-4 w-4 transition-transform ${
                        expandedItems[link.key || "unknown"] ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {expandedItems[link.key || "unknown"] && (
                    <div className="ml-6 mt-1 space-y-1">
                      {link.children.map((child) => (
                        <NavLink
                          key={child.href}
                          to={child.href}
                          end={child.href === "/products"}
                          onClick={onClose}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                              isActive
                                ? "bg-white text-green-600 shadow-sm"
                                : "text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-sm"
                            )
                          }
                        >
                          <child.icon className="h-5 w-5" />
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  key={link.href}
                  to={link.href}
                  end={link.href === "/"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                      isActive
                        ? "bg-white text-green-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-sm"
                    )
                  }
                >
                  <link.icon className="h-6 w-6" />
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-600">
                      {link.badge}
                    </span>
                  )}
                </NavLink>
              )}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}
