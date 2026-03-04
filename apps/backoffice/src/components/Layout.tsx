import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Shield,
  Clock,
  FileText,
  LogOut,
  Settings,
  Trash2,
  Scale,
  LineChart,
  Inbox,
  Zap,
  MessageSquare,
  ClipboardList,
} from 'lucide-react'

const menuItems = [
  { path: '/platforms', label: 'Platforms', icon: LayoutDashboard },
  { path: '/channels', label: 'Channels', icon: Zap },
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/queue', label: 'Queue', icon: Inbox },
  { path: '/collections', label: 'Collections', icon: FileText },
  { path: '/analytics', label: 'Analytics', icon: LineChart },
  { path: '/pricing', label: 'Pricing', icon: CreditCard },
  { path: '/laws-documents', label: 'Laws Documents', icon: Scale },
  { path: '/support-tickets', label: 'Support Tickets', icon: MessageSquare },
  { path: '/questionnaire', label: 'Questionnaire', icon: ClipboardList },
  { path: '/schedulers', label: 'Schedulers', icon: Clock },
  { path: '/trash', label: 'Trash', icon: Trash2 },
]

export function Layout() {
  const location = useLocation()
  const { logout } = useAuth()

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            eChatbot Backoffice
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-700 hover:text-destructive"
            onClick={logout}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
