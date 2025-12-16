import { cn } from "@/lib/utils"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { IMG_BASE_URL } from "@/config"
import {
  Bot,
  Building2,
  HelpCircle,
  LucideIcon,
  Megaphone,
  MessageSquare,
  Package2,
  Percent,
  ShoppingCart,
  UserCircle,
  Users,
  Wrench,
} from "lucide-react"
import { useEffect, useState } from "react"
import { NavLink, useLocation } from "react-router-dom"

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

export function Sidebar() {
  // Get workspace from context to check hasSalesAgents
  const { workspace } = useWorkspace()
  const totalUnreadMessages = 0
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    ecommerce: false, // Inizialmente chiuso
  })
  
  // Check if in impersonation mode (Feature 190)
  const [isImpersonating, setIsImpersonating] = useState(false)
  
  useEffect(() => {
    const impersonating = localStorage.getItem('isImpersonating') === 'true'
    setIsImpersonating(impersonating)
  }, [])

  // Controlla se siamo in una pagina che fa parte del sottomenu E-commerce
  useEffect(() => {
    const ecommercePages = ["/products", "/services", "/offers", "/suppliers", "/sales", "/admin/orders"]
    if (ecommercePages.some((page) => location.pathname.startsWith(page))) {
      setExpandedItems((prev) => ({
        ...prev,
        ecommerce: true,
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
      label: "Chat History",
      icon: MessageSquare,
      badge: totalUnreadMessages > 0 ? totalUnreadMessages : undefined,
    },
    {
      href: "/clients",
      label: "Clients",
      icon: Users,
    },
    {
      href: "/faq",
      label: "FAQ",
      icon: HelpCircle,
    },
    // E-commerce menu - only if sellsProductsAndServices is true
    ...(workspace?.sellsProductsAndServices === true ? [{
      label: "E-commerce",
      icon: ShoppingCart,
      key: "ecommerce",
      children: [
        {
          href: "/products",
          label: "Products",
          icon: Package2,
        },
        {
          href: "/services",
          label: "Services",
          icon: Wrench,
        },
        {
          href: "/offers",
          label: "Offers",
          icon: Percent,
        },
        // Suppliers menu - only if hasSuppliers is true
        ...(workspace?.hasSuppliers === true ? [{
          href: "/suppliers",
          label: "Suppliers",
          icon: Building2,
        }] : []),
        // Sales menu - only if hasSalesAgents is true
        ...(workspace?.hasSalesAgents === true ? [{
          href: "/sales",
          label: "Sales",
          icon: UserCircle,
        }] : []),
        {
          href: "/admin/orders",
          label: "Orders",
          icon: ShoppingCart,
        },
      ],
    }] : []),
    {
      href: "/campaigns",
      label: "Campaigns",
      icon: Megaphone,
    },
  ]

  const mainLinks = baseLinks

  return (
    <aside className="fixed top-16 bottom-0 left-0 w-72 bg-gray-100 border-r">
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
