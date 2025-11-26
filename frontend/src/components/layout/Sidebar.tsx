import { cn } from "@/lib/utils"
import {
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
  // Temporarily removed hooks to test single API call
  const totalUnreadMessages = 0
  const workspace = null
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    ecommerce: false, // Inizialmente chiuso
  })

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
    {
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
        {
          href: "/suppliers",
          label: "Suppliers",
          icon: Building2,
        },
        {
          href: "/sales",
          label: "Sales",
          icon: UserCircle,
        },
        {
          href: "/admin/orders",
          label: "Orders",
          icon: ShoppingCart,
        },
      ],
    },
    {
      href: "/campaigns",
      label: "Campaigns",
      icon: Megaphone,
    },
  ]

  const mainLinks = baseLinks

  return (
    <aside className="fixed inset-y-0 left-0 w-72 bg-white border-r">
      <div className="flex flex-col h-full">
        <div className="flex items-center h-24 px-8 border-b">
          <span className="text-2xl font-bold text-green-600">ShopME</span>
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
                        ? "bg-green-50 text-green-600"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
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
                                ? "bg-green-50 text-green-600"
                                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
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
                        ? "bg-green-50 text-green-600"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
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
