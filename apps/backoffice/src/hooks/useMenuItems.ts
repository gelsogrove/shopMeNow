import { useContext } from 'react'
import { WorkspaceContext } from '../contexts/WorkspaceContext'

export interface MenuItem {
  label: string
  path: string
  requiresEcommerce: boolean
  icon?: string // Optional: for icon display
  description?: string
}

/**
 * Menu items visibility hook
 * Filters menu items based on channel type (e-commerce vs informational)
 * 
 * E-COMMERCE (sellsProductsAndServices = true):
 * - Shows: Chat, Products, Categories, Services, Orders, Customers, Offers, Campaigns, FAQ, Settings
 * 
 * INFORMATIONAL (sellsProductsAndServices = false):
 * - Shows: Chat, FAQ, Settings (basic support/info)
 */
export function useMenuItems(): MenuItem[] {
  const { workspace } = useContext(WorkspaceContext)

  const allItems: MenuItem[] = [
    {
      label: 'Chat',
      path: '/chat',
      requiresEcommerce: false,
      description: 'Customer conversations',
    },
    {
      label: 'Products',
      path: '/products',
      requiresEcommerce: true,
      description: 'Manage products',
    },
    {
      label: 'Categories',
      path: '/categories',
      requiresEcommerce: true,
      description: 'Product categories',
    },
    {
      label: 'Services',
      path: '/services',
      requiresEcommerce: true,
      description: 'Services offered',
    },
    {
      label: 'Orders',
      path: '/admin/orders',
      requiresEcommerce: true,
      description: 'Customer orders',
    },
    {
      label: 'Customers',
      path: '/clients',
      requiresEcommerce: true,
      description: 'Customer management',
    },
    {
      label: 'Offers',
      path: '/offers',
      requiresEcommerce: true,
      description: 'Active offers',
    },
    {
      label: 'Campaigns',
      path: '/campaigns',
      requiresEcommerce: true,
      description: 'Marketing campaigns',
    },
    {
      label: 'FAQ',
      path: '/faq',
      requiresEcommerce: false,
      description: 'FAQ management',
    },
    {
      label: 'Settings',
      path: '/settings',
      requiresEcommerce: false,
      description: 'Workspace settings',
    },
  ]

  // Filter based on workspace channel type
  return allItems.filter((item) => {
    // ❌ HIDE items that require e-commerce if workspace is informational
    if (item.requiresEcommerce && !workspace?.sellsProductsAndServices) {
      return false
    }
    // ✅ SHOW all other items
    return true
  })
}

/**
 * Get label for current channel type
 * @returns "E-commerce" or "Informational"
 */
export function getChannelTypeLabel(sellsProductsAndServices?: boolean): string {
  if (sellsProductsAndServices === true) return 'E-commerce'
  if (sellsProductsAndServices === false) return 'Informational'
  return 'Unknown'
}
