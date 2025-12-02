/**
 * BlockedUsersPage
 *
 * Shows all blocked users (customers + registration attempts)
 * Allows unblocking customers and clearing registration attempts
 */

import { PageLayout } from "@/components/layout/PageLayout"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { BlockedUser, getBlockedUsers } from "@/services/clientsApi"
import { ShieldBan, Unlock, Trash2, RefreshCw, User, UserX } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

export function BlockedUsersPage() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [counts, setCounts] = useState({ customers: 0, registrationAttempts: 0, total: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)

  // Load blocked users
  const loadBlockedUsers = async () => {
    if (!workspace?.id) return

    try {
      setIsLoading(true)
      const result = await getBlockedUsers(workspace.id)
      setBlockedUsers(result.data)
      setCounts(result.counts)
      logger.info(`🚫 Loaded ${result.counts.total} blocked users`)
    } catch (error) {
      logger.error("Error loading blocked users:", error)
      toast.error("Failed to load blocked users")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadBlockedUsers()
  }, [workspace?.id])

  // Unblock a customer
  const handleUnblockCustomer = async (userId: string) => {
    if (!workspace?.id) return

    try {
      setIsProcessing(userId)
      await api.post(`/workspaces/${workspace.id}/customers/${userId}/unblock`)
      toast.success("Customer unblocked successfully")
      await loadBlockedUsers()
    } catch (error) {
      logger.error("Error unblocking customer:", error)
      toast.error("Failed to unblock customer")
    } finally {
      setIsProcessing(null)
    }
  }

  // Delete a registration attempt
  const handleDeleteAttempt = async (attemptId: string) => {
    if (!workspace?.id) return

    try {
      setIsProcessing(attemptId)
      await api.delete(`/workspaces/${workspace.id}/registration-attempts/${attemptId}`)
      toast.success("Registration attempt deleted")
      await loadBlockedUsers()
    } catch (error) {
      logger.error("Error deleting registration attempt:", error)
      toast.error("Failed to delete registration attempt")
    } finally {
      setIsProcessing(null)
    }
  }

  // Format date
  const formatDate = (date: string | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleString()
  }

  if (!workspace?.id) {
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <p className="text-red-500">No workspace selected</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="flex-1 space-y-4 p-4 pt-2">
        <div className="flex items-center justify-between">
          <PageHeader
            title={
              <div className="flex items-center gap-2">
                <ShieldBan className="h-6 w-6 text-red-600" />
                <span className="text-red-600">Blocked Users</span>
              </div>
            }
            description={`${counts.total} blocked user${counts.total !== 1 ? "s" : ""} (${counts.customers} customers, ${counts.registrationAttempts} unregistered)`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={loadBlockedUsers}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : blockedUsers.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 text-gray-500">
            <ShieldBan className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-lg">No blocked users</p>
            <p className="text-sm">All users are currently active</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Blocked At</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blockedUsers.map((user) => (
                  <TableRow key={`${user.type}-${user.id}`}>
                    <TableCell>
                      {user.type === "customer" ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          <User className="h-3 w-3 mr-1" />
                          Customer
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                          <UserX className="h-3 w-3 mr-1" />
                          Unregistered
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="font-mono text-sm">{user.phone}</TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(user.blockedAt)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm" title={user.reason}>
                      {user.reason}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.type === "customer" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnblockCustomer(user.id)}
                          disabled={isProcessing === user.id}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          {isProcessing === user.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Unlock className="h-4 w-4 mr-1" />
                              Unblock
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAttempt(user.id)}
                          disabled={isProcessing === user.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {isProcessing === user.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
