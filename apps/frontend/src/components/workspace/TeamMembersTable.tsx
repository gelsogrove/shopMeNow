import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { InviteMemberModal } from "./InviteMemberModal"
import { toast } from "@/lib/toast"
import {
  invitationApi,
  teamMemberApi,
  type PendingInvitation,
  type TeamMember,
} from "@/services/teamApi"
import {
  Clock,
  Crown,
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useBilling } from "@/contexts/BillingContext"

interface TeamMembersTableProps {
  workspaceId: string
  isSuperAdmin: boolean
  paypalConnected?: boolean
}

type TabType = "members" | "invitations"

/**
 * Component to display team members and pending invitations
 * Shows different actions based on user role (SUPER_ADMIN vs ADMIN)
 */
export function TeamMembersTable({
  workspaceId,
  isSuperAdmin,
  paypalConnected,
}: TeamMembersTableProps) {
  const { billingOverview, isLoadingOverview } = useBilling()
  const [activeTab, setActiveTab] = useState<TabType>("members")
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // ✅ Fix: null = unlimited (ENTERPRISE), undefined = not loaded yet (allow), 0 = disabled (FREE_TRIAL/BASIC)
  const maxTeamMembers = billingOverview?.limits?.maxTeamMembers
  const isInviteFeatureEnabled = 
    maxTeamMembers === undefined || // Not loaded yet - allow
    maxTeamMembers === null ||      // ENTERPRISE unlimited - allow
    maxTeamMembers > 0              // PREMIUM with limit - allow
  const currentTeamUsage = useMemo(
    () => members.length + invitations.length,
    [members.length, invitations.length]
  )
  const planType = billingOverview?.billing?.planType || "FREE_TRIAL"
  const isFreePlan = planType === "FREE_TRIAL"
  const isInviteLimitReached =
    maxTeamMembers !== null && 
    maxTeamMembers !== undefined && 
    maxTeamMembers > 0 &&
    currentTeamUsage >= maxTeamMembers
  const billingPaymentConnected = billingOverview?.billing?.isPaymentConnected
  const isBillingReady = !!billingOverview && !isLoadingOverview
  const paymentSourceProvided = typeof paypalConnected === "boolean"
  const isPaymentConnected = paymentSourceProvided
    ? paypalConnected!
    : isBillingReady
      ? billingPaymentConnected ?? true // If billing is loaded but field missing, assume connected
      : false

  const inviteBlockReason = (() => {
    if (!isSuperAdmin) return "Only the workspace owner can invite new members"
    if (!isFreePlan && !isPaymentConnected) return "Connect PayPal to invite team members"
    if (!isBillingReady) {
      // If PayPal status is explicitly provided (connected) but billing not ready yet, allow
      if (paymentSourceProvided && paypalConnected) return null
      return "Loading billing status..."
    }
    if (isInviteFeatureEnabled === false) return "Upgrade to Premium or Enterprise to invite team members"
    if (isInviteLimitReached) return "Team member limit reached. Upgrade to add more members."
    return null
  })()

  const canInvite = inviteBlockReason === null

  // DEBUG LOGGING
  useEffect(() => {
    console.log('[TeamMembersTable] Debug info:', {
      isSuperAdmin,
      isLoadingOverview,
      maxTeamMembers,
      isInviteFeatureEnabled,
      isInviteLimitReached,
      currentTeamUsage,
      members: members.length,
      invitations: invitations.length,
      billingOverviewExists: !!billingOverview,
      billingOverview: billingOverview
    })
  }, [isSuperAdmin, isLoadingOverview, maxTeamMembers, isInviteFeatureEnabled, isInviteLimitReached, currentTeamUsage, members.length, invitations.length, billingOverview])

  // Modal states
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<TeamMember | null>(null)
  const [confirmCancelInvitation, setConfirmCancelInvitation] = useState<PendingInvitation | null>(null)
  const [isActionLoading, setIsActionLoading] = useState(false)

  const loadData = useCallback(async () => {
    if (!workspaceId) return

    setIsLoading(true)
    setError(null)

    try {
      const [membersData, invitationsData] = await Promise.all([
        teamMemberApi.getMembers(workspaceId),
        isSuperAdmin ? invitationApi.getPending(workspaceId) : Promise.resolve([]),
      ])
      setMembers(membersData)
      setInvitations(invitationsData)
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || "Failed to load team data"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, isSuperAdmin])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRemoveMember = async () => {
    if (!confirmRemoveMember) return

    setIsActionLoading(true)
    try {
      await teamMemberApi.removeMember(workspaceId, confirmRemoveMember.userId)
      toast.success(`${confirmRemoveMember.email} has been removed from the team`)
      setConfirmRemoveMember(null)
      loadData()
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || "Failed to remove member"
      toast.error(message)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleCancelInvitation = async () => {
    if (!confirmCancelInvitation) return

    setIsActionLoading(true)
    try {
      await invitationApi.cancel(workspaceId, confirmCancelInvitation.id)
      toast.success(`Invitation to ${confirmCancelInvitation.email} has been cancelled`)
      setConfirmCancelInvitation(null)
      loadData()
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || "Failed to cancel invitation"
      toast.error(message)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleResendInvitation = async (invitation: PendingInvitation) => {
    setIsActionLoading(true)
    try {
      await invitationApi.resend(workspaceId, invitation.id)
      toast.success(`Invitation resent to ${invitation.email}`)
      loadData()
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || "Failed to resend invitation"
      toast.error(message)
    } finally {
      setIsActionLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  // Render disabled button with tooltip for ADMINs
  const renderDisabledButton = (
    icon: React.ReactNode,
    label: string,
    tooltip: string
  ) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="opacity-50 cursor-not-allowed"
            >
              {icon}
              <span className="sr-only">{label}</span>
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="mt-8">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Users className="h-5 w-5" />
                Team
              </CardTitle>
              <CardDescription>
                Manage your team members and pending invitations
              </CardDescription>
            </div>
            {/* ✅ ALWAYS show button - enabled for SUPER_ADMIN unless explicitly disabled */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canInvite}
                      onClick={() => setInviteModalOpen(true)}
                      className={`gap-1.5 ${
                        canInvite
                          ? "text-green-600 border-green-600 hover:bg-green-50"
                          : ""
                      }`}
                    >
                      {isLoadingOverview ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      Invite Member
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canInvite && (
                  <TooltipContent>
                    <p>{inviteBlockReason}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>

        <CardContent>
          {/* Tabs */}
          <div className="flex border-b mb-4">
            <button
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "members"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("members")}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Members ({members.length})
            </button>
            {/* Only show Pending Invites tab for SUPER_ADMIN (Owner) */}
            {isSuperAdmin && (
              <button
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "invitations"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("invitations")}
              >
                <Mail className="h-4 w-4 inline mr-2" />
                Pending Invites ({invitations.length})
              </button>
            )}
          </div>

          {/* Members Tab */}
          {activeTab === "members" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[300px]">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 4 : 3} className="text-center text-gray-500 py-8">
                      No team members yet
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => {
                    const displayName = member.firstName && member.lastName 
                      ? `${member.firstName} ${member.lastName}`.trim()
                      : member.firstName || member.lastName || null
                    const isOwner = member.role === "SUPER_ADMIN"
                    
                    return (
                      <TableRow key={member.userId}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {member.email}
                          {displayName && (
                            <span className="text-gray-500 ml-2">({displayName})</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isOwner ? (
                            <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                              <Crown className="h-3 w-3 mr-1" />
                              Owner
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Admin
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-500 whitespace-nowrap">
                          {formatDate(member.createdAt)}
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell className="text-right">
                            {!isOwner ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setConfirmRemoveMember(member)}
                                disabled={isActionLoading}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}

          {/* Invitations Tab */}
          {activeTab === "invitations" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No pending invitations
                    </TableCell>
                  </TableRow>
                ) : (
                  invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">
                        {invitation.email}
                      </TableCell>
                      <TableCell>
                        {invitation.isAgent ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                            Agent
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Admin
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isExpired(invitation.expiresAt) ? (
                          <Badge variant="destructive">
                            <Clock className="h-3 w-3 mr-1" />
                            Expired
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatDate(invitation.expiresAt)}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {isSuperAdmin ? (
                          <>
                            {isExpired(invitation.expiresAt) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleResendInvitation(invitation)}
                                disabled={isActionLoading}
                              >
                                <RefreshCw className="h-4 w-4" />
                                <span className="sr-only">Resend</span>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setConfirmCancelInvitation(invitation)}
                              disabled={isActionLoading}
                            >
                              <X className="h-4 w-4" />
                              <span className="sr-only">Cancel</span>
                            </Button>
                          </>
                        ) : (
                          renderDisabledButton(
                            <Trash2 className="h-4 w-4" />,
                            "Cancel",
                            "Only the workspace owner can manage invitations"
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <InviteMemberModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        workspaceId={workspaceId}
        onSuccess={loadData}
      />

      {/* Remove Member Confirmation */}
      <ConfirmDialog
        open={!!confirmRemoveMember}
        onOpenChange={(open) => !open && setConfirmRemoveMember(null)}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${confirmRemoveMember?.email} from your team?\n\nThey will lose access to all your channels.`}
        onConfirm={handleRemoveMember}
        confirmLabel="Remove"
        variant="destructive"
      />

      {/* Cancel Invitation Confirmation */}
      <ConfirmDialog
        open={!!confirmCancelInvitation}
        onOpenChange={(open) => !open && setConfirmCancelInvitation(null)}
        title="Cancel Invitation"
        description={`Are you sure you want to cancel the invitation to ${confirmCancelInvitation?.email}?\n\nThe invitation link will no longer work.`}
        onConfirm={handleCancelInvitation}
        confirmLabel="Cancel Invitation"
        variant="destructive"
      />
    </>
  )
}
