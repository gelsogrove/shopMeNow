/**
 * Clients Page - Manage Users & Workspaces
 * 
 * Displays user cards with:
 * - User info (name, email, company, phone)
 * - Workspace stats (customers, credit balance)
 * - Admin flags (isPlatformAdmin, isDeveloperUser)
 * - Enable/disable toggle
 */

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { api } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Users, 
  Search, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Building2,
  Phone,
  CreditCard,
  Calendar,
  LogOut,
  UserCheck,
  RefreshCw,
  MessageSquare,
  Gift,
  ShieldOff
} from 'lucide-react'

interface OwnedWorkspace {
  id: string
  name: string
  slug: string
  creditBalance: number
  planType: string
  language: string
  isActive: boolean
  whatsappPhoneNumber: string | null
  channelStatus: boolean
  numCustomers: number
  numProducts: number
}

interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  isPlatformAdmin: boolean
  isDeveloperUser: boolean
  twoFactorEnabled: boolean
  requires2FA: boolean  // true if user should have 2FA (not admin/dev)
  status: string
  createdAt: string
  lastLogin: string | null
  companyName: string | null
  phoneNumber: string | null
  profilePicture: string | null
  authProvider: string
  isOwner: boolean
  ownedWorkspaces: OwnedWorkspace[]
  totalCredit: number
  totalCustomers: number
  totalProducts: number
}

// Language to flag emoji mapping
const languageFlags: Record<string, string> = {
  'ENG': '🇬🇧',
  'ITA': '🇮🇹',
  'ESP': '🇪🇸',
  'POR': '🇵🇹',
  'FRA': '🇫🇷',
  'DEU': '🇩🇪',
  'en': '🇬🇧',
  'it': '🇮🇹',
  'es': '🇪🇸',
  'pt': '🇵🇹',
  'fr': '🇫🇷',
  'de': '🇩🇪',
}

export function ClientsPage() {
  const { logout } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false) // Toggle to show admin/developer users
  
  // Bonus modal state
  const [bonusModal, setBonusModal] = useState<{ workspaceId: string; workspaceName: string } | null>(null)
  const [bonusAmount, setBonusAmount] = useState('')
  const [bonusReason, setBonusReason] = useState('')
  const [addingBonus, setAddingBonus] = useState(false)
  
  // 2FA Reset modal state (Feature 189)
  const [reset2FAModal, setReset2FAModal] = useState<{ userId: string; email: string } | null>(null)
  const [resetting2FA, setResetting2FA] = useState(false)
  
  // 2FA Enable modal state (Feature 189 - for users who haven't set up 2FA yet)
  const [enable2FAModal, setEnable2FAModal] = useState<{ userId: string; email: string } | null>(null)
  const [enabling2FA, setEnabling2FA] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.users.getAll()
      if (response.success && response.data) {
        setUsers(response.data)
      } else {
        setError(response.error || 'Failed to load users')
      }
    } catch (err) {
      setError('Failed to load users')
      console.error('Error loading users:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (userId: string, field: 'isPlatformAdmin' | 'isDeveloperUser', currentValue: boolean) => {
    setUpdating(userId)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const response = await api.users.updatePermissions(userId, {
        [field]: !currentValue
      })
      
      if (response.success) {
        // Mutual exclusion: if enabling one, disable the other
        const newValue = !currentValue
        setUsers(prev => prev.map(user => {
          if (user.id !== userId) return user
          
          if (newValue) {
            // Enabling one disables the other
            return field === 'isPlatformAdmin'
              ? { ...user, isPlatformAdmin: true, isDeveloperUser: false }
              : { ...user, isDeveloperUser: true, isPlatformAdmin: false }
          } else {
            // Just disabling
            return { ...user, [field]: false }
          }
        }))
        setSuccessMessage(`${field === 'isPlatformAdmin' ? 'Platform Admin' : 'Developer Mode'} ${newValue ? 'enabled' : 'disabled'}`)
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(response.error || 'Failed to update permissions')
      }
    } catch (err) {
      setError('Failed to update permissions')
      console.error('Error updating permissions:', err)
    } finally {
      setUpdating(null)
    }
  }

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    setUpdating(userId)
    setError(null)
    setSuccessMessage(null)
    
    const newStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    
    try {
      const response = await api.users.updateStatus(userId, newStatus)
      
      if (response.success) {
        setUsers(prev => prev.map(user => 
          user.id === userId 
            ? { ...user, status: newStatus }
            : user
        ))
        setSuccessMessage(`User ${newStatus === 'DISABLED' ? 'disabled' : 'enabled'}`)
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(response.error || 'Failed to update status')
      }
    } catch (err) {
      setError('Failed to update status')
      console.error('Error updating status:', err)
    } finally {
      setUpdating(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleAddBonus = async () => {
    if (!bonusModal) return
    
    const amount = parseFloat(bonusAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid positive amount')
      return
    }
    
    if (!bonusReason.trim() || bonusReason.trim().length < 3) {
      setError('Please enter a reason (minimum 3 characters)')
      return
    }
    
    setAddingBonus(true)
    setError(null)
    
    try {
      const response = await api.users.addBonus(bonusModal.workspaceId, amount, bonusReason.trim())
      
      if (response.success && response.data) {
        // Update local state with new balance
        setUsers(prev => prev.map(user => ({
          ...user,
          ownedWorkspaces: user.ownedWorkspaces.map(ws => 
            ws.id === bonusModal.workspaceId 
              ? { ...ws, creditBalance: response.data!.newBalance }
              : ws
          ),
          totalCredit: user.ownedWorkspaces.some(ws => ws.id === bonusModal.workspaceId)
            ? user.totalCredit + amount
            : user.totalCredit
        })))
        
        setSuccessMessage(`Added €${amount.toFixed(2)} bonus to ${bonusModal.workspaceName}`)
        setTimeout(() => setSuccessMessage(null), 3000)
        
        // Close modal
        setBonusModal(null)
        setBonusAmount('')
        setBonusReason('')
      } else {
        setError(response.error || 'Failed to add bonus')
      }
    } catch (err) {
      setError('Failed to add bonus')
      console.error('Error adding bonus:', err)
    } finally {
      setAddingBonus(false)
    }
  }

  // Handle 2FA Reset (Feature 189)
  const handle2FAReset = async () => {
    if (!reset2FAModal) return
    
    setResetting2FA(true)
    setError(null)
    
    try {
      const response = await api.users.reset2FA(reset2FAModal.userId)
      
      if (response.success) {
        setSuccessMessage(`2FA reset email sent to ${reset2FAModal.email}`)
        setTimeout(() => setSuccessMessage(null), 5000)
        
        // Update local state to reflect 2FA is now disabled
        setUsers(prev => prev.map(user => 
          user.id === reset2FAModal.userId 
            ? { ...user, twoFactorEnabled: false }
            : user
        ))
        
        // Close modal
        setReset2FAModal(null)
      } else {
        setError(response.error || 'Failed to reset 2FA')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset 2FA')
      console.error('Error resetting 2FA:', err)
    } finally {
      setResetting2FA(false)
    }
  }

  // Handle 2FA Enable - Send setup email to user who hasn't configured 2FA yet (Feature 189)
  const handle2FAEnable = async () => {
    if (!enable2FAModal) return
    
    setEnabling2FA(true)
    setError(null)
    
    try {
      const response = await api.users.enable2FA(enable2FAModal.userId)
      
      if (response.success) {
        setSuccessMessage(`2FA setup email sent to ${enable2FAModal.email}`)
        setTimeout(() => setSuccessMessage(null), 5000)
        
        // Close modal
        setEnable2FAModal(null)
      } else {
        setError(response.error || 'Failed to send 2FA setup email')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send 2FA setup email')
      console.error('Error enabling 2FA:', err)
    } finally {
      setEnabling2FA(false)
    }
  }

  // Filter users: first by search query, then by showAll toggle
  const filteredUsers = users
    .filter(user => {
      // If showAll is false, hide admin and developer users
      if (!showAll && (user.isPlatformAdmin || user.isDeveloperUser)) {
        return false
      }
      return true
    })
    .filter(user => 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.companyName && user.companyName.toLowerCase().includes(searchQuery.toLowerCase()))
    )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Client Management
          </h1>
          <p className="text-gray-500 mt-1">
            {filteredUsers.length} users registered
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadUsers} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={logout} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 p-3 text-sm text-green-600 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by email, name, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Show All Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            checked={showAll}
            onCheckedChange={setShowAll}
            className="data-[state=checked]:bg-purple-500"
          />
          <span className="text-sm font-medium text-gray-600">Show All</span>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id} className={`relative overflow-hidden ${user.isOwner ? 'ring-2 ring-blue-200' : ''} ${user.status === 'DISABLED' ? 'opacity-60' : ''}`}>
            <CardContent className="p-5">
              {/* User Header */}
              <div className="flex items-start gap-3 mb-4">
                {user.profilePicture ? (
                  <img 
                    src={user.profilePicture} 
                    alt={user.email}
                    className="w-12 h-12 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback to initials if image fails to load
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                ) : null}
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg ${user.profilePicture ? 'hidden' : ''}`}>
                  {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user.email.split('@')[0]
                    }
                  </h3>
                  <p className="text-sm text-gray-500 truncate">{user.email}</p>
                </div>
              </div>

              {/* User Details */}
              <div className="space-y-1.5 mb-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="text-gray-400">📧</span>
                  <span className="truncate">{user.email}</span>
                </div>
                {user.phoneNumber && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{user.phoneNumber}</span>
                  </div>
                )}
                {user.companyName && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="truncate">{user.companyName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>Last login: {formatDate(user.lastLogin)}</span>
                </div>
              </div>

              {/* Owner Stats */}
              {user.isOwner && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase">Owner Stats</span>
                    {user.ownedWorkspaces[0] && (
                      <span className="text-lg">{languageFlags[user.ownedWorkspaces[0].language] || '🌍'}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">€{user.totalCredit.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{user.totalCustomers} clients</span>
                    </div>
                  </div>
                  
                  {/* WhatsApp Channels */}
                  {user.ownedWorkspaces.some(ws => ws.whatsappPhoneNumber) && (
                    <div className="pt-2 border-t border-gray-200">
                      <span className="text-xs font-medium text-gray-500 uppercase block mb-1">Channels</span>
                      <div className="space-y-1">
                        {user.ownedWorkspaces.filter(ws => ws.whatsappPhoneNumber).map(ws => (
                          <div key={ws.id} className="flex items-center gap-2 text-sm">
                            <MessageSquare className={`h-3.5 w-3.5 ${ws.channelStatus ? 'text-green-500' : 'text-gray-400'}`} />
                            <span className={ws.channelStatus ? 'text-green-700' : 'text-gray-500'}>
                              {ws.whatsappPhoneNumber}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${ws.channelStatus ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {ws.channelStatus ? 'ON' : 'OFF'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Bonus Button */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3 gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                    onClick={() => setBonusModal({ workspaceId: user.ownedWorkspaces[0].id, workspaceName: user.ownedWorkspaces[0].name })}
                  >
                    <Gift className="h-4 w-4" />
                    Add Bonus Credit
                  </Button>
                </div>
              )}
              
              {/* 2FA Reset Button - Only show for users who have 2FA enabled */}
              {user.requires2FA && user.twoFactorEnabled && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={() => setReset2FAModal({ userId: user.id, email: user.email })}
                >
                  <ShieldOff className="h-4 w-4" />
                  Reset 2FA
                </Button>
              )}
              
              {/* 2FA Enable Button - Show for users who need 2FA but haven't set it up */}
              {user.requires2FA && !user.twoFactorEnabled && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2 gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                  onClick={() => setEnable2FAModal({ userId: user.id, email: user.email })}
                >
                  <ShieldOff className="h-4 w-4" />
                  Send 2FA Setup
                </Button>
              )}

              {/* Permission Toggles - Aligned at bottom */}
              <div className="pt-3 border-t space-y-3">
                {/* Toggle Row */}
                <div className="flex items-center justify-between gap-4">
                  {/* Enabled Toggle */}
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={user.status === 'ACTIVE'}
                      onCheckedChange={() => handleStatusToggle(user.id, user.status)}
                      disabled={updating === user.id}
                      className="data-[state=checked]:bg-blue-500 scale-90"
                    />
                    <span className="text-xs font-medium text-gray-600">Enabled</span>
                  </div>
                  
                  {/* Platform Admin Toggle */}
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={user.isPlatformAdmin}
                      onCheckedChange={() => handleToggle(user.id, 'isPlatformAdmin', user.isPlatformAdmin)}
                      disabled={updating === user.id}
                      className="data-[state=checked]:bg-purple-500 scale-90"
                    />
                    <span className="text-xs font-medium text-gray-600">Admin</span>
                  </div>
                  
                  {/* Developer Mode Toggle */}
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={user.isDeveloperUser}
                      onCheckedChange={() => handleToggle(user.id, 'isDeveloperUser', user.isDeveloperUser)}
                      disabled={updating === user.id}
                      className="data-[state=checked]:bg-green-500 scale-90"
                    />
                    <span className="text-xs font-medium text-gray-600">Dev</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredUsers.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No users found</p>
          </div>
        )}
      </div>
      
      {/* Bonus Modal */}
      {bonusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-500" />
              Add Bonus Credit
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Add free credits to <strong>{bonusModal.workspaceName}</strong>. 
              This will not be invoiced.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (€)
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g., 10.00"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Beta tester reward"
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setBonusModal(null)
                  setBonusAmount('')
                  setBonusReason('')
                }}
                disabled={addingBonus}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                onClick={handleAddBonus}
                disabled={addingBonus || !bonusAmount || !bonusReason}
              >
                {addingBonus ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Gift className="h-4 w-4 mr-2" />
                )}
                Add Bonus
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* 2FA Reset Confirmation Modal (Feature 189) */}
      {reset2FAModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-600">
              <ShieldOff className="h-5 w-5" />
              Reset Two-Factor Authentication
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              You are about to reset 2FA for:
            </p>
            <p className="font-medium text-gray-900 mb-4 bg-gray-50 p-2 rounded">
              {reset2FAModal.email}
            </p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Warning:</strong> This will immediately disable the user's 2FA. 
                They will receive an email with a link to set up new 2FA. 
                The old authenticator codes will stop working immediately.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setReset2FAModal(null)}
                disabled={resetting2FA}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600"
                onClick={handle2FAReset}
                disabled={resetting2FA}
              >
                {resetting2FA ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShieldOff className="h-4 w-4 mr-2" />
                )}
                Confirm Reset
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* 2FA Enable Confirmation Modal (Feature 189) */}
      {enable2FAModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-600">
              <ShieldOff className="h-5 w-5" />
              Send 2FA Setup Email
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              You are about to send a 2FA setup email to:
            </p>
            <p className="font-medium text-gray-900 mb-4 bg-gray-50 p-2 rounded">
              {enable2FAModal.email}
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Info:</strong> The user will receive an email with a secure link 
                to set up their two-factor authentication. The link will expire in 1 hour.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEnable2FAModal(null)}
                disabled={enabling2FA}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                onClick={handle2FAEnable}
                disabled={enabling2FA}
              >
                {enabling2FA ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShieldOff className="h-4 w-4 mr-2" />
                )}
                Send Email
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
