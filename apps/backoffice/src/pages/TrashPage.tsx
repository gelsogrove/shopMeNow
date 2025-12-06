/**
 * Trash Page - Manage Soft-Deleted Items
 * 
 * Feature 196 - Soft Delete System
 * 4 tabs: Users, Workspaces, Agents, Operators
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/services/api'
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle,
  Users,
  Building2,
  UserCog,
  Loader2,
  RefreshCw,
  Clock
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

interface DeletedUser {
  id: string
  email: string
  firstName: string
  lastName: string
  name: string
  role: string
  deletedAt: string
  daysUntilPermanentDelete: number
  workspaces: Array<{ id: string; name: string; role: string }>
}

interface DeletedWorkspace {
  id: string
  name: string
  ownerEmail: string
  deletedAt: string
  daysUntilPermanentDelete: number
  customerCount: number
}

export function TrashPage() {
  const [activeTab, setActiveTab] = useState('users')  // Default to users tab
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Data states
  const [deletedUsers, setDeletedUsers] = useState<DeletedUser[]>([])
  const [deletedWorkspaces, setDeletedWorkspaces] = useState<DeletedWorkspace[]>([])
  const [deletedAgents, setDeletedAgents] = useState<DeletedUser[]>([])
  const [deletedOperators, setDeletedOperators] = useState<DeletedUser[]>([])
  
  // Modal states
  const [restoreModal, setRestoreModal] = useState<{ item: DeletedUser | DeletedWorkspace; type: string } | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ item: DeletedUser | DeletedWorkspace; type: string } | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      if (activeTab === 'users') {
        const response = await api.trash.getUsers()
        if (response.success && response.data) {
          setDeletedUsers(response.data.items || [])
        }
      } else if (activeTab === 'workspaces') {
        const response = await api.trash.getWorkspaces()
        if (response.success && response.data) {
          setDeletedWorkspaces(response.data.items || [])
        }
      } else if (activeTab === 'agents') {
        const response = await api.trash.getUsers()
        if (response.success && response.data) {
          // Filter users by AGENT role
          const agents = (response.data.items || []).filter(u => u.role === 'AGENT')
          setDeletedAgents(agents)
        }
      } else if (activeTab === 'operators') {
        const response = await api.trash.getUsers()
        if (response.success && response.data) {
          // Filter users by OPERATOR role
          const operators = (response.data.items || []).filter(u => u.role === 'OPERATOR')
          setDeletedOperators(operators)
        }
      }
    } catch (err) {
      setError('Failed to load deleted items')
      console.error('Error loading trash:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeTab])

  const handleRestore = async () => {
    if (!restoreModal) return
    
    setIsProcessing(true)
    try {
      const response = await api.trash.restore(restoreModal.item.id, restoreModal.type)
      if (response.success) {
        loadData()
        setRestoreModal(null)
      } else {
        setError(response.error || 'Failed to restore item')
      }
    } catch (err) {
      setError('Failed to restore item')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (!deleteModal || deleteConfirmation !== 'PERMANENTLY DELETE') return
    
    setIsProcessing(true)
    try {
      const response = await api.trash.permanentlyDelete(deleteModal.item.id, deleteModal.type, deleteConfirmation)
      if (response.success) {
        loadData()
        setDeleteModal(null)
        setDeleteConfirmation('')
      } else {
        setError(response.error || 'Failed to delete item')
      }
    } catch (err) {
      setError('Failed to delete item')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="h-8 w-8 text-gray-500" />
            Trash Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage soft-deleted items. Items are permanently deleted after 90 days.
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="workspaces" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Workspaces
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="operators" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Operators
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Deleted Users</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : deletedUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No deleted users</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deletedUsers.map((user) => (
                    <div 
                      key={user.id} 
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{user.name || user.email}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        <p className="text-sm text-gray-400">Role: {user.role}</p>
                        {user.workspaces.length > 0 && (
                          <p className="text-sm text-gray-400">
                            Workspaces: {user.workspaces.map(w => w.name).join(', ')}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Deleted: {formatDate(user.deletedAt)}</span>
                          <span className="flex items-center gap-1 text-orange-600">
                            <Clock className="h-3 w-3" />
                            {user.daysUntilPermanentDelete} days until permanent delete
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setRestoreModal({ item: user, type: 'user' })}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => setDeleteModal({ item: user, type: 'user' })}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workspaces Tab */}
        <TabsContent value="workspaces">
          <Card>
            <CardHeader>
              <CardTitle>Deleted Workspaces</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : deletedWorkspaces.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No deleted workspaces</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deletedWorkspaces.map((workspace) => (
                    <div 
                      key={workspace.id} 
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{workspace.name}</p>
                        <p className="text-sm text-gray-500">Owner: {workspace.ownerEmail}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Deleted: {formatDate(workspace.deletedAt)}</span>
                          <span>{workspace.customerCount} customers</span>
                          <span className="flex items-center gap-1 text-orange-600">
                            <Clock className="h-3 w-3" />
                            {workspace.daysUntilPermanentDelete} days until permanent delete
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setRestoreModal({ item: workspace, type: 'workspace' })}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => setDeleteModal({ item: workspace, type: 'workspace' })}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>Deleted Agents</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : deletedAgents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <UserCog className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No deleted agents</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deletedAgents.map((agent) => (
                    <div 
                      key={agent.id} 
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{agent.name || agent.email}</p>
                        <p className="text-sm text-gray-500">{agent.email}</p>
                        {agent.workspaces.length > 0 && (
                          <p className="text-sm text-gray-400">
                            Workspaces: {agent.workspaces.map(w => w.name).join(', ')}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Deleted: {formatDate(agent.deletedAt)}</span>
                          <span className="flex items-center gap-1 text-orange-600">
                            <Clock className="h-3 w-3" />
                            {agent.daysUntilPermanentDelete} days until permanent delete
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setRestoreModal({ item: agent, type: 'user' })}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => setDeleteModal({ item: agent, type: 'user' })}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operators Tab */}
        <TabsContent value="operators">
          <Card>
            <CardHeader>
              <CardTitle>Deleted Operators</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : deletedOperators.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <UserCog className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No deleted operators</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deletedOperators.map((operator) => (
                    <div 
                      key={operator.id} 
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{operator.name || operator.email}</p>
                        <p className="text-sm text-gray-500">{operator.email}</p>
                        {operator.workspaces.length > 0 && (
                          <p className="text-sm text-gray-400">
                            Workspaces: {operator.workspaces.map(w => w.name).join(', ')}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Deleted: {formatDate(operator.deletedAt)}</span>
                          <span className="flex items-center gap-1 text-orange-600">
                            <Clock className="h-3 w-3" />
                            {operator.daysUntilPermanentDelete} days until permanent delete
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setRestoreModal({ item: operator, type: 'user' })}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => setDeleteModal({ item: operator, type: 'user' })}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Restore Confirmation Dialog */}
      <Dialog open={!!restoreModal} onOpenChange={() => setRestoreModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore this {restoreModal?.type}? 
              This will restore the item and all related data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreModal(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={!!deleteModal} onOpenChange={() => {
        setDeleteModal(null)
        setDeleteConfirmation('')
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>
                This action is <strong>irreversible</strong>. The {deleteModal?.type} and all 
                related data will be permanently deleted from the database.
              </p>
              <p>
                To confirm, type <span className="font-mono font-bold">PERMANENTLY DELETE</span> below:
              </p>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="Type PERMANENTLY DELETE to confirm"
            className="font-mono"
          />
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteModal(null)
                setDeleteConfirmation('')
              }} 
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handlePermanentDelete} 
              disabled={isProcessing || deleteConfirmation !== 'PERMANENTLY DELETE'}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Permanently Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
